//! File Transfer Service
//!
//! High-performance file transfer implementation optimized for LAN speeds.
//! Uses zero-copy streaming with large chunks (256KB+) and minimal overhead.
//!
//! Transfer metadata is persisted to SQLite so history survives restarts.
//! The in-memory HashMap is kept as a fast-path cache for active transfers
//! (so chunk-by-chunk progress updates don't hit the DB on every write).

#![allow(dead_code)]

use crate::db::{self, DbPool};
use crate::network::client::TcpClient;
use crate::network::protocol::{
    serialize_json, FileCompletePayload, FileDataHeader, FileRequestPayload,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use uuid::Uuid;

/// Chunk size for file transfers (256KB for optimal performance)
const CHUNK_SIZE: usize = 256 * 1024;

/// Maximum concurrent transfers
const MAX_CONCURRENT_TRANSFERS: usize = 3;

/// How often (in bytes) to persist transfer progress to SQLite.
/// Every ~1 MB (4 chunks) ensures we don't lose too much progress on crash
/// without hammering the DB on every single chunk.
const PROGRESS_PERSIST_INTERVAL: u64 = 4 * CHUNK_SIZE as u64;

/// File transfer status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TransferStatus {
    Pending,
    InProgress,
    Paused,
    Completed,
    Failed,
    Cancelled,
    Rejected,
    AwaitingAcceptance,
}

/// File transfer metadata
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
    pub speed_bps: f64, // Bytes per second
    pub eta_seconds: Option<u64>,
}

impl FileTransfer {
    /// Calculate transfer progress as percentage
    pub fn progress(&self) -> f64 {
        if self.size == 0 {
            return 0.0;
        }
        (self.transferred as f64 / self.size as f64) * 100.0
    }

    /// Update speed and ETA
    pub fn update_metrics(&mut self, elapsed_ms: u64) {
        if elapsed_ms > 0 {
            self.speed_bps = (self.transferred as f64 / elapsed_ms as f64) * 1000.0;

            if self.speed_bps > 0.0 {
                let remaining = self.size - self.transferred;
                self.eta_seconds = Some((remaining as f64 / self.speed_bps) as u64);
            }
        }
    }
}

/// File transfer service
pub struct FileTransferService {
    /// In-memory cache for active transfers (fast path for chunk progress).
    pub(crate) transfers: Arc<Mutex<HashMap<String, FileTransfer>>>,
    /// SQLite pool — authoritative source of transfer history.
    db: Arc<DbPool>,
    transfer_dir: PathBuf,
    tcp_client: Option<Arc<TcpClient>>,
    tcp_port: u16,
    active_transfers: Arc<Mutex<usize>>,
}

impl FileTransferService {
    /// Create a new file transfer service.
    ///
    /// Existing transfers are loaded from the SQLite database into the
    /// in-memory cache so they are immediately available without a separate
    /// async load step.
    pub fn new(app_data_dir: PathBuf, db: Arc<DbPool>) -> Self {
        let transfer_dir = app_data_dir.join("transfers");
        if let Err(e) = std::fs::create_dir_all(&transfer_dir) {
            eprintln!("Failed to create transfer directory: {}", e);
        }

        Self {
            transfers: Arc::new(Mutex::new(HashMap::new())),
            db,
            transfer_dir,
            tcp_client: None,
            tcp_port: 8080,
            active_transfers: Arc::new(Mutex::new(0)),
        }
    }

    /// Load persisted transfers from the database into the in-memory cache.
    ///
    /// Should be called once after construction (inside an async context).
    pub async fn load_from_db(&self) {
        match db::transfers::get_transfers(&self.db).await {
            Ok(rows) => {
                let mut cache = self.transfers.lock().await;
                for t in rows {
                    cache.insert(t.id.clone(), t);
                }
                println!("✓ Loaded {} transfer(s) from SQLite", cache.len());
            }
            Err(e) => eprintln!("⚠️  Failed to load transfers from DB: {}", e),
        }
    }

    /// Set TCP port
    pub fn set_tcp_port(&mut self, port: u16) {
        self.tcp_port = port;
    }

    /// Set TCP client
    pub fn set_tcp_client(&mut self, tcp_client: Arc<TcpClient>) {
        self.tcp_client = Some(tcp_client);
    }

    /// Get a reference to the TCP client (used by IPC commands to send ACKs)
    pub fn tcp_client_ref(&self) -> Option<&Arc<TcpClient>> {
        self.tcp_client.as_ref()
    }

