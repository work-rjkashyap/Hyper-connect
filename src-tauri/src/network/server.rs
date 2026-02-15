//! TCP Server
//!
//! High-performance TCP server with encryption support.
//! Handles both secure (encrypted) and plaintext (legacy) connections.

use crate::crypto::{decrypt_message, Session, StreamDecryptor, STREAM_BUFFER_SIZE};
use crate::network::file_transfer::FileTransferService;
use crate::network::protocol::{
    deserialize_json, FileCancelPayload, FileCompletePayload, FileDataHeader, FileRejectPayload,
    FileRequestPayload, Frame, HeartbeatPayload, HelloPayload, MessageType, TextMessagePayload,
};
use crate::network::secure_channel::SecureChannelManager;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;

/// Receive buffer size (256KB for efficient message handling)
const RECV_BUFFER_SIZE: usize = 256 * 1024;

/// Send buffer size (256KB for efficient message handling)
const SEND_BUFFER_SIZE: usize = 256 * 1024;

/// Keep-alive interval in seconds
const KEEPALIVE_INTERVAL_SECS: u64 = 30;

/// TCP Server with encryption support
pub struct TcpServer {
    file_transfer_service: Arc<Mutex<FileTransferService>>,
    secure_channel_manager: Arc<SecureChannelManager>,
}

impl TcpServer {
    /// Create a new TCP server with encryption support
    pub fn new(
        file_transfer_service: Arc<Mutex<FileTransferService>>,
        local_device_id: String,
        display_name: String,
        platform: String,
        app_version: String,
    ) -> Self {
        let secure_channel_manager = Arc::new(SecureChannelManager::new(
            local_device_id,
            display_name,
            platform,
            app_version,
        ));

        Self {
            file_transfer_service,
            secure_channel_manager,
        }
    }

