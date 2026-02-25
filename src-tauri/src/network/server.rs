//! TCP Server
//!
//! High-performance TCP server with mandatory encryption.
//! All connections must use the secure handshake (HelloSecure).

use crate::crypto::{decrypt_message, Session};
use crate::discovery::MdnsDiscoveryService;
use crate::messaging::{GroupControlPayload, GroupMessagePayload, GroupService, MessageStatus, MessagingService};
use crate::network::file_transfer::FileTransferService;
use crate::network::protocol::{
    deserialize_json, FileAckPayload, FileCancelPayload, FileCompletePayload,
    FileRejectPayload, FileRequestPayload, Frame, MessageAckPayload, MessageType,
    PingPayload, PongPayload, TextMessagePayload,
};
use crate::network::secure_channel::SecureChannelManager;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use tokio_rustls::server::TlsStream;
use tokio_rustls::TlsAcceptor;

/// Receive buffer size (256KB for efficient message handling)
const RECV_BUFFER_SIZE: usize = 256 * 1024;

/// Send buffer size (256KB for efficient message handling)
const SEND_BUFFER_SIZE: usize = 256 * 1024;

/// Keep-alive interval in seconds
const KEEPALIVE_INTERVAL_SECS: u64 = 30;

/// TCP Server with TLS and encryption support
pub struct TcpServer {
    file_transfer_service: Arc<Mutex<FileTransferService>>,
    secure_channel_manager: Arc<SecureChannelManager>,
    tls_acceptor: TlsAcceptor,
}