    /// Create a new file transfer
    pub async fn create_transfer(
        &self,
        filename: String,
        file_path: String,
        from_device_id: String,
        to_device_id: String,
    ) -> Result<FileTransfer, String> {
        // Validate file exists and get size
        let path = Path::new(&file_path);
        if !path.exists() {
            return Err(format!("File not found: {}", file_path));
        }

        let metadata =
            std::fs::metadata(path).map_err(|e| format!("Failed to read file metadata: {}", e))?;

        let transfer = FileTransfer {
            id: Uuid::new_v4().to_string(),
            filename,
            file_path: Some(file_path),
            size: metadata.len(),
            transferred: 0,
            status: TransferStatus::Pending,
            from_device_id,
            to_device_id,
            checksum: None,
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
            speed_bps: 0.0,
            eta_seconds: None,
        };

        // Persist to SQLite
        if let Err(e) = db::transfers::insert_transfer(&self.db, &transfer).await {
            eprintln!("⚠️  DB insert_transfer failed: {}", e);
        }

        // Cache in memory
        let mut transfers = self.transfers.lock().await;
        transfers.insert(transfer.id.clone(), transfer.clone());

        println!(
            "✓ Created file transfer: {} ({})",
            transfer.filename, transfer.id
        );
        Ok(transfer)
    }

    /// Start a file transfer
    pub async fn start_transfer(
        &self,
        transfer_id: &str,
        peer_address: Option<String>,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        // Check concurrent transfer limit
        {
            let active = self.active_transfers.lock().await;
            if *active >= MAX_CONCURRENT_TRANSFERS {
                return Err(format!(
                    "Maximum concurrent transfers ({}) reached",
                    MAX_CONCURRENT_TRANSFERS
                ));
            }
        }

        let tcp_client = self
            .tcp_client
            .as_ref()
            .ok_or("TCP client not initialized")?
            .clone();

        let transfer = {
            let mut transfers = self.transfers.lock().await;
            let transfer = transfers.get_mut(transfer_id).ok_or("Transfer not found")?;

            if transfer.status != TransferStatus::Pending {
                return Err(format!(
                    "Transfer is not in pending state: {:?}",
                    transfer.status
                ));
            }

            // Mark as awaiting the receiver's acceptance — NOT InProgress yet.
            transfer.status = TransferStatus::AwaitingAcceptance;
            transfer.updated_at = chrono::Utc::now().timestamp();
            transfer.clone()
        };

        let address = peer_address.ok_or("Peer address not provided")?;

        println!(
            "→ Starting file transfer: {} to {}",
            transfer.filename, transfer.to_device_id
        );

        // Spawn transfer task
        let transfers_arc = Arc::clone(&self.transfers);
        let active_transfers = Arc::clone(&self.active_transfers);
        let db_arc = Arc::clone(&self.db);
        let tcp_port = self.tcp_port;
        let transfer_id_clone = transfer_id.to_string();

        tokio::spawn(async move {
            // Increment active transfer count
            {
                let mut active = active_transfers.lock().await;
                *active += 1;
            }

            let result = Self::perform_transfer(
                transfer.clone(),
                transfers_arc.clone(),
                app_handle.clone(),
                tcp_client,
                address,
                tcp_port,
                Arc::clone(&db_arc),
                0, // fresh transfer, no resume offset
            )
            .await;

            // Decrement active transfer count
            {
                let mut active = active_transfers.lock().await;
                *active -= 1;
            }

            if let Err(e) = result {
                eprintln!("Transfer failed: {}", e);
                Self::update_status(&transfers_arc, &transfer_id_clone, TransferStatus::Failed)
                    .await;
                // Persist failed status to DB
                let now = chrono::Utc::now().timestamp();
                if let Err(db_err) = db::transfers::update_transfer_status(
                    &db_arc,
                    &transfer_id_clone,
                    &TransferStatus::Failed,
                    now,
                )
                .await
                {
                    eprintln!("⚠️  DB update failed status error: {}", db_err);
                }
                let _ = app_handle.emit(
                    "transfer-failed",
                    serde_json::json!({
                        "transfer_id": transfer_id_clone,
                        "error": e,
                    }),
                );
            }
        });

        Ok(())
    }

