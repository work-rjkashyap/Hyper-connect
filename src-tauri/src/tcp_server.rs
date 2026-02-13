use crate::file_transfer::FileTransferService;
use crate::messaging::MessagingService;
use crate::protocol::{
    FileTransferAckPayload, FileTransferChunkPayload, FileTransferCompletePayload,
    FileTransferRequestPayload, Frame, MessageType, TextMessagePayload,
};
use std::sync::Arc;
use tauri::AppHandle;
use tokio::io::BufReader;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;

pub struct TcpServer {
    messaging_service: Arc<Mutex<MessagingService>>,
    file_transfer_service: Arc<Mutex<FileTransferService>>,
}

impl TcpServer {
    pub fn new(
        messaging_service: Arc<Mutex<MessagingService>>,
        file_transfer_service: Arc<Mutex<FileTransferService>>,
    ) -> Self {
        Self {
            messaging_service,
            file_transfer_service,
        }
    }

    /// Start the TCP server on the specified port
    pub async fn start(&mut self, port: u16, app_handle: AppHandle) -> Result<(), String> {
        let addr = format!("0.0.0.0:{}", port);
        let listener = TcpListener::bind(&addr)
            .await
            .map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;

        println!("TCP server started on port {}", port);

        // Clone what we need for the spawned task
        let messaging_service = Arc::clone(&self.messaging_service);
        let file_transfer_service = Arc::clone(&self.file_transfer_service);

        // Spawn the accept loop
        tokio::spawn(async move {
            loop {
                match listener.accept().await {
                    Ok((stream, addr)) => {
                        println!("New connection from: {}", addr);
                        let messaging = Arc::clone(&messaging_service);
                        let file_transfer = Arc::clone(&file_transfer_service);
                        let app = app_handle.clone();

                        tokio::spawn(async move {
                            if let Err(e) =
                                Self::handle_connection(stream, messaging, file_transfer, app)
                                    .await
                            {
                                eprintln!("Error handling connection from {}: {}", addr, e);
                            }
                        });
                    }
                    Err(e) => {
                        eprintln!("Failed to accept connection: {}", e);
                    }
                }
            }
        });

        Ok(())
    }

    /// Handle an incoming connection
    async fn handle_connection(
        stream: TcpStream,
        messaging_service: Arc<Mutex<MessagingService>>,
        file_transfer_service: Arc<Mutex<FileTransferService>>,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let mut reader = BufReader::new(stream);

        loop {
            // Read frame
            let frame = match Frame::decode_async(&mut reader).await {
                Ok(f) => f,
                Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => {
                    // Connection closed
                    println!("Connection closed");
                    break;
                }
                Err(e) => {
                    return Err(format!("Failed to read frame: {}", e));
                }
            };

            // Handle frame based on type
            match frame.message_type {
                MessageType::TextMessage => {
                    Self::handle_text_message(frame, &messaging_service, &app_handle).await?;
                }
                MessageType::FileTransferRequest => {
                    Self::handle_file_transfer_request(
                        frame,
                        &file_transfer_service,
                        &app_handle,
                    )
                    .await?;
                }
                MessageType::FileTransferChunk => {
                    Self::handle_file_chunk(frame, &file_transfer_service, &app_handle).await?;
                }
                MessageType::FileTransferAck => {
                    Self::handle_file_ack(frame, &file_transfer_service, &app_handle).await?;
                }
                MessageType::FileTransferComplete => {
                    Self::handle_file_complete(frame, &file_transfer_service, &app_handle).await?;
                }
                MessageType::Heartbeat => {
                    // Handle heartbeat (currently just log)
                    println!("Received heartbeat");
                }
                MessageType::FileTransferCancel => {
                    // Handle file transfer cancellation
                    println!("Received file transfer cancel");
                }
            }
        }

        Ok(())
    }

    /// Handle incoming text message
    async fn handle_text_message(
        frame: Frame,
        messaging_service: &Arc<Mutex<MessagingService>>,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        let payload: TextMessagePayload = serde_json::from_slice(&frame.payload)
            .map_err(|e| format!("Failed to deserialize text message: {}", e))?;

        println!(
            "Received text message from {}: {}",
            payload.from_device_id, payload.content
        );

        // Store the message using the messaging service
        let messaging = messaging_service.lock().await;
        messaging
            .receive_message_from_network(payload, app_handle.clone())
            .await?;

        Ok(())
    }

    /// Handle incoming file transfer request
    async fn handle_file_transfer_request(
        frame: Frame,
        file_transfer_service: &Arc<Mutex<FileTransferService>>,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        let payload: FileTransferRequestPayload = serde_json::from_slice(&frame.payload)
            .map_err(|e| format!("Failed to deserialize file transfer request: {}", e))?;

        println!(
            "Received file transfer request: {} ({} bytes)",
            payload.filename, payload.file_size
        );

        // Create a transfer record for the incoming file
        let file_transfer = file_transfer_service.lock().await;
        file_transfer
            .receive_file_request(payload, app_handle.clone())
            .await?;

        Ok(())
    }

    /// Handle incoming file chunk
    async fn handle_file_chunk(
        frame: Frame,
        file_transfer_service: &Arc<Mutex<FileTransferService>>,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        let payload: FileTransferChunkPayload = serde_json::from_slice(&frame.payload)
            .map_err(|e| format!("Failed to deserialize file chunk: {}", e))?;

        // Write the chunk to the file
        let file_transfer = file_transfer_service.lock().await;
        file_transfer
            .receive_file_chunk(payload, app_handle.clone())
            .await?;

        Ok(())
    }

    /// Handle incoming file acknowledgment
    async fn handle_file_ack(
        frame: Frame,
        file_transfer_service: &Arc<Mutex<FileTransferService>>,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        let payload: FileTransferAckPayload = serde_json::from_slice(&frame.payload)
            .map_err(|e| format!("Failed to deserialize file ack: {}", e))?;

        println!(
            "Received file ack for transfer {} at offset {}",
            payload.transfer_id, payload.offset
        );

        // Update transfer progress
        let file_transfer = file_transfer_service.lock().await;
        file_transfer
            .handle_ack(payload, app_handle.clone())
            .await?;

        Ok(())
    }

    /// Handle file transfer complete notification
    async fn handle_file_complete(
        frame: Frame,
        file_transfer_service: &Arc<Mutex<FileTransferService>>,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        let payload: FileTransferCompletePayload = serde_json::from_slice(&frame.payload)
            .map_err(|e| format!("Failed to deserialize file complete: {}", e))?;

        println!(
            "Received file complete for transfer {}",
            payload.transfer_id
        );

        // Mark transfer as complete
        let file_transfer = file_transfer_service.lock().await;
        file_transfer
            .handle_complete(payload, app_handle.clone())
            .await?;

        Ok(())
    }
}