impl TcpServer {
    /// Create a new TCP server with TLS and encryption support
    pub fn new(
        file_transfer_service: Arc<Mutex<FileTransferService>>,
        local_device_id: String,
        display_name: String,
        platform: String,
        app_version: String,
        tls_acceptor: TlsAcceptor,
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
            tls_acceptor,
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
        let tls_acceptor = self.tls_acceptor.clone();

        // Spawn accept loop
        tokio::spawn(async move {
            loop {
                match listener.accept().await {
                    Ok((stream, peer_addr)) => {
                        println!("→ New connection from {}", peer_addr);

                        let file_transfer_clone = Arc::clone(&file_transfer);
                        let app_clone = app_handle.clone();
                        let secure_channel_clone = Arc::clone(&secure_channel);
                        let tls_acceptor_clone = tls_acceptor.clone();

                        // Spawn connection handler
                        tokio::spawn(async move {
                            // Optimize socket before TLS
                            if let Err(e) = Self::optimize_socket(&stream) {
                                eprintln!("Socket optimization warning from {}: {}", peer_addr, e);
                            }

                            // Perform TLS handshake
                            let tls_stream = match tls_acceptor_clone.accept(stream).await {
                                Ok(tls_stream) => tls_stream,
                                Err(e) => {
                                    eprintln!("TLS handshake failed from {}: {}", peer_addr, e);
                                    return;
                                }
                            };

                            println!("🔒 TLS connection established from {}", peer_addr);

                            if let Err(e) = Self::handle_connection(
                                tls_stream,
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

    /// Handle an incoming TLS connection with application-layer encryption
    async fn handle_connection(
        stream: TlsStream<TcpStream>,
        peer_addr: SocketAddr,
        file_transfer_service: Arc<Mutex<FileTransferService>>,
        app_handle: AppHandle,
        secure_channel_manager: Arc<SecureChannelManager>,
    ) -> Result<(), String> {
        // Create buffered reader over the TLS stream
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
            // Reject plaintext connections — encryption is mandatory
            eprintln!(
                "🔒 REJECTED plaintext connection from {} (encryption required, got {:?})",
                peer_addr, first_frame.message_type
            );

            // Emit security warning
            let _ = app_handle.emit(
                "security-warning",
                serde_json::json!({
                    "message": "Plaintext connection rejected — encryption is required",
                    "peer": peer_addr.to_string(),
                }),
            );

            // Send error frame before closing
            let error_payload = serde_json::to_vec(&serde_json::json!({
                "code": "ENCRYPTION_REQUIRED",
                "message": "This server requires encrypted connections. Send HelloSecure to initiate."
            }))
            .unwrap_or_default();
            let error_frame = Frame::new(MessageType::Error, error_payload);

            let stream = reader.get_mut();
            let _ = stream.write_all(&error_frame.encode()).await;
            let _ = stream.flush().await;

            Err(format!(
                "Rejected plaintext connection from {} — encryption is required",
                peer_addr
            ))
        }
    }

    /// Handle secure (encrypted) connection
    async fn handle_secure_connection(
        mut reader: BufReader<TlsStream<TcpStream>>,
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
        let handshake_id = hello.handshake_id.clone();
        println!(
            "🔑 Received HELLO_SECURE from {} (handshake: {})",
            peer_device_id, handshake_id
        );

        use crate::crypto::HandshakeManager;

        let handshake_manager = HandshakeManager::new();

        // Clone fields needed after `hello` is consumed by handle_hello_secure.
        let public_key = hello.public_key;

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

        // Finalize handshake and get session.
        // Pass `handshake_id` (not just `peer_device_id`) so the lookup in
        // `pending_keypairs` is unambiguous even when multiple connections from
        // the same peer device arrive concurrently.
        let session =
            handshake_manager.finalize_handshake(&peer_device_id, &public_key, &handshake_id)?;

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
        let _ = app_handle.emit(
            "device-disconnected",
            serde_json::json!({ "device_id": peer_device_id }),
        );

        result
    }

    /// Handle encrypted session (all messages encrypted)
    async fn handle_encrypted_session(
        mut reader: BufReader<TlsStream<TcpStream>>,
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
                    Self::handle_encrypted_message(
                        &session,
                        &frame,
                        &file_transfer_service,
                        &app_handle,
                    )
                    .await?;
                }
                MessageType::Heartbeat => {
                    // Heartbeat is allowed unencrypted (legacy keepalive)
                    println!("💓 Heartbeat from {}", peer_device_id);
                }
                MessageType::Ping => {
                    // Respond with Pong on the same socket so the client can
                    // confirm the connection is still alive.
                    let ping: PingPayload = serde_json::from_slice(&frame.payload)
                        .map_err(|e| format!("Invalid Ping payload: {}", e))?;
                    println!("🏓 Ping from {} – sending Pong", peer_device_id);

                    let pong_payload = serde_json::to_vec(&PongPayload {
                        device_id: peer_device_id.clone(),
                        sent_at_ms: ping.sent_at_ms,
                    })
                    .map_err(|e| format!("Failed to serialize Pong: {}", e))?;
                    let pong_frame = Frame::new(MessageType::Pong, pong_payload);

                    let stream = reader.get_mut();
                    stream
                        .write_all(&pong_frame.encode())
                        .await
                        .map_err(|e| format!("Failed to send Pong: {}", e))?;
                    stream
                        .flush()
                        .await
                        .map_err(|e| format!("Failed to flush Pong: {}", e))?;
                }
                // Delivery ACKs and read receipts arrive as plaintext frames even
                // inside an encrypted session – they carry no sensitive content.
                MessageType::MessageDelivered | MessageType::MessageRead => {
                    Self::handle_message_ack(&frame, &app_handle).await?;
                }

                // ── File transfer frames (sent over TLS, not double-encrypted) ──
                MessageType::FileRequest => {
                    let req: FileRequestPayload = deserialize_json(&frame.payload)
                        .map_err(|e| format!("Invalid FILE_REQUEST frame: {}", e))?;
                    let is_resume = req.resume_offset > 0;
                    let transfer_id = req.transfer_id.clone();
                    let sender_device_id = req.from_device_id.clone();

                    if is_resume {
                        println!(
                            "↻ Resume request frame from {} for transfer {} at offset {}",
                            sender_device_id, transfer_id, req.resume_offset
                        );
                    } else {
                        println!("📎 File request from {}", sender_device_id);
                    }

                    let service = file_transfer_service.lock().await;
                    service
                        .receive_file_request(req, app_handle.clone())
                        .await?;

                    // For resume requests, auto-send FILE_ACK back so the
                    // sender's perform_transfer polling loop sees InProgress.
                    if is_resume {
                        let confirmed_offset = {
                            let transfers = service.transfers.lock().await;
                            transfers
                                .get(&transfer_id)
                                .map(|t| t.transferred)
                                .unwrap_or(0)
                        };

                        if let Some(tcp_client) = service.tcp_client_ref() {
                            let tcp_port = app_handle
                                .try_state::<crate::ipc::TcpPort>()
                                .map(|p| p.0)
                                .unwrap_or(8080);

                            if let Some(discovery) =
                                app_handle.try_state::<Arc<MdnsDiscoveryService>>()
                            {
                                let devices = discovery.get_devices().await;
                                if let Some(sender) =
                                    devices.iter().find(|d| d.id == sender_device_id)
                                {
                                    if let Some(addr) = sender.addresses.first() {
                                        let ack = FileAckPayload {
                                            transfer_id: transfer_id.clone(),
                                            offset: confirmed_offset,
                                        };
                                        if let Ok(payload) =
                                            crate::network::protocol::serialize_json(&ack)
                                        {
                                            let _ = tcp_client
                                                .send_file_ack(
                                                    &sender_device_id,
                                                    addr,
                                                    tcp_port,
                                                    payload,
                                                )
                                                .await;
                                            println!(
                                                "✓ Auto-sent FILE_ACK for resume {} (offset {})",
                                                transfer_id, confirmed_offset
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                MessageType::FileData => {
                    let service = file_transfer_service.lock().await;
                    service
                        .receive_file_chunk(frame.payload, app_handle.clone())
                        .await?;
                }
                MessageType::FileComplete => {
                    let complete: FileCompletePayload = deserialize_json(&frame.payload)
                        .map_err(|e| format!("Invalid FILE_COMPLETE frame: {}", e))?;
                    println!("✅ File complete: {}", complete.transfer_id);
                    let service = file_transfer_service.lock().await;
                    service
                        .handle_complete(complete, app_handle.clone())
                        .await?;
                }
                MessageType::FileAck => {
                    let ack: FileAckPayload = deserialize_json(&frame.payload)
                        .map_err(|e| format!("Invalid FILE_ACK frame: {}", e))?;
                    println!("✅ File accepted by receiver: {}", ack.transfer_id);
                    // Update the sender's local transfer status to InProgress
                    // so perform_transfer can start streaming data.
                    let service = file_transfer_service.lock().await;
                    let mut transfers = service.transfers.lock().await;
                    if let Some(t) = transfers.get_mut(&ack.transfer_id) {
                        t.status = crate::network::file_transfer::TransferStatus::InProgress;
                        t.updated_at = chrono::Utc::now().timestamp();
                    }
                    drop(transfers);
                    drop(service);
                    let _ = app_handle.emit(
                        "file-accepted",
                        serde_json::json!({ "transfer_id": ack.transfer_id }),
                    );
                }
                MessageType::FileCancel => {
                    let cancel: FileCancelPayload = deserialize_json(&frame.payload)
                        .map_err(|e| format!("Invalid FILE_CANCEL frame: {}", e))?;
                    println!("🛑 File cancelled: {}", cancel.transfer_id);
                    let service = file_transfer_service.lock().await;
                    let mut transfers = service.transfers.lock().await;
                    if let Some(t) = transfers.get_mut(&cancel.transfer_id) {
                        t.status = crate::network::file_transfer::TransferStatus::Cancelled;
                        t.updated_at = chrono::Utc::now().timestamp();
                    }
                    drop(transfers);
                    drop(service);
                    let _ = app_handle.emit(
                        "file-cancelled",
                        serde_json::json!({ "transfer_id": cancel.transfer_id }),
                    );
                }
                MessageType::FileReject => {
                    let reject: FileRejectPayload = deserialize_json(&frame.payload)
                        .map_err(|e| format!("Invalid FILE_REJECT frame: {}", e))?;
                    println!("❌ File rejected: {}", reject.transfer_id);
                    let service = file_transfer_service.lock().await;
                    let mut transfers = service.transfers.lock().await;
                    if let Some(t) = transfers.get_mut(&reject.transfer_id) {
                        t.status = crate::network::file_transfer::TransferStatus::Rejected;
                        t.updated_at = chrono::Utc::now().timestamp();
                    }
                    drop(transfers);
                    drop(service);
                    let _ = app_handle.emit(
                        "file-rejected",
                        serde_json::json!({ "transfer_id": reject.transfer_id }),
                    );
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
        file_transfer_service: &Arc<Mutex<FileTransferService>>,
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

                // Persist in the MessagingService so get_messages works on
                // the receiver side (the event below handles the real-time UI).
                if let Some(messaging) = app_handle.try_state::<MessagingService>() {
                    let _: () = messaging.store_received_message(&msg).await;

                    // Send a delivery ACK back to the sender
                    Self::try_send_delivery_ack(&msg, &messaging, &app_handle).await;
                }

                let _ = app_handle.emit("message-received", &msg);
            }
            Some("MESSAGE_DELIVERED") => {
                let ack: MessageAckPayload = serde_json::from_str(&plaintext_json)
                    .map_err(|e| format!("Invalid MESSAGE_DELIVERED: {}", e))?;
                println!("✅ Delivery ACK for message {:?}", ack.message_id);
                if let Some(messaging) = app_handle.try_state::<MessagingService>() {
                    if let Some(ref msg_id) = ack.message_id {
                        let _ = messaging
                            .update_message_status(
                                &ack.conversation_key,
                                msg_id,
                                MessageStatus::Delivered,
                            )
                            .await;
                    }
                }
                let _ = app_handle.emit("message-delivered", &ack);
            }
            Some("MESSAGE_READ") => {
                let ack: MessageAckPayload = serde_json::from_str(&plaintext_json)
                    .map_err(|e| format!("Invalid MESSAGE_READ: {}", e))?;
                println!("👁️  Read receipt for conversation {}", ack.conversation_key);
                if let Some(messaging) = app_handle.try_state::<MessagingService>() {
                    messaging
                        .mark_outgoing_as_read(&ack.conversation_key, &ack.to_device_id)
                        .await;
                }
                let _ = app_handle.emit("message-read", &ack);
            }
            Some("FILE_REQUEST") => {
                let req: FileRequestPayload = serde_json::from_str(&plaintext_json)
                    .map_err(|e| format!("Invalid FILE_REQUEST: {}", e))?;
                let is_resume = req.resume_offset > 0;
                let transfer_id = req.transfer_id.clone();
                let sender_device_id = req.from_device_id.clone();

                if is_resume {
                    println!(
                        "↻ Decrypted resume request from {} for transfer {} at offset {}",
                        sender_device_id, transfer_id, req.resume_offset
                    );
                } else {
                    println!("📎 Decrypted file request from {}", sender_device_id);
                }

                // Create backend transfer record (or auto-accept resume)
                let service = file_transfer_service.lock().await;
                service
                    .receive_file_request(req, app_handle.clone())
                    .await?;

                // For resume requests, auto-send FILE_ACK back to the sender
                // so the sender's perform_transfer polling loop sees InProgress.
                if is_resume {
                    let confirmed_offset = {
                        let transfers = service.transfers.lock().await;
                        transfers
                            .get(&transfer_id)
                            .map(|t| t.transferred)
                            .unwrap_or(0)
                    };

                    if let Some(tcp_client) = service.tcp_client_ref() {
                        let tcp_port = app_handle
                            .try_state::<crate::ipc::TcpPort>()
                            .map(|p| p.0)
                            .unwrap_or(8080);

                        // Look up sender address via mDNS discovery
                        if let Some(discovery) =
                            app_handle.try_state::<Arc<MdnsDiscoveryService>>()
                        {
                            let devices = discovery.get_devices().await;
                            if let Some(sender) =
                                devices.iter().find(|d| d.id == sender_device_id)
                            {
                                if let Some(addr) = sender.addresses.first() {
                                    let ack = FileAckPayload {
                                        transfer_id: transfer_id.clone(),
                                        offset: confirmed_offset,
                                    };
                                    if let Ok(payload) =
                                        crate::network::protocol::serialize_json(&ack)
                                    {
                                        let _ = tcp_client
                                            .send_file_ack(
                                                &sender_device_id,
                                                addr,
                                                tcp_port,
                                                payload,
                                            )
                                            .await;
                                        println!(
                                            "✓ Auto-sent FILE_ACK for resume {} (offset {})",
                                            transfer_id, confirmed_offset
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Some("FILE_ACK") => {
                let ack: FileAckPayload = serde_json::from_str(&plaintext_json)
                    .map_err(|e| format!("Invalid FILE_ACK: {}", e))?;
                println!("✅ Decrypted file accepted: {}", ack.transfer_id);
                // Update sender's transfer status to InProgress
                let service = file_transfer_service.lock().await;
                let mut transfers = service.transfers.lock().await;
                if let Some(t) = transfers.get_mut(&ack.transfer_id) {
                    t.status = crate::network::file_transfer::TransferStatus::InProgress;
                    t.updated_at = chrono::Utc::now().timestamp();
                }
                drop(transfers);
                drop(service);
                let _ = app_handle.emit(
                    "file-accepted",
                    serde_json::json!({ "transfer_id": ack.transfer_id }),
                );
            }
            Some("FILE_COMPLETE") => {
                let complete: FileCompletePayload = serde_json::from_str(&plaintext_json)
                    .map_err(|e| format!("Invalid FILE_COMPLETE: {}", e))?;
                println!("✅ Decrypted file complete: {}", complete.transfer_id);
                let service = file_transfer_service.lock().await;
                service
                    .handle_complete(complete, app_handle.clone())
                    .await?;
            }
            Some("FILE_CANCEL") => {
                let cancel: FileCancelPayload = serde_json::from_str(&plaintext_json)
                    .map_err(|e| format!("Invalid FILE_CANCEL: {}", e))?;
                println!("🛑 Decrypted file cancel: {}", cancel.transfer_id);
                let service = file_transfer_service.lock().await;
                let mut transfers = service.transfers.lock().await;
                if let Some(t) = transfers.get_mut(&cancel.transfer_id) {
                    t.status = crate::network::file_transfer::TransferStatus::Cancelled;
                    t.updated_at = chrono::Utc::now().timestamp();
                }
                drop(transfers);
                drop(service);
                let _ = app_handle.emit(
                    "file-cancelled",
                    serde_json::json!({ "transfer_id": cancel.transfer_id }),
                );
            }
            Some("FILE_REJECT") => {
                let reject: FileRejectPayload = serde_json::from_str(&plaintext_json)
                    .map_err(|e| format!("Invalid FILE_REJECT: {}", e))?;
                println!("❌ Decrypted file reject: {}", reject.transfer_id);
                let service = file_transfer_service.lock().await;
                let mut transfers = service.transfers.lock().await;
                if let Some(t) = transfers.get_mut(&reject.transfer_id) {
                    t.status = crate::network::file_transfer::TransferStatus::Rejected;
                    t.updated_at = chrono::Utc::now().timestamp();
                }
                drop(transfers);
                drop(service);
                let _ = app_handle.emit(
                    "file-rejected",
                    serde_json::json!({ "transfer_id": reject.transfer_id }),
                );
            }

            // ── Group Chat ────────────────────────────────────────────────
            Some("GROUP_MESSAGE") => {
                let payload: GroupMessagePayload = serde_json::from_str(&plaintext_json)
                    .map_err(|e| format!("Invalid GROUP_MESSAGE: {}", e))?;
                println!(
                    "👥 Group message from {} in group {}",
                    payload.from_device_id, payload.group_id
                );

                if let Some(group_service) = app_handle.try_state::<GroupService>() {
                    // Determine local device ID from discovery service
                    let local_device_id = if let Some(discovery) =
                        app_handle.try_state::<Arc<MdnsDiscoveryService>>()
                    {
                        discovery.local_device_id().to_string()
                    } else {
                        String::new()
                    };

                    group_service
                        .handle_incoming_group_message(&payload, &local_device_id, app_handle)
                        .await?;
                }
            }
            Some("GROUP_CONTROL") => {
                let payload: GroupControlPayload = serde_json::from_str(&plaintext_json)
                    .map_err(|e| format!("Invalid GROUP_CONTROL: {}", e))?;
                println!(
                    "👥 Group control {:?} from {} for group {}",
                    payload.action, payload.from_device_id, payload.group_id
                );

                if let Some(group_service) = app_handle.try_state::<GroupService>() {
                    let local_device_id = if let Some(discovery) =
                        app_handle.try_state::<Arc<MdnsDiscoveryService>>()
                    {
                        discovery.local_device_id().to_string()
                    } else {
                        String::new()
                    };

                    group_service
                        .handle_incoming_group_control(&payload, &local_device_id, app_handle)
                        .await?;
                }
            }

            _ => {
                return Err("Unknown message type in encrypted message".to_string());
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

    /// Look up the sender in mDNS and fire a delivery ACK (best-effort).
    async fn try_send_delivery_ack(
        payload: &TextMessagePayload,
        messaging: &MessagingService,
        app_handle: &AppHandle,
    ) {
        // Derive the conversation key the same way both sides do
        let mut parts = vec![
            payload.from_device_id.as_str(),
            payload.to_device_id.as_str(),
        ];
        parts.sort();
        let conversation_key = parts.join("_");

        // Look up the sender's current address via mDNS
        let (peer_address, peer_port) =
            if let Some(discovery) = app_handle.try_state::<Arc<MdnsDiscoveryService>>() {
                let devices = discovery.get_devices().await;
                if let Some(device) = devices.iter().find(|d| d.id == payload.from_device_id) {
                    if let Some(addr) = device.addresses.first() {
                        (addr.clone(), device.port)
                    } else {
                        return; // no address – skip
                    }
                } else {
                    return; // sender not found in mDNS – skip
                }
            } else {
                return; // discovery service unavailable
            };

        let _ = messaging
            .send_delivery_ack(
                &payload.id,
                &conversation_key,
                &payload.to_device_id,   // we are the recipient – ACK from us
                &payload.from_device_id, // ACK goes to the original sender
                &peer_address,
                peer_port,
            )
            .await;
    }

    /// Handle a delivery ACK (`MessageDelivered`) or read receipt (`MessageRead`) frame.
    async fn handle_message_ack(frame: &Frame, app_handle: &AppHandle) -> Result<(), String> {
        let ack: MessageAckPayload = deserialize_json(&frame.payload)?;

        if let Some(messaging) = app_handle.try_state::<MessagingService>() {
            match ack.msg_type.as_str() {
                "MESSAGE_DELIVERED" => {
                    println!("✅ Delivery ACK for message {:?}", ack.message_id);
                    if let Some(ref msg_id) = ack.message_id {
                        let _ = messaging
                            .update_message_status(
                                &ack.conversation_key,
                                msg_id,
                                MessageStatus::Delivered,
                            )
                            .await;
                    }
                    let _ = app_handle.emit("message-delivered", &ack);
                }
                "MESSAGE_READ" => {
                    println!("👁️  Read receipt for conversation {}", ack.conversation_key);
                    // Mark all messages we sent in this conversation as Read
                    messaging
                        .mark_outgoing_as_read(&ack.conversation_key, &ack.to_device_id)
                        .await;
                    let _ = app_handle.emit("message-read", &ack);
                }
                other => {
                    eprintln!("⚠️ Unknown ACK type: {}", other);
                }
            }
        }

        Ok(())
    }
}