    /// Resume a paused or failed file transfer from the last confirmed offset.
    ///
    /// The sender re-sends a `FILE_REQUEST` with `resume_offset` set to the
    /// receiver's confirmed byte count.  The receiver auto-accepts (no user
    /// prompt) and responds with `FILE_ACK` so the sender can start streaming
    /// from the confirmed offset.
    pub async fn resume_transfer(
        &self,
        transfer_id: &str,
        peer_address: Option<String>,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        // Check concurrent transfer limit
        {
            let active = self.active_transfers.lock().await;
            if *active >= MAX_CONCURRENT_TRANSFERS {
                return Err(format!(
                    "Maximum concurrent transfers ({}) reached",
                    MAX_CONCURRENT_TRANSFERS
                ));
            }
        }

        let tcp_client = self
            .tcp_client
            .as_ref()
            .ok_or("TCP client not initialized")?
            .clone();

        let (transfer, resume_offset) = {
            let mut transfers = self.transfers.lock().await;
            let transfer = transfers.get_mut(transfer_id).ok_or("Transfer not found")?;

            match transfer.status {
                TransferStatus::Paused | TransferStatus::Failed => {}
                _ => {
                    return Err(format!(
                        "Cannot resume transfer in state {:?}",
                        transfer.status
                    ));
                }
            }

            let resume_offset = transfer.transferred;
            transfer.status = TransferStatus::AwaitingAcceptance;
            transfer.updated_at = chrono::Utc::now().timestamp();
            (transfer.clone(), resume_offset)
        };

        let address = peer_address.ok_or("Peer address not provided")?;

        println!(
            "→ Resuming file transfer: {} to {} from offset {}",
            transfer.filename, transfer.to_device_id, resume_offset
        );

        // Emit resume event
        let _ = app_handle.emit(
            "transfer-resumed",
            serde_json::json!({
                "transfer_id": transfer.id,
                "resume_offset": resume_offset,
            }),
        );

        let transfers_arc = Arc::clone(&self.transfers);
        let active_transfers = Arc::clone(&self.active_transfers);
        let db_arc = Arc::clone(&self.db);
        let tcp_port = self.tcp_port;
        let transfer_id_clone = transfer_id.to_string();

        tokio::spawn(async move {
            {
                let mut active = active_transfers.lock().await;
                *active += 1;
            }

            let result = Self::perform_transfer(
                transfer.clone(),
                transfers_arc.clone(),
                app_handle.clone(),
                tcp_client,
                address,
                tcp_port,
                Arc::clone(&db_arc),
                resume_offset,
            )
            .await;

            {
                let mut active = active_transfers.lock().await;
                *active -= 1;
            }

            if let Err(e) = result {
                eprintln!("Resume transfer failed: {}", e);
                Self::update_status(&transfers_arc, &transfer_id_clone, TransferStatus::Failed)
                    .await;
                let now = chrono::Utc::now().timestamp();
                if let Err(db_err) = db::transfers::update_transfer_status(
                    &db_arc,
                    &transfer_id_clone,
                    &TransferStatus::Failed,
                    now,
                )
                .await
                {
                    eprintln!("⚠️  DB update failed status error: {}", db_err);
                }
                let _ = app_handle.emit(
                    "transfer-failed",
                    serde_json::json!({
                        "transfer_id": transfer_id_clone,
                        "error": e,
                    }),
                );
            }
        });

        Ok(())
    }

    /// Get transfers that can be resumed (paused/failed with partial data).
    pub async fn get_resumable_transfers(&self) -> Vec<FileTransfer> {
        match db::transfers::get_resumable_transfers(&self.db).await {
            Ok(transfers) => transfers,
            Err(e) => {
                eprintln!("⚠️  DB get_resumable_transfers failed: {}", e);
                // Fall back to in-memory cache
                self.transfers
                    .lock()
                    .await
                    .values()
                    .filter(|t| {
                        (t.status == TransferStatus::Paused || t.status == TransferStatus::Failed)
                            && t.transferred > 0
                            && t.transferred < t.size
                    })
                    .cloned()
                    .collect()
            }
        }
    }

