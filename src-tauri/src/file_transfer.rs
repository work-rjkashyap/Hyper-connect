use crate::protocol::{
    FileTransferAckPayload, FileTransferChunkPayload, FileTransferCompletePayload,
    FileTransferRequestPayload,
};
use crate::tcp_client::TcpClient;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransferStatus {
    Pending,
    InProgress,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTransfer {
    pub id: String,
    pub filename: String,
    pub file_path: Option<String>,
    pub size: u64,
    pub transferred: u64,
    pub status: TransferStatus,
    pub from_device_id: String,
    pub to_device_id: String,
    pub checksum: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone)]
pub struct FileTransferService {
    transfers: Arc<Mutex<HashMap<String, FileTransfer>>>,
    transfer_dir: PathBuf,
    tcp_client: Option<Arc<TcpClient>>,
}

impl FileTransferService {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let transfer_dir = app_data_dir.join("transfers");
        std::fs::create_dir_all(&transfer_dir).ok();

        Self {
            transfers: Arc::new(Mutex::new(HashMap::new())),
            transfer_dir,
            tcp_client: None,
        }
    }

    pub fn set_tcp_client(&mut self, tcp_client: Arc<TcpClient>) {
        self.tcp_client = Some(tcp_client);
    }

    pub fn create_transfer(
        &self,
        filename: String,
        file_path: String,
        from_device_id: String,
        to_device_id: String,
    ) -> Result<FileTransfer, String> {
        let file_metadata = std::fs::metadata(&file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        let transfer = FileTransfer {
            id: Uuid::new_v4().to_string(),
            filename,
            file_path: Some(file_path),
            size: file_metadata.len(),
            transferred: 0,
            status: TransferStatus::Pending,
            from_device_id,
            to_device_id,
            checksum: None,
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
        };

        let mut transfers = self.transfers.lock().unwrap();
        transfers.insert(transfer.id.clone(), transfer.clone());
        drop(transfers);

        Ok(transfer)
    }

    pub fn start_transfer(&self, transfer_id: &str, peer_address: Option<String>, app_handle: AppHandle) -> Result<(), String> {
        let mut transfers = self.transfers.lock().unwrap();
        let transfer = transfers.get_mut(transfer_id)
            .ok_or("Transfer not found")?;

        if !matches!(transfer.status, TransferStatus::Pending | TransferStatus::Paused) {
            return Err("Transfer cannot be started".to_string());
        }

        transfer.status = TransferStatus::InProgress;
        transfer.updated_at = chrono::Utc::now().timestamp();
        let transfer_clone = transfer.clone();
        drop(transfers);

        // Spawn transfer task (network or simulated)
        let transfers_arc = Arc::clone(&self.transfers);
        let transfer_id = transfer_id.to_string();
        let tcp_client = self.tcp_client.clone();

        if let (Some(client), Some(address)) = (tcp_client, peer_address) {
            // Perform actual network transfer
            tauri::async_runtime::spawn(async move {
                Self::perform_network_transfer(transfer_id, transfer_clone, transfers_arc, app_handle, client, address).await;
            });
        } else {
            // Fallback to simulated transfer (for testing without network)
            std::thread::spawn(move || {
                Self::perform_transfer(transfer_id, transfer_clone, transfers_arc, app_handle);
            });
        }

        Ok(())
    }

    fn perform_transfer(
        transfer_id: String,
        mut transfer: FileTransfer,
        transfers: Arc<Mutex<HashMap<String, FileTransfer>>>,
        app_handle: AppHandle,
    ) {
        const CHUNK_SIZE: usize = 8192; // 8KB chunks

        if let Some(file_path) = &transfer.file_path {
            let mut file = match File::open(file_path) {
                Ok(f) => f,
                Err(e) => {
                    Self::update_transfer_status(&transfers, &transfer_id, TransferStatus::Failed);
                    let _ = app_handle.emit("transfer-failed", transfer_id);
                    eprintln!("Failed to open file: {}", e);
                    return;
                }
            };

            // Seek to the last transferred position (for resume)
            if transfer.transferred > 0 {
                if let Err(e) = file.seek(SeekFrom::Start(transfer.transferred)) {
                    Self::update_transfer_status(&transfers, &transfer_id, TransferStatus::Failed);
                    let _ = app_handle.emit("transfer-failed", transfer_id);
                    eprintln!("Failed to seek file: {}", e);
                    return;
                }
            }

            let mut buffer = vec![0u8; CHUNK_SIZE];
            let mut hasher = sha2::Sha256::new();

            loop {
                // Check if transfer is paused or cancelled
                {
                    let transfers_lock = transfers.lock().unwrap();
                    if let Some(current_transfer) = transfers_lock.get(&transfer_id) {
                        match current_transfer.status {
                            TransferStatus::Paused => {
                                drop(transfers_lock);
                                return;
                            }
                            TransferStatus::Cancelled => {
                                drop(transfers_lock);
                                let _ = app_handle.emit("transfer-cancelled", transfer_id);
                                return;
                            }
                            _ => {}
                        }
                    }
                }

                let bytes_read = match file.read(&mut buffer) {
                    Ok(0) => break, // EOF
                    Ok(n) => n,
                    Err(e) => {
                        Self::update_transfer_status(&transfers, &transfer_id, TransferStatus::Failed);
                        let _ = app_handle.emit("transfer-failed", transfer_id.clone());
                        eprintln!("Failed to read file: {}", e);
                        return;
                    }
                };

                // Update hash
                use sha2::Digest;
                hasher.update(&buffer[..bytes_read]);

                // Update progress
                transfer.transferred += bytes_read as u64;
                transfer.updated_at = chrono::Utc::now().timestamp();

                {
                    let mut transfers_lock = transfers.lock().unwrap();
                    if let Some(t) = transfers_lock.get_mut(&transfer_id) {
                        t.transferred = transfer.transferred;
                        t.updated_at = transfer.updated_at;
                    }
                }

                // Emit progress event
                let _ = app_handle.emit("transfer-progress", transfer.clone());

                // Simulate network delay
                std::thread::sleep(std::time::Duration::from_millis(10));
            }

            // Calculate final checksum
            use sha2::Digest;
            let hash_result = hasher.finalize();
            let checksum = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, hash_result);

            // Mark as completed
            {
                let mut transfers_lock = transfers.lock().unwrap();
                if let Some(t) = transfers_lock.get_mut(&transfer_id) {
                    t.status = TransferStatus::Completed;
                    t.checksum = Some(checksum);
                    t.updated_at = chrono::Utc::now().timestamp();
                    transfer = t.clone();
                }
            }

            let _ = app_handle.emit("transfer-completed", transfer);
        }
    }

    /// Perform file transfer over the network
    async fn perform_network_transfer(
        transfer_id: String,
        mut transfer: FileTransfer,
        transfers: Arc<Mutex<HashMap<String, FileTransfer>>>,
        app_handle: AppHandle,
        tcp_client: Arc<TcpClient>,
        peer_address: String,
    ) {
        const CHUNK_SIZE: usize = 65536; // 64KB chunks for network transfer

        if let Some(file_path) = &transfer.file_path {
            // Open the file
            let mut file = match File::open(file_path) {
                Ok(f) => f,
                Err(e) => {
                    Self::update_transfer_status(&transfers, &transfer_id, TransferStatus::Failed);
                    let _ = app_handle.emit("transfer-failed", transfer_id);
                    eprintln!("Failed to open file: {}", e);
                    return;
                }
            };

            // Calculate checksum upfront
            let mut hasher = sha2::Sha256::new();
            let mut temp_buffer = vec![0u8; CHUNK_SIZE];
            loop {
                match file.read(&mut temp_buffer) {
                    Ok(0) => break,
                    Ok(n) => {
                        use sha2::Digest;
                        hasher.update(&temp_buffer[..n]);
                    }
                    Err(e) => {
                        eprintln!("Failed to read file for checksum: {}", e);
                        Self::update_transfer_status(&transfers, &transfer_id, TransferStatus::Failed);
                        let _ = app_handle.emit("transfer-failed", transfer_id.clone());
                        return;
                    }
                }
            }

            use sha2::Digest;
            let hash_result = hasher.finalize();
            let checksum = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, hash_result);

            // Reset file to beginning
            if let Err(e) = file.seek(SeekFrom::Start(0)) {
                eprintln!("Failed to reset file: {}", e);
                Self::update_transfer_status(&transfers, &transfer_id, TransferStatus::Failed);
                let _ = app_handle.emit("transfer-failed", transfer_id);
                return;
            }

            // Send file transfer request
            let request_payload = FileTransferRequestPayload {
                transfer_id: transfer_id.clone(),
                filename: transfer.filename.clone(),
                file_size: transfer.size,
                from_device_id: transfer.from_device_id.clone(),
                to_device_id: transfer.to_device_id.clone(),
                checksum: Some(checksum.clone()),
            };

            let request_bytes = match serde_json::to_vec(&request_payload) {
                Ok(b) => b,
                Err(e) => {
                    eprintln!("Failed to serialize file transfer request: {}", e);
                    Self::update_transfer_status(&transfers, &transfer_id, TransferStatus::Failed);
                    let _ = app_handle.emit("transfer-failed", transfer_id);
                    return;
                }
            };

            if let Err(e) = tcp_client
                .send_file_transfer_request(&transfer.to_device_id, &peer_address, 8080, request_bytes)
                .await
            {
                eprintln!("Failed to send file transfer request: {}", e);
                Self::update_transfer_status(&transfers, &transfer_id, TransferStatus::Failed);
                let _ = app_handle.emit("transfer-failed", transfer_id);
                return;
            }

            // Send file chunks
            let mut buffer = vec![0u8; CHUNK_SIZE];
            let mut offset = 0u64;

            loop {
                // Check if transfer is paused or cancelled
                {
                    let transfers_lock = transfers.lock().unwrap();
                    if let Some(current_transfer) = transfers_lock.get(&transfer_id) {
                        match current_transfer.status {
                            TransferStatus::Paused => {
                                drop(transfers_lock);
                                return;
                            }
                            TransferStatus::Cancelled => {
                                drop(transfers_lock);
                                let _ = app_handle.emit("transfer-cancelled", transfer_id);
                                return;
                            }
                            _ => {}
                        }
                    }
                }

                let bytes_read = match file.read(&mut buffer) {
                    Ok(0) => break, // EOF
                    Ok(n) => n,
                    Err(e) => {
                        Self::update_transfer_status(&transfers, &transfer_id, TransferStatus::Failed);
                        let _ = app_handle.emit("transfer-failed", transfer_id.clone());
                        eprintln!("Failed to read file: {}", e);
                        return;
                    }
                };

                // Send chunk
                let chunk_payload = FileTransferChunkPayload {
                    transfer_id: transfer_id.clone(),
                    offset,
                    data: buffer[..bytes_read].to_vec(),
                };

                let chunk_bytes = match serde_json::to_vec(&chunk_payload) {
                    Ok(b) => b,
                    Err(e) => {
                        eprintln!("Failed to serialize chunk: {}", e);
                        Self::update_transfer_status(&transfers, &transfer_id, TransferStatus::Failed);
                        let _ = app_handle.emit("transfer-failed", transfer_id.clone());
                        return;
                    }
                };

                if let Err(e) = tcp_client
                    .send_file_chunk(&transfer.to_device_id, &peer_address, 8080, chunk_bytes)
                    .await
                {
                    eprintln!("Failed to send chunk: {}", e);
                    Self::update_transfer_status(&transfers, &transfer_id, TransferStatus::Failed);
                    let _ = app_handle.emit("transfer-failed", transfer_id.clone());
                    return;
                }

                // Update progress
                offset += bytes_read as u64;
                transfer.transferred = offset;
                transfer.updated_at = chrono::Utc::now().timestamp();

                {
                    let mut transfers_lock = transfers.lock().unwrap();
                    if let Some(t) = transfers_lock.get_mut(&transfer_id) {
                        t.transferred = transfer.transferred;
                        t.updated_at = transfer.updated_at;
                    }
                }

                // Emit progress event
                let _ = app_handle.emit("transfer-progress", transfer.clone());

                // Small delay to prevent overwhelming the network
                tokio::time::sleep(tokio::time::Duration::from_micros(100)).await;
            }

            // Send completion notification
            let complete_payload = FileTransferCompletePayload {
                transfer_id: transfer_id.clone(),
                checksum: checksum.clone(),
            };

            let complete_bytes = match serde_json::to_vec(&complete_payload) {
                Ok(b) => b,
                Err(e) => {
                    eprintln!("Failed to serialize completion: {}", e);
                    Self::update_transfer_status(&transfers, &transfer_id, TransferStatus::Failed);
                    let _ = app_handle.emit("transfer-failed", transfer_id);
                    return;
                }
            };

            if let Err(e) = tcp_client
                .send_file_complete(&transfer.to_device_id, &peer_address, 8080, complete_bytes)
                .await
            {
                eprintln!("Failed to send completion: {}", e);
                Self::update_transfer_status(&transfers, &transfer_id, TransferStatus::Failed);
                let _ = app_handle.emit("transfer-failed", transfer_id);
                return;
            }

            // Mark as completed locally
            {
                let mut transfers_lock = transfers.lock().unwrap();
                if let Some(t) = transfers_lock.get_mut(&transfer_id) {
                    t.status = TransferStatus::Completed;
                    t.checksum = Some(checksum);
                    t.updated_at = chrono::Utc::now().timestamp();
                    transfer = t.clone();
                }
            }

            let _ = app_handle.emit("transfer-completed", transfer);
        }
    }

    pub fn pause_transfer(&self, transfer_id: &str) -> Result<(), String> {
        Self::update_transfer_status(&self.transfers, transfer_id, TransferStatus::Paused);
        Ok(())
    }

    pub fn resume_transfer(&self, transfer_id: &str, peer_address: Option<String>, app_handle: AppHandle) -> Result<(), String> {
        self.start_transfer(transfer_id, peer_address, app_handle)
    }

    pub fn cancel_transfer(&self, transfer_id: &str) -> Result<(), String> {
        Self::update_transfer_status(&self.transfers, transfer_id, TransferStatus::Cancelled);
        Ok(())
    }

    pub fn get_transfers(&self) -> Vec<FileTransfer> {
        let transfers = self.transfers.lock().unwrap();
        transfers.values().cloned().collect()
    }

    pub fn get_transfer(&self, transfer_id: &str) -> Option<FileTransfer> {
        let transfers = self.transfers.lock().unwrap();
        transfers.get(transfer_id).cloned()
    }

    fn update_transfer_status(
        transfers: &Arc<Mutex<HashMap<String, FileTransfer>>>,
        transfer_id: &str,
        status: TransferStatus,
    ) {
        let mut transfers_lock = transfers.lock().unwrap();
        if let Some(transfer) = transfers_lock.get_mut(transfer_id) {
            transfer.status = status;
            transfer.updated_at = chrono::Utc::now().timestamp();
        }
    }

    /// Handle incoming file transfer request from network
    pub async fn receive_file_request(
        &self,
        payload: FileTransferRequestPayload,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let transfer = FileTransfer {
            id: payload.transfer_id.clone(),
            filename: payload.filename.clone(),
            file_path: Some(self.transfer_dir.join(&payload.filename).to_string_lossy().to_string()),
            size: payload.file_size,
            transferred: 0,
            status: TransferStatus::Pending,
            from_device_id: payload.from_device_id,
            to_device_id: payload.to_device_id,
            checksum: payload.checksum,
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
        };

        let mut transfers = self.transfers.lock().unwrap();
        transfers.insert(transfer.id.clone(), transfer.clone());
        drop(transfers);

        // Emit event to frontend
        let _ = app_handle.emit("transfer-request-received", transfer);

        Ok(())
    }

    /// Handle incoming file chunk from network
    pub async fn receive_file_chunk(
        &self,
        payload: FileTransferChunkPayload,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let mut transfers = self.transfers.lock().unwrap();
        let transfer = transfers
            .get_mut(&payload.transfer_id)
            .ok_or("Transfer not found")?;

        // Update status to in progress if pending
        if matches!(transfer.status, TransferStatus::Pending) {
            transfer.status = TransferStatus::InProgress;
        }

        // Write chunk to file
        if let Some(file_path) = &transfer.file_path {
            let mut file = std::fs::OpenOptions::new()
                .create(true)
                .write(true)
                .open(file_path)
                .map_err(|e| format!("Failed to open file: {}", e))?;

            file.seek(SeekFrom::Start(payload.offset))
                .map_err(|e| format!("Failed to seek file: {}", e))?;

            file.write_all(&payload.data)
                .map_err(|e| format!("Failed to write chunk: {}", e))?;
        }

        // Update progress
        transfer.transferred = payload.offset + payload.data.len() as u64;
        transfer.updated_at = chrono::Utc::now().timestamp();
        let transfer_clone = transfer.clone();
        drop(transfers);

        // Emit progress event
        let _ = app_handle.emit("transfer-progress", transfer_clone);

        Ok(())
    }

    /// Handle file transfer acknowledgment from network
    pub async fn handle_ack(
        &self,
        _payload: FileTransferAckPayload,
        _app_handle: AppHandle,
    ) -> Result<(), String> {
        // Acknowledgment handling can be used for flow control
        // For now, we just log it
        Ok(())
    }

    /// Handle file transfer complete notification from network
    pub async fn handle_complete(
        &self,
        payload: FileTransferCompletePayload,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let mut transfers = self.transfers.lock().unwrap();
        let transfer = transfers
            .get_mut(&payload.transfer_id)
            .ok_or("Transfer not found")?;

        transfer.status = TransferStatus::Completed;
        transfer.checksum = Some(payload.checksum);
        transfer.updated_at = chrono::Utc::now().timestamp();
        let transfer_clone = transfer.clone();
        drop(transfers);

        // Emit completion event
        let _ = app_handle.emit("transfer-completed", transfer_clone);

        Ok(())
    }
}