    /// Start the TCP server
    ///
    /// # Arguments
    /// * `port` - Port to bind to
    /// * `app_handle` - Tauri app handle for event emission
    ///
    /// # Returns
    /// * `Result<(), String>` - Success or error
    pub async fn start(&self, port: u16, app_handle: AppHandle) -> Result<(), String> {
        let addr = format!("0.0.0.0:{}", port);
        let listener = TcpListener::bind(&addr)
            .await
            .map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;

        println!("✓ TCP server listening on {}", addr);

        // Clone what we need for the accept loop
        let file_transfer = Arc::clone(&self.file_transfer_service);
        let secure_channel = Arc::clone(&self.secure_channel_manager);

        // Spawn accept loop
        tokio::spawn(async move {
            loop {
                match listener.accept().await {
                    Ok((stream, peer_addr)) => {
                        println!("→ New connection from {}", peer_addr);

                        let file_transfer_clone = Arc::clone(&file_transfer);
                        let app_clone = app_handle.clone();
                        let secure_channel_clone = Arc::clone(&secure_channel);

                        // Spawn connection handler
                        tokio::spawn(async move {
                            if let Err(e) = Self::handle_connection(
                                stream,
                                peer_addr,
                                file_transfer_clone,
                                app_clone,
                                secure_channel_clone,
                            )
                            .await
                            {
                                eprintln!("Connection error from {}: {}", peer_addr, e);
                            } else {
                                println!("✓ Connection closed: {}", peer_addr);
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

    /// Handle an incoming connection with encryption support
    async fn handle_connection(
        stream: TcpStream,
        peer_addr: SocketAddr,
        file_transfer_service: Arc<Mutex<FileTransferService>>,
        app_handle: AppHandle,
        secure_channel_manager: Arc<SecureChannelManager>,
    ) -> Result<(), String> {
        // Optimize socket
        Self::optimize_socket(&stream)?;

        // Create buffered reader
        let mut reader = BufReader::with_capacity(RECV_BUFFER_SIZE, stream);

        // Read first frame to determine if secure handshake
        let first_frame = match Frame::decode_async(&mut reader).await {
            Ok(frame) => frame,
            Err(e) => return Err(format!("Failed to read first frame: {}", e)),
        };

        // Check if this is a secure handshake
        if first_frame.message_type == MessageType::HelloSecure {
            println!("🔒 Secure handshake initiated from {}", peer_addr);

            // Handle secure handshake and establish encrypted session
            Self::handle_secure_connection(
                reader,
                first_frame,
                peer_addr,
                secure_channel_manager,
                file_transfer_service,
                app_handle,
            )
            .await
        } else {
            // Fallback to plaintext connection (backward compatibility)
            println!(
                "⚠️ Plaintext connection from {} (encryption recommended)",
                peer_addr
            );

            // Emit security warning
            let _ = app_handle.emit(
                "security-warning",
                serde_json::json!({
                    "message": "Plaintext connection detected",
                    "peer": peer_addr.to_string(),
                }),
            );

            Self::handle_plaintext_connection(
                reader,
                first_frame,
                peer_addr,
                file_transfer_service,
                app_handle,
            )
            .await
        }
    }

    /// Handle secure (encrypted) connection
    async fn handle_secure_connection(
        mut reader: BufReader<TcpStream>,
        hello_frame: Frame,
        peer_addr: SocketAddr,
        secure_channel_manager: Arc<SecureChannelManager>,
        file_transfer_service: Arc<Mutex<FileTransferService>>,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        use crate::crypto::HelloSecure;

        // Deserialize HELLO_SECURE
        let hello: HelloSecure = serde_json::from_slice(&hello_frame.payload)
            .map_err(|e| format!("Invalid HELLO_SECURE: {}", e))?;

        let peer_device_id = hello.device_id.clone();
        println!("🔑 Received HELLO_SECURE from {}", peer_device_id);

        // We need to parse the hello first to handle it properly
        // The secure channel manager expects to read the hello itself
        // So we need to recreate the frame or adjust our approach

        // For now, let's manually handle the handshake here
        // This avoids the complex double-read issue

        use crate::crypto::HandshakeManager;

        let handshake_manager = HandshakeManager::new();

        // Clone hello for response generation
        let public_key = hello.public_key.clone();

        // Generate response
        let response = handshake_manager.handle_hello_secure(
            hello,
            &secure_channel_manager.local_device_id,
            &secure_channel_manager.display_name,
            &secure_channel_manager.platform,
            &secure_channel_manager.app_version,
        )?;

        // Send HELLO_RESPONSE
        let response_json = serde_json::to_vec(&response)
            .map_err(|e| format!("Failed to serialize response: {}", e))?;
        let response_frame = Frame::new(MessageType::HelloResponse, response_json);

        let stream = reader.get_mut();
        stream
            .write_all(&response_frame.encode())
            .await
            .map_err(|e| format!("Failed to send response: {}", e))?;
        stream
            .flush()
            .await
            .map_err(|e| format!("Failed to flush: {}", e))?;

        // Finalize handshake and get session
        let session = handshake_manager.finalize_handshake(&peer_device_id, &public_key)?;

        println!("✓ Secure session established with {}", peer_device_id);

        // Emit device-connected event
        let _ = app_handle.emit(
            "device-connected",
            serde_json::json!({
                "device_id": peer_device_id,
                "address": peer_addr.to_string(),
                "encrypted": true,
            }),
        );

        // Handle encrypted session
        let result = Self::handle_encrypted_session(
            reader,
            session,
            peer_device_id.clone(),
            file_transfer_service,
            app_handle.clone(),
        )
        .await;

        // Clean up session on disconnect
        secure_channel_manager.remove_session(&peer_device_id).await;
        let _ = app_handle.emit("device-disconnected", peer_device_id);

        result
    }

    /// Handle encrypted session (all messages encrypted)
    async fn handle_encrypted_session(
        mut reader: BufReader<TcpStream>,
        session: Session,
        peer_device_id: String,
        file_transfer_service: Arc<Mutex<FileTransferService>>,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        loop {
            let frame = match tokio::time::timeout(
                Duration::from_secs(120),
                Frame::decode_async(&mut reader),
            )
            .await
            {
                Ok(Ok(frame)) => frame,
                Ok(Err(e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => {
                    return Ok(()); // Connection closed gracefully
                }
                Ok(Err(e)) => return Err(format!("Failed to read frame: {}", e)),
                Err(_) => return Err("Connection timeout".to_string()),
            };

            match frame.message_type {
                MessageType::EncryptedMessage => {
                    // Decrypt and handle message
                    Self::handle_encrypted_message(&session, &frame, &app_handle).await?;
                }
                MessageType::FileStreamInit => {
                    // Handle encrypted file stream
                    Self::handle_encrypted_file_stream(
                        &mut reader,
                        &session,
                        &frame,
                        &file_transfer_service,
                        &app_handle,
                    )
                    .await?;
                }
                MessageType::Heartbeat => {
                    // Heartbeat is allowed unencrypted
                    println!("💓 Heartbeat from {}", peer_device_id);
                }
                _ => {
                    eprintln!(
                        "⚠️ Unexpected message type in encrypted session: {:?}",
                        frame.message_type
                    );
                    // Close connection on protocol violation
                    return Err("Protocol violation in encrypted session".to_string());
                }
            }
        }
    }

    /// Handle encrypted message (decrypt and route)
    async fn handle_encrypted_message(
        session: &Session,
        frame: &Frame,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        use crate::crypto::EncryptedMessagePayload;

        // Deserialize encrypted payload
        let encrypted: EncryptedMessagePayload = serde_json::from_slice(&frame.payload)
            .map_err(|e| format!("Invalid encrypted message: {}", e))?;

        // Decrypt
        let plaintext_json = decrypt_message(session, &encrypted).map_err(|e| {
            // CRITICAL: Emit security error and abort
            eprintln!("🔒 SECURITY ERROR: Decryption failed: {}", e);
            let _ = app_handle.emit(
                "security-error",
                serde_json::json!({
                    "error": e,
                }),
            );
            format!("Decryption failed: {}", e)
        })?;

        // Parse inner message type
        let value: serde_json::Value = serde_json::from_str(&plaintext_json)
            .map_err(|e| format!("Invalid JSON in decrypted message: {}", e))?;

        // Route based on inner message type
        match value.get("type").and_then(|v| v.as_str()) {
            Some("TEXT_MESSAGE") => {
                let msg: TextMessagePayload = serde_json::from_str(&plaintext_json)
                    .map_err(|e| format!("Invalid TEXT_MESSAGE: {}", e))?;
                println!("💬 Decrypted text message from {}", msg.from_device_id);
                let _ = app_handle.emit("message-received", msg);
            }
            Some("FILE_REQUEST") => {
                let req: FileRequestPayload = serde_json::from_str(&plaintext_json)
                    .map_err(|e| format!("Invalid FILE_REQUEST: {}", e))?;
                println!("📎 Decrypted file request from {}", req.from_device_id);
                let _ = app_handle.emit("file-request-received", req);
            }
            Some("FILE_COMPLETE") => {
                let complete: FileCompletePayload = serde_json::from_str(&plaintext_json)
                    .map_err(|e| format!("Invalid FILE_COMPLETE: {}", e))?;
                println!("✅ Decrypted file complete: {}", complete.transfer_id);
                let _ = app_handle.emit("transfer-completed", complete);
            }
            Some("FILE_CANCEL") => {
                let cancel: FileCancelPayload = serde_json::from_str(&plaintext_json)
                    .map_err(|e| format!("Invalid FILE_CANCEL: {}", e))?;
                println!("🛑 Decrypted file cancel: {}", cancel.transfer_id);
                let _ = app_handle.emit("file-cancelled", cancel);
            }
            Some("FILE_REJECT") => {
                let reject: FileRejectPayload = serde_json::from_str(&plaintext_json)
                    .map_err(|e| format!("Invalid FILE_REJECT: {}", e))?;
                println!("❌ Decrypted file reject: {}", reject.transfer_id);
                let _ = app_handle.emit("file-rejected", reject);
            }
            _ => {
                return Err("Unknown message type in encrypted message".to_string());
            }
        }

        Ok(())
    }

    /// Handle encrypted file stream
    async fn handle_encrypted_file_stream(
        reader: &mut BufReader<TcpStream>,
        session: &Session,
        init_frame: &Frame,
        file_transfer_service: &Arc<Mutex<FileTransferService>>,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        use crate::crypto::FileStreamInit;

        // Deserialize FILE_STREAM_INIT
        let init: FileStreamInit = serde_json::from_slice(&init_frame.payload)
            .map_err(|e| format!("Invalid FILE_STREAM_INIT: {}", e))?;

        println!(
            "🔒 Receiving encrypted file stream: {} ({} bytes)",
            init.transfer_id, init.file_size
        );

        // Create decryptor with IV from init message
        let mut decryptor = StreamDecryptor::new(session, &init.iv, STREAM_BUFFER_SIZE);

        // Get output path from file transfer service
        let output_path = {
            let _service = file_transfer_service.lock().await;
            // TODO: Get actual output path from transfer metadata
            format!("/tmp/{}", init.transfer_id)
        };

        // Open output file
        let mut file = tokio::fs::File::create(&output_path)
            .await
            .map_err(|e| format!("Failed to create output file: {}", e))?;

        let mut total_received = 0u64;

        // Receive and decrypt file chunks
        while total_received < init.file_size {
            let frame = Frame::decode_async(reader)
                .await
                .map_err(|e| format!("Failed to read file chunk: {}", e))?;

            if frame.message_type != MessageType::FileData {
                return Err(format!("Expected FILE_DATA, got {:?}", frame.message_type));
            }

            // Decrypt chunk using the stream decryptor
            // The decryptor decrypts in-place by applying the cipher
            let mut chunk = frame.payload.clone();
            decryptor.cipher.apply(&mut chunk);

            // Write plaintext to file
            file.write_all(&chunk)
                .await
                .map_err(|e| format!("Failed to write to file: {}", e))?;

            total_received += chunk.len() as u64;

            // Emit progress event
            let _ = app_handle.emit(
                "transfer-progress",
                serde_json::json!({
                    "transfer_id": init.transfer_id,
                    "transferred": total_received,
                    "total": init.file_size,
                }),
            );
        }

        println!(
            "✅ Encrypted file received and decrypted: {} bytes",
            total_received
        );

        Ok(())
    }

    /// Handle plaintext (legacy) connection
    async fn handle_plaintext_connection(
        mut reader: BufReader<TcpStream>,
        first_frame: Frame,
        _peer_addr: SocketAddr,
        file_transfer_service: Arc<Mutex<FileTransferService>>,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        // Track peer device ID (learned from HELLO or first message)
        let mut peer_device_id: Option<String> = None;

        // Process the first frame
        Self::handle_plaintext_frame(
            &first_frame,
            &mut peer_device_id,
            &file_transfer_service,
            &app_handle,
        )
        .await?;

        // Continue with regular message loop for plaintext
        loop {
            let frame = match tokio::time::timeout(
                Duration::from_secs(120),
                Frame::decode_async(&mut reader),
            )
            .await
            {
                Ok(Ok(frame)) => frame,
                Ok(Err(e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => {
                    if let Some(device_id) = peer_device_id {
                        let _ = app_handle.emit("device-disconnected", device_id);
                    }
                    return Ok(());
                }
                Ok(Err(e)) => return Err(format!("Failed to read frame: {}", e)),
                Err(_) => return Err("Connection timeout".to_string()),
            };

            Self::handle_plaintext_frame(
                &frame,
                &mut peer_device_id,
                &file_transfer_service,
                &app_handle,
            )
            .await?;
        }
    }

    /// Handle plaintext frame (backward compatibility)
    async fn handle_plaintext_frame(
        frame: &Frame,
        peer_device_id: &mut Option<String>,
        file_transfer_service: &Arc<Mutex<FileTransferService>>,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        // Process frame based on message type
        match frame.message_type {
            MessageType::Hello => {
                *peer_device_id = Self::handle_hello(frame, app_handle).await?;
            }
            MessageType::TextMessage => {
                Self::handle_text_message(frame, app_handle).await?;
            }
            MessageType::FileRequest => {
                Self::handle_file_request(frame, file_transfer_service, app_handle).await?;
            }
            MessageType::FileData => {
                Self::handle_file_data(frame, file_transfer_service, app_handle).await?;
            }
            MessageType::FileAck => {
                // File acknowledgments can be handled if implementing windowing
                // For now, we're doing simple streaming
            }
            MessageType::FileComplete => {
                Self::handle_file_complete(frame, file_transfer_service, app_handle).await?;
            }
            MessageType::FileCancel => {
                Self::handle_file_cancel(frame, app_handle).await?;
            }
            MessageType::FileReject => {
                Self::handle_file_reject(frame, app_handle).await?;
            }
            MessageType::Heartbeat => {
                Self::handle_heartbeat(frame).await?;
            }
            MessageType::Error => {
                eprintln!("Received error message from peer");
            }
            _ => {
                eprintln!("Unknown message type: {:?}", frame.message_type);
            }
        }

        Ok(())
    }

    /// Optimize TCP socket for maximum performance
    fn optimize_socket(stream: &TcpStream) -> Result<(), String> {
        // Disable Nagle's algorithm for low latency
        stream
            .set_nodelay(true)
            .map_err(|e| format!("Failed to set TCP_NODELAY: {}", e))?;

        // Use socket2 for buffer size operations
        let socket_ref = socket2::SockRef::from(stream);

        // Set large send buffer for high throughput
        if let Err(e) = socket_ref.set_send_buffer_size(SEND_BUFFER_SIZE) {
            eprintln!("Warning: Failed to set send buffer size: {}", e);
        }

        // Set large receive buffer
        if let Err(e) = socket_ref.set_recv_buffer_size(RECV_BUFFER_SIZE) {
            eprintln!("Warning: Failed to set recv buffer size: {}", e);
        }

        // Enable TCP keepalive
        let keepalive =
            socket2::TcpKeepalive::new().with_time(Duration::from_secs(KEEPALIVE_INTERVAL_SECS));

        if let Err(e) = socket_ref.set_tcp_keepalive(&keepalive) {
            eprintln!("Warning: Failed to set TCP keepalive: {}", e);
        }

        Ok(())
    }

    /// Handle HELLO message
    async fn handle_hello(frame: &Frame, app_handle: &AppHandle) -> Result<Option<String>, String> {
        let payload: HelloPayload = deserialize_json(&frame.payload)?;

        println!(
            "👋 HELLO from {} ({})",
            payload.display_name, payload.device_id
        );

        // Emit device-connected event
        let _ = app_handle.emit(
            "device-connected",
            serde_json::json!({
                "device_id": payload.device_id,
                "display_name": payload.display_name,
                "platform": payload.platform,
                "app_version": payload.app_version,
                "encrypted": false,
            }),
        );

        Ok(Some(payload.device_id))
    }

    /// Handle text message
    async fn handle_text_message(frame: &Frame, app_handle: &AppHandle) -> Result<(), String> {
        let payload: TextMessagePayload = deserialize_json(&frame.payload)?;

        println!(
            "💬 Message from {}: {}",
            payload.from_device_id, payload.content
        );

        let _ = app_handle.emit("message-received", payload);
        Ok(())
    }

    /// Handle file request
    async fn handle_file_request(
        frame: &Frame,
        _file_transfer_service: &Arc<Mutex<FileTransferService>>,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        let payload: FileRequestPayload = deserialize_json(&frame.payload)?;

        println!(
            "📎 File request: {} ({} bytes) from {}",
            payload.filename, payload.file_size, payload.from_device_id
        );

        // Register transfer
        // Note: FileTransferService interface may need adjustment
        // For now, just emit the event

        let _ = app_handle.emit("file-request-received", payload);
        Ok(())
    }

    /// Handle file data chunk
    async fn handle_file_data(
        frame: &Frame,
        _file_transfer_service: &Arc<Mutex<FileTransferService>>,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        // Decode file data header
        let (header, header_size) = FileDataHeader::decode(&frame.payload)
            .map_err(|e| format!("Invalid file data header: {}", e))?;

        let chunk_data = &frame.payload[header_size..];

        // Note: FileTransferService interface may need adjustment
        // For now, just emit the progress

        // Emit progress event
        let _ = app_handle.emit(
            "transfer-progress",
            serde_json::json!({
                "transfer_id": header.transfer_id,
                "offset": header.offset,
                "chunk_size": chunk_data.len(),
            }),
        );

        Ok(())
    }

    /// Handle file complete
    async fn handle_file_complete(
        frame: &Frame,
        _file_transfer_service: &Arc<Mutex<FileTransferService>>,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        let payload: FileCompletePayload = deserialize_json(&frame.payload)?;

        println!("✅ File transfer complete: {}", payload.transfer_id);

        // Note: FileTransferService interface may need adjustment
        // For now, just emit the event

        let _ = app_handle.emit("transfer-completed", payload);
        Ok(())
    }

    /// Handle file cancel
    async fn handle_file_cancel(frame: &Frame, app_handle: &AppHandle) -> Result<(), String> {
        let payload: FileCancelPayload = deserialize_json(&frame.payload)?;

        println!("🛑 File transfer cancelled: {}", payload.transfer_id);

        let _ = app_handle.emit("file-cancelled", payload);
        Ok(())
    }

    /// Handle file reject
    async fn handle_file_reject(frame: &Frame, app_handle: &AppHandle) -> Result<(), String> {
        let payload: FileRejectPayload = deserialize_json(&frame.payload)?;

        println!("❌ File transfer rejected: {}", payload.transfer_id);

        let _ = app_handle.emit("file-rejected", payload);
        Ok(())
    }

    /// Handle heartbeat
    async fn handle_heartbeat(frame: &Frame) -> Result<(), String> {
        let payload: HeartbeatPayload = deserialize_json(&frame.payload)?;
        println!("💓 Heartbeat from {}", payload.device_id);
        Ok(())
    }
}