    /// Perform the actual file transfer
    async fn perform_transfer(
        mut transfer: FileTransfer,
        transfers: Arc<Mutex<HashMap<String, FileTransfer>>>,
        app_handle: AppHandle,
        tcp_client: Arc<TcpClient>,
        peer_address: String,
        tcp_port: u16,
        db: Arc<DbPool>,
        resume_offset: u64,
    ) -> Result<(), String> {
        let file_path = transfer
            .file_path
            .as_ref()
            .ok_or("File path not set")?
            .clone();

        let is_resume = resume_offset > 0;

        // Send file request with metadata (checksum sent later with FILE_COMPLETE)
        let request = FileRequestPayload {
            msg_type: "FILE_REQUEST".to_string(),
            transfer_id: transfer.id.clone(),
            filename: transfer.filename.clone(),
            file_size: transfer.size,
            from_device_id: transfer.from_device_id.clone(),
            to_device_id: transfer.to_device_id.clone(),
            checksum: String::new(), // Will be calculated during streaming
            resume_offset,
        };

        let request_bytes = serialize_json(&request)?;
        tcp_client
            .send_file_request(
                &transfer.to_device_id,
                &peer_address,
                tcp_port,
                request_bytes,
            )
            .await?;

        if is_resume {
            println!(
                "✓ Sent resume request: {} (from offset {})",
                transfer.filename, resume_offset
            );
        } else {
            println!("✓ Sent file request: {}", transfer.filename);
        }

        // Emit "awaiting acceptance" event so the UI shows proper status
        let _ = app_handle.emit(
            "transfer-progress",
            serde_json::json!({
                "transfer_id": transfer.id,
                "transferred": 0u64,
                "total": transfer.size,
                "speed_bps": 0.0f64,
                "eta_seconds": Option::<u64>::None,
            }),
        );

        // ── Wait for receiver to accept ──────────────────────────────────
        // The receiver will send a FILE_ACK which the server handler sets
        // our local status to InProgress.  Poll until that happens, or
        // until cancelled / rejected / timed out.
        let wait_timeout = std::time::Duration::from_secs(300); // 5 min
        let poll_interval = std::time::Duration::from_millis(500);
        let wait_start = std::time::Instant::now();

        loop {
            if wait_start.elapsed() > wait_timeout {
                return Err("Timed out waiting for receiver to accept".to_string());
            }

            {
                let transfers_lock = transfers.lock().await;
                if let Some(current) = transfers_lock.get(&transfer.id) {
                    match current.status {
                        TransferStatus::InProgress => {
                            println!("✓ Receiver accepted, starting data stream");
                            break; // Accepted! Start streaming.
                        }
                        TransferStatus::Cancelled | TransferStatus::Rejected => {
                            println!("Transfer declined/cancelled: {}", transfer.id);
                            return Ok(());
                        }
                        TransferStatus::AwaitingAcceptance => {
                            // Still waiting, continue polling
                        }
                        _ => {}
                    }
                } else {
                    return Err("Transfer disappeared from store".to_string());
                }
            }

            tokio::time::sleep(poll_interval).await;
        }

        // ── Stream file data ─────────────────────────────────────────────
        // Open file for reading
        let mut file = tokio::fs::File::open(&file_path)
            .await
            .map_err(|e| format!("Failed to open file: {}", e))?;

        let start_time = std::time::Instant::now();
        let mut buffer = vec![0u8; CHUNK_SIZE];
        let mut offset: u64;
        // Calculate checksum incrementally while streaming
        let mut hasher = Sha256::new();
        // Track bytes since last DB progress persist
        let mut bytes_since_persist: u64 = 0;

        // ── Resume: hash bytes 0..resume_offset (read but don't send) ────
        if resume_offset > 0 {
            println!(
                "↻ Hashing first {} bytes for incremental checksum…",
                resume_offset
            );
            let mut hashed: u64 = 0;
            while hashed < resume_offset {
                use tokio::io::AsyncReadExt;
                let to_read =
                    std::cmp::min(CHUNK_SIZE as u64, resume_offset - hashed) as usize;
                let bytes_read = file
                    .read(&mut buffer[..to_read])
                    .await
                    .map_err(|e| format!("Failed to read file for hash catchup: {}", e))?;
                if bytes_read == 0 {
                    break;
                }
                hasher.update(&buffer[..bytes_read]);
                hashed += bytes_read as u64;
            }
            offset = resume_offset;
            println!("✓ Hash catchup complete, streaming from offset {}", offset);
        } else {
            offset = 0;
        }

        loop {
            // Check if transfer was cancelled or paused
            {
                let transfers_lock = transfers.lock().await;
                if let Some(current) = transfers_lock.get(&transfer.id) {
                    match current.status {
                        TransferStatus::Cancelled => {
                            println!("Transfer cancelled: {}", transfer.id);
                            // Persist final progress so the UI shows accurate data
                            let now = chrono::Utc::now().timestamp();
                            let _ = db::transfers::update_transfer_progress(
                                &db, &transfer.id, offset, now,
                            ).await;
                            return Ok(());
                        }
                        TransferStatus::Paused => {
                            println!("Transfer paused at offset {}: {}", offset, transfer.id);
                            // Persist progress so resume can pick up from here
                            let now = chrono::Utc::now().timestamp();
                            let _ = db::transfers::update_transfer_progress(
                                &db, &transfer.id, offset, now,
                            ).await;
                            return Ok(());
                        }
                        _ => {}
                    }
                }
            }

            // Read chunk from file
            use tokio::io::AsyncReadExt;
            let bytes_read = file
                .read(&mut buffer)
                .await
                .map_err(|e| format!("Failed to read file: {}", e))?;

            if bytes_read == 0 {
                break; // EOF
            }

            // Update incremental checksum
            hasher.update(&buffer[..bytes_read]);

            // Periodically persist progress to DB so resume works after crash
            bytes_since_persist += bytes_read as u64;
            if bytes_since_persist >= PROGRESS_PERSIST_INTERVAL {
                bytes_since_persist = 0;
                let now = chrono::Utc::now().timestamp();
                if let Err(e) =
                    db::transfers::update_transfer_progress(&db, &transfer.id, offset + bytes_read as u64, now)
                        .await
                {
                    eprintln!("⚠️  DB progress persist failed: {}", e);
                }
            }

            // Create file data header
            let header = FileDataHeader {
                transfer_id_len: transfer.id.len() as u8,
                transfer_id: transfer.id.clone(),
                offset,
                chunk_size: bytes_read as u32,
            };

            // Combine header and data
            let mut payload = header.encode();
            payload.extend_from_slice(&buffer[..bytes_read]);

            // Send chunk
            tcp_client
                .send_file_data(&transfer.to_device_id, &peer_address, tcp_port, payload)
                .await?;

            // Update progress
            offset += bytes_read as u64;
            transfer.transferred = offset;
            transfer.updated_at = chrono::Utc::now().timestamp();

            // Update metrics
            let elapsed_ms = start_time.elapsed().as_millis() as u64;
            transfer.update_metrics(elapsed_ms);

            // Update stored transfer
            {
                let mut transfers_lock = transfers.lock().await;
                if let Some(t) = transfers_lock.get_mut(&transfer.id) {
                    t.transferred = transfer.transferred;
                    t.speed_bps = transfer.speed_bps;
                    t.eta_seconds = transfer.eta_seconds;
                    t.updated_at = transfer.updated_at;
                }
            }

            // Emit progress event with expected fields
            let _ = app_handle.emit(
                "transfer-progress",
                serde_json::json!({
                    "transfer_id": transfer.id,
                    "transferred": transfer.transferred,
                    "total": transfer.size,
                    "speed_bps": transfer.speed_bps,
                    "eta_seconds": transfer.eta_seconds,
                }),
            );
        }

        // Finalize checksum
        let checksum = format!("{:x}", hasher.finalize());

        // Send completion notification
        let complete = FileCompletePayload {
            msg_type: "FILE_COMPLETE".to_string(),
            transfer_id: transfer.id.clone(),
            checksum: checksum.clone(),
        };

        let complete_bytes = serialize_json(&complete)?;
        tcp_client
            .send_file_complete(
                &transfer.to_device_id,
                &peer_address,
                tcp_port,
                complete_bytes,
            )
            .await?;

        // Mark as completed in memory
        {
            let mut transfers_lock = transfers.lock().await;
            if let Some(t) = transfers_lock.get_mut(&transfer.id) {
                t.status = TransferStatus::Completed;
                t.checksum = Some(checksum.clone());
                t.updated_at = chrono::Utc::now().timestamp();
                transfer = t.clone();
            }
        }

        // Persist sender-side completion to DB
        if let Err(e) = db::transfers::complete_transfer(
            &db,
            &transfer.id,
            transfer.size,
            &checksum,
            transfer.updated_at,
        )
        .await
        {
            eprintln!("⚠️  DB complete_transfer (sender) failed: {}", e);
        }

        let elapsed = start_time.elapsed().as_secs_f64();
        let speed_mbps = if elapsed > 0.0 {
            (transfer.size as f64 / elapsed) / (1024.0 * 1024.0)
        } else {
            0.0
        };
        println!(
            "✓ File transfer completed: {} ({:.2} MB/s)",
            transfer.filename, speed_mbps
        );

        let _ = app_handle.emit(
            "transfer-completed",
            serde_json::json!({
                "transfer_id": transfer.id,
                "checksum": checksum,
            }),
        );
        Ok(())
    }

    /// Calculate SHA-256 checksum of a file
    async fn calculate_checksum(file_path: &str) -> Result<String, String> {
        tokio::task::spawn_blocking({
            let path = file_path.to_string();
            move || -> Result<String, String> {
                let mut file = File::open(&path)
                    .map_err(|e| format!("Failed to open file for checksum: {}", e))?;

                let mut hasher = Sha256::new();
                let mut buffer = vec![0u8; CHUNK_SIZE];

                loop {
                    let bytes_read = file
                        .read(&mut buffer)
                        .map_err(|e| format!("Failed to read file: {}", e))?;

                    if bytes_read == 0 {
                        break;
                    }

                    hasher.update(&buffer[..bytes_read]);
                }

                let hash = hasher.finalize();
                Ok(format!("{:x}", hash))
            }
        })
        .await
        .map_err(|e| format!("Checksum task failed: {}", e))?
    }

    /// Receive incoming file request (or resume request when `resume_offset > 0`).
    pub async fn receive_file_request(
        &self,
        payload: FileRequestPayload,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let is_resume = payload.resume_offset > 0;

        // ── Resume path: auto-accept without prompting the user ──────────
        if is_resume {
            let mut transfers = self.transfers.lock().await;
            if let Some(existing) = transfers.get_mut(&payload.transfer_id) {
                // Verify the partial file exists and has the expected bytes
                if let Some(ref file_path) = existing.file_path {
                    let partial_size = std::fs::metadata(file_path)
                        .map(|m| m.len())
                        .unwrap_or(0);

                    if partial_size < payload.resume_offset {
                        // Partial file is smaller than the claimed offset —
                        // tell the sender to resume from what we actually have.
                        existing.transferred = partial_size;
                    } else {
                        existing.transferred = payload.resume_offset;
                    }
                }

                existing.status = TransferStatus::InProgress;
                existing.updated_at = chrono::Utc::now().timestamp();

                let now = existing.updated_at;
                let confirmed_offset = existing.transferred;
                let transfer_id = existing.id.clone();

                println!(
                    "↻ Auto-accepted resume for transfer {} at offset {}",
                    transfer_id, confirmed_offset
                );

                // Persist status
                drop(transfers);
                if let Err(e) = db::transfers::update_transfer_status(
                    &self.db,
                    &transfer_id,
                    &TransferStatus::InProgress,
                    now,
                )
                .await
                {
                    eprintln!("⚠️  DB update_transfer_status (resume) failed: {}", e);
                }

                // Emit event so UI updates immediately
                let _ = app_handle.emit(
                    "transfer-resumed",
                    serde_json::json!({
                        "transfer_id": transfer_id,
                        "resume_offset": confirmed_offset,
                    }),
                );

                return Ok(());
            }
            // If we don't have the transfer in cache, fall through to create
            // it as a fresh transfer (the resume offset will be ignored on
            // the receiver side since we have no partial data).
            println!(
                "⚠️  Resume requested for unknown transfer {}, treating as fresh",
                payload.transfer_id
            );
        }

        // ── Fresh transfer path ──────────────────────────────────────────
        let checksum = if payload.checksum.is_empty() {
            None
        } else {
            Some(payload.checksum)
        };

        let transfer = FileTransfer {
            id: payload.transfer_id.clone(),
            filename: payload.filename,
            file_path: None,
            size: payload.file_size,
            transferred: 0,
            status: TransferStatus::AwaitingAcceptance,
            from_device_id: payload.from_device_id,
            to_device_id: payload.to_device_id,
            checksum,
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
            speed_bps: 0.0,
            eta_seconds: None,
        };

        // Persist to SQLite
        if let Err(e) = db::transfers::insert_transfer(&self.db, &transfer).await {
            eprintln!("⚠️  DB insert_transfer (receive) failed: {}", e);
        }

        let mut transfers = self.transfers.lock().await;
        transfers.insert(transfer.id.clone(), transfer.clone());

        println!("✓ Received file request: {}", transfer.filename);
        let _ = app_handle.emit("file-request-received", &transfer);
        Ok(())
    }

    /// Accept an incoming file transfer
    pub async fn accept_transfer(&self, transfer_id: &str) -> Result<(), String> {
        let now = chrono::Utc::now().timestamp();
        let file_path_str;

        {
            let mut transfers = self.transfers.lock().await;
            let transfer = transfers.get_mut(transfer_id).ok_or("Transfer not found")?;

            if transfer.status != TransferStatus::AwaitingAcceptance {
                return Err("Transfer is not awaiting acceptance".to_string());
            }

            let file_path = self.transfer_dir.join(&transfer.filename);
            file_path_str = file_path.to_string_lossy().to_string();

            transfer.file_path = Some(file_path_str.clone());
            transfer.status = TransferStatus::InProgress;
            transfer.updated_at = now;
        }

        // Persist file path and status to DB
        if let Err(e) =
            db::transfers::update_transfer_file_path(&self.db, transfer_id, &file_path_str, now)
                .await
        {
            eprintln!("⚠️  DB update_transfer_file_path failed: {}", e);
        }
        if let Err(e) = db::transfers::update_transfer_status(
            &self.db,
            transfer_id,
            &TransferStatus::InProgress,
            now,
        )
        .await
        {
            eprintln!("⚠️  DB update_transfer_status (accept) failed: {}", e);
        }

        println!("✓ Accepted file transfer: {}", transfer_id);
        Ok(())
    }

    /// Reject an incoming file transfer
    pub async fn reject_transfer(&self, transfer_id: &str) -> Result<(), String> {
        let now = chrono::Utc::now().timestamp();

        {
            let mut transfers = self.transfers.lock().await;
            let transfer = transfers.get_mut(transfer_id).ok_or("Transfer not found")?;

            if transfer.status != TransferStatus::AwaitingAcceptance {
                return Err("Transfer is not awaiting acceptance".to_string());
            }

            transfer.status = TransferStatus::Rejected;
            transfer.updated_at = now;
        }

        if let Err(e) = db::transfers::update_transfer_status(
            &self.db,
            transfer_id,
            &TransferStatus::Rejected,
            now,
        )
        .await
        {
            eprintln!("⚠️  DB update_transfer_status (reject) failed: {}", e);
        }

        println!("✓ Rejected file transfer: {}", transfer_id);
        Ok(())
    }

    /// Receive a file data chunk
    pub async fn receive_file_chunk(
        &self,
        payload: Vec<u8>,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        // Decode header
        let (header, header_size) = FileDataHeader::decode(&payload)
            .map_err(|e| format!("Failed to decode file data header: {}", e))?;

        let data = &payload[header_size..];

        // Get transfer
        let mut transfers = self.transfers.lock().await;
        let transfer = transfers
            .get_mut(&header.transfer_id)
            .ok_or("Transfer not found")?;

        if transfer.status != TransferStatus::InProgress {
            // If the receiver hasn't accepted yet, silently drop the chunk.
            // The sender should be waiting for acceptance, but in edge cases
            // a stale chunk may arrive.
            if transfer.status == TransferStatus::AwaitingAcceptance {
                return Ok(());
            }
            return Err(format!(
                "Transfer is not in progress: {:?}",
                transfer.status
            ));
        }

        // Write to file
        let file_path = transfer
            .file_path
            .as_ref()
            .ok_or("File path not set")?
            .clone();

        let transfer_size = transfer.size;
        drop(transfers); // Release lock before I/O

        // Append data to file
        tokio::task::spawn_blocking({
            let path = file_path.clone();
            let data = data.to_vec();
            let offset = header.offset;
            move || -> Result<(), String> {
                let mut file = std::fs::OpenOptions::new()
                    .create(true)
                    .write(true)
                    .open(&path)
                    .map_err(|e| format!("Failed to open file: {}", e))?;

                file.seek(SeekFrom::Start(offset))
                    .map_err(|e| format!("Failed to seek: {}", e))?;

                file.write_all(&data)
                    .map_err(|e| format!("Failed to write: {}", e))?;

                Ok(())
            }
        })
        .await
        .map_err(|e| format!("File write task failed: {}", e))??;

        // Update progress
        let new_transferred = header.offset + header.chunk_size as u64;
        let mut transfers = self.transfers.lock().await;
        if let Some(transfer) = transfers.get_mut(&header.transfer_id) {
            let prev_transferred = transfer.transferred;
            transfer.transferred = new_transferred;
            transfer.updated_at = chrono::Utc::now().timestamp();

            // Periodically persist receiver-side progress so resume works
            let crossed_boundary = prev_transferred / PROGRESS_PERSIST_INTERVAL
                != new_transferred / PROGRESS_PERSIST_INTERVAL;
            if crossed_boundary {
                let now = transfer.updated_at;
                let tid = transfer.id.clone();
                let db = Arc::clone(&self.db);
                let transferred = transfer.transferred;
                // Spawn to avoid holding lock during DB write
                tokio::spawn(async move {
                    if let Err(e) =
                        db::transfers::update_transfer_progress(&db, &tid, transferred, now).await
                    {
                        eprintln!("⚠️  DB receiver progress persist failed: {}", e);
                    }
                });
            }

            // Emit progress event with expected fields
            let _ = app_handle.emit(
                "transfer-progress",
                serde_json::json!({
                    "transfer_id": header.transfer_id,
                    "transferred": transfer.transferred,
                    "total": transfer_size,
                    "speed_bps": transfer.speed_bps,
                    "eta_seconds": transfer.eta_seconds,
                }),
            );
        }

        Ok(())
    }

    /// Handle transfer completion
    pub async fn handle_complete(
        &self,
        payload: FileCompletePayload,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let now = chrono::Utc::now().timestamp();
        let filename;

        // Verify checksum and mark completed in the in-memory cache first
        {
            let mut transfers = self.transfers.lock().await;
            let transfer = transfers
                .get_mut(&payload.transfer_id)
                .ok_or("Transfer not found")?;

            if !payload.checksum.is_empty() {
                if let Some(file_path) = &transfer.file_path {
                    let calculated_checksum = Self::calculate_checksum(file_path).await?;
                    if calculated_checksum != payload.checksum {
                        transfer.status = TransferStatus::Failed;
                        let _ = app_handle.emit(
                            "transfer-failed",
                            serde_json::json!({
                                "transfer_id": payload.transfer_id,
                                "error": "Checksum verification failed",
                            }),
                        );
                        // Persist failure
                        let _ = db::transfers::update_transfer_status(
                            &self.db,
                            &payload.transfer_id,
                            &TransferStatus::Failed,
                            now,
                        )
                        .await;
                        return Err("Checksum verification failed".to_string());
                    }
                }
            }

            transfer.status = TransferStatus::Completed;
            transfer.checksum = Some(payload.checksum.clone());
            transfer.updated_at = now;
            filename = transfer.filename.clone();
        }

        // Persist to DB
        if let Err(e) = db::transfers::complete_transfer(
            &self.db,
            &payload.transfer_id,
            // fetch transferred from cache
            self.transfers
                .lock()
                .await
                .get(&payload.transfer_id)
                .map(|t| t.transferred)
                .unwrap_or(0),
            &payload.checksum,
            now,
        )
        .await
        {
            eprintln!("⚠️  DB complete_transfer failed: {}", e);
        }

        println!("✓ File transfer completed and verified: {}", filename);
        let _ = app_handle.emit(
            "transfer-completed",
            serde_json::json!({
                "transfer_id": payload.transfer_id,
                "checksum": payload.checksum,
            }),
        );

        Ok(())
    }

    /// Pause a transfer
    pub async fn pause_transfer(&self, transfer_id: &str) -> Result<(), String> {
        let now = chrono::Utc::now().timestamp();
        Self::update_status(&self.transfers, transfer_id, TransferStatus::Paused).await;
        if let Err(e) =
            db::transfers::update_transfer_status(&self.db, transfer_id, &TransferStatus::Paused, now)
                .await
        {
            eprintln!("⚠️  DB pause_transfer failed: {}", e);
        }
        Ok(())
    }

    /// Cancel a transfer
    pub async fn cancel_transfer(&self, transfer_id: &str) -> Result<(), String> {
        let now = chrono::Utc::now().timestamp();
        Self::update_status(&self.transfers, transfer_id, TransferStatus::Cancelled).await;
        if let Err(e) = db::transfers::update_transfer_status(
            &self.db,
            transfer_id,
            &TransferStatus::Cancelled,
            now,
        )
        .await
        {
            eprintln!("⚠️  DB cancel_transfer failed: {}", e);
        }
        Ok(())
    }

    /// Get all transfers — reads from SQLite (authoritative) and merges with
    /// live in-memory progress data for active transfers.
    pub async fn get_transfers(&self) -> Vec<FileTransfer> {
        match db::transfers::get_transfers(&self.db).await {
            Ok(mut db_transfers) => {
                // Overlay live progress from the in-memory cache for active transfers
                let cache = self.transfers.lock().await;
                for t in db_transfers.iter_mut() {
                    if let Some(live) = cache.get(&t.id) {
                        if live.status == TransferStatus::InProgress {
                            t.transferred = live.transferred;
                            t.speed_bps = live.speed_bps;
                            t.eta_seconds = live.eta_seconds;
                        }
                    }
                }
                db_transfers
            }
            Err(e) => {
                eprintln!("⚠️  DB get_transfers failed: {}", e);
                // Fall back to in-memory cache
                self.transfers.lock().await.values().cloned().collect()
            }
        }
    }

    /// Get a specific transfer
    pub async fn get_transfer(&self, transfer_id: &str) -> Option<FileTransfer> {
        let transfers = self.transfers.lock().await;
        transfers.get(transfer_id).cloned()
    }

    /// Update transfer status
    async fn update_status(
        transfers: &Arc<Mutex<HashMap<String, FileTransfer>>>,
        transfer_id: &str,
        status: TransferStatus,
    ) {
        let mut transfers_lock = transfers.lock().await;
        if let Some(transfer) = transfers_lock.get_mut(transfer_id) {
            transfer.status = status;
            transfer.updated_at = chrono::Utc::now().timestamp();
        }
    }

    /// Get active transfer count
    pub async fn active_count(&self) -> usize {
        let active = self.active_transfers.lock().await;
        *active
    }

    /// Clear all in-memory transfers and wipe the DB table.
    ///
    /// Called by the `clear_all_data` IPC command when the user resets the app.
    pub async fn clear_all(&self) {
        self.transfers.lock().await.clear();
        *self.active_transfers.lock().await = 0;
        if let Err(e) = db::transfers::clear_transfers(&self.db).await {
            eprintln!("⚠️  DB clear_transfers failed: {}", e);
        }
        println!("✓ Cleared all file transfers");
    }
}

impl Clone for FileTransferService {
    fn clone(&self) -> Self {
        Self {
            transfers: Arc::clone(&self.transfers),
            db: Arc::clone(&self.db),
            transfer_dir: self.transfer_dir.clone(),
            tcp_client: self.tcp_client.clone(),
            tcp_port: self.tcp_port,
            active_transfers: Arc::clone(&self.active_transfers),
        }
    }
}
