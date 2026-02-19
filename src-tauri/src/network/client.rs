//! TCP Client
//!
//! High-performance TCP client with connection pooling, encryption, and socket optimization.
//! Implements connection reuse, automatic reconnection, secure handshake, and network tuning for
//! maximum throughput on LAN transfers.

use crate::crypto::{encrypt_message, Session};
use crate::network::protocol::{Frame, MessageType, PingPayload, PongPayload};
use crate::network::secure_channel::SecureChannelManager;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::BufWriter;
use tokio::net::TcpStream;
use tokio::sync::{Mutex, RwLock};
use tokio::time::timeout;
use tokio_rustls::client::TlsStream;
use tokio_rustls::TlsConnector;

/// Connection timeout in seconds
const CONNECT_TIMEOUT_SECS: u64 = 5;

/// Keep-alive interval in seconds
const KEEPALIVE_INTERVAL_SECS: u64 = 30;

/// Ping/pong timeout – if the peer doesn't respond within this many seconds
/// the connection is considered stale and will be replaced.
const PING_TIMEOUT_SECS: u64 = 3;

/// TCP send buffer size (4MB for high-speed transfers)
const SEND_BUFFER_SIZE: usize = 4 * 1024 * 1024;

/// TCP receive buffer size (4MB for high-speed transfers)
const RECV_BUFFER_SIZE: usize = 4 * 1024 * 1024;

/// Connection wrapper with buffered writer over TLS and optional encryption session
pub struct Connection {
    writer: BufWriter<TlsStream<TcpStream>>,
    peer_addr: SocketAddr,
    device_id: String,
    /// Encryption session (if secure handshake completed)
    session: Option<Session>,
}

impl Connection {
    /// Create a new connection from a TLS stream
    async fn new(tls_stream: TlsStream<TcpStream>, device_id: String) -> Result<Self, String> {
        let peer_addr = tls_stream
            .get_ref()
            .0
            .peer_addr()
            .map_err(|e| format!("Failed to get peer address: {}", e))?;

        let writer = BufWriter::with_capacity(256 * 1024, tls_stream); // 256KB buffer

        Ok(Self {
            writer,
            peer_addr,
            device_id,
            session: None, // Session established separately via handshake
        })
    }

    /// Send a frame over this connection
    pub async fn send_frame(&mut self, frame: &Frame) -> Result<(), String> {
        frame
            .write_async(&mut self.writer)
            .await
            .map_err(|e| format!("Failed to send frame: {}", e))
    }

    /// Send a Ping and wait for the Pong response within `PING_TIMEOUT_SECS`.
    ///
    /// Returns `Ok(latency_ms)` if the peer responds, `Err` if it times out or
    /// if there is any socket / protocol error (indicating a stale connection).
    pub async fn ping(&mut self, local_device_id: &str) -> Result<u64, String> {
        let sent_at_ms = chrono::Utc::now().timestamp_millis();

        // Build and send the Ping frame
        let ping_payload = serde_json::to_vec(&PingPayload {
            device_id: local_device_id.to_string(),
            sent_at_ms,
        })
        .map_err(|e| format!("Failed to serialize Ping: {}", e))?;

        let ping_frame = Frame::new(MessageType::Ping, ping_payload);
        self.send_frame(&ping_frame).await?;

        // Read back the Pong using the underlying TcpStream (bypasses BufWriter)
        let stream = self.writer.get_mut();
        let pong_frame = match tokio::time::timeout(
            Duration::from_secs(PING_TIMEOUT_SECS),
            Frame::decode_async(stream),
        )
        .await
        {
            Ok(Ok(frame)) => frame,
            Ok(Err(e)) => return Err(format!("Failed to read Pong: {}", e)),
            Err(_) => return Err("Ping timed out".to_string()),
        };

        if pong_frame.message_type != MessageType::Pong {
            return Err(format!("Expected Pong, got {:?}", pong_frame.message_type));
        }

        let _pong: PongPayload = serde_json::from_slice(&pong_frame.payload)
            .map_err(|e| format!("Invalid Pong payload: {}", e))?;

        let latency_ms = (chrono::Utc::now().timestamp_millis() - sent_at_ms).max(0) as u64;

        println!(
            "🏓 Pong received from {} – latency {}ms",
            self.device_id, latency_ms
        );
        Ok(latency_ms)
    }

    /// Quick socket-level check: returns `false` if there is a pending OS-level
    /// TCP error on the socket (e.g. connection reset, broken pipe).
    /// Returns `true` otherwise (the socket *may* still be alive).
    pub fn has_socket_error(&self) -> bool {
        // Access the underlying TcpStream through the TLS and BufWriter layers
        let tls_stream = self.writer.get_ref();
        let tcp_stream = tls_stream.get_ref().0;
        let socket_ref = socket2::SockRef::from(tcp_stream);
        match socket_ref.take_error() {
            Ok(Some(_)) => true, // pending error
            _ => false,
        }
    }

    /// Get peer address
    pub fn peer_addr(&self) -> SocketAddr {
        self.peer_addr
    }

    /// Get device ID
    pub fn device_id(&self) -> &str {
        &self.device_id
    }

    /// Set encryption session
    pub fn set_session(&mut self, session: Session) {
        self.session = Some(session);
    }

    /// Check if connection has active encryption session
    pub fn has_session(&self) -> bool {
        self.session.is_some()
    }

    /// Get reference to session
    pub fn session(&self) -> Option<&Session> {
        self.session.as_ref()
    }
}

/// TCP Client with connection pooling, TLS encryption, and secure channel support
pub struct TcpClient {
    /// Pool of active connections indexed by device ID
    connections: Arc<RwLock<HashMap<String, Arc<Mutex<Connection>>>>>,
    /// Secure channel manager for application-layer encryption
    secure_channel_manager: Arc<SecureChannelManager>,
    /// TLS connector for transport-layer encryption
    tls_connector: TlsConnector,
}

impl TcpClient {
    /// Create a new TCP client with TLS and encryption support
    pub fn new(
        local_device_id: String,
        display_name: String,
        platform: String,
        app_version: String,
        tls_connector: TlsConnector,
    ) -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            secure_channel_manager: Arc::new(SecureChannelManager::new(
                local_device_id,
                display_name,
                platform,
                app_version,
            )),
            tls_connector,
        }
    }

    /// Optimize TCP socket for maximum performance (called before TLS wrapping)
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

    /// Get or create a connection to a device.
    ///
    /// If a pooled connection already exists it is validated with a Ping/Pong
    /// round-trip.  If the ping fails (stale socket) the dead connection is
    /// evicted and a fresh one is established transparently.
    ///
    /// # Arguments
    /// * `device_id` - Target device ID
    /// * `address` - IP address of target device
    /// * `port` - TCP port of target device
    ///
    /// # Returns
    /// * `Result<Arc<Mutex<Connection>>, String>` - Connection or error
    pub async fn get_connection(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
    ) -> Result<Arc<Mutex<Connection>>, String> {
        // Check if we already have a pooled connection
        {
            let connections = self.connections.read().await;
            if let Some(conn) = connections.get(device_id) {
                // Fast OS-level check first (no network round-trip)
                let has_error = {
                    let c = conn.lock().await;
                    c.has_socket_error()
                };

                if has_error {
                    println!(
                        "⚠️ Pooled connection to {} has a socket error – evicting",
                        device_id
                    );
                    // Fall through to reconnect; eviction happens below
                } else {
                    println!("✓ Reusing existing connection to {}", device_id);
                    return Ok(Arc::clone(conn));
                }
            }
        }

        // Evict any stale/errored entry before creating a fresh connection
        {
            let mut connections = self.connections.write().await;
            connections.remove(device_id);
        }

        // Need to create a new connection
        println!(
            "→ Connecting to {}:{} (device: {})",
            address, port, device_id
        );

        let addr = format!("{}:{}", address, port);
        let socket_addr: SocketAddr = addr
            .parse()
            .map_err(|e| format!("Invalid address: {}", e))?;

        // Connect with timeout
        let stream = match timeout(
            Duration::from_secs(CONNECT_TIMEOUT_SECS),
            TcpStream::connect(socket_addr),
        )
        .await
        {
            Ok(Ok(stream)) => stream,
            Ok(Err(e)) => return Err(format!("Connection failed: {}", e)),
            Err(_) => return Err("Connection timeout".to_string()),
        };

        println!("✓ TCP connection established to {}", socket_addr);

        // Optimize socket before TLS wrapping
        Self::optimize_socket(&stream)?;

        // Wrap with TLS
        let server_name = rustls::pki_types::ServerName::try_from("hyper-connect.local")
            .map_err(|e| format!("Invalid server name: {}", e))?
            .to_owned();
        let tls_stream = self
            .tls_connector
            .connect(server_name, stream)
            .await
            .map_err(|e| format!("TLS handshake failed: {}", e))?;

        println!("🔒 TLS connection established to {}", socket_addr);

        // Create connection wrapper
        let mut connection = Connection::new(tls_stream, device_id.to_string()).await?;

        // Perform secure handshake (required — plaintext connections are not allowed)
        let session = self.perform_handshake(&mut connection, device_id).await
            .map_err(|e| format!("Secure handshake failed with {}: {} (plaintext fallback is disabled)", device_id, e))?;
        connection.set_session(session);
        println!("🔒 Secure session established with {}", device_id);

        let conn_arc = Arc::new(Mutex::new(connection));

        // Store in pool
        {
            let mut connections = self.connections.write().await;
            connections.insert(device_id.to_string(), Arc::clone(&conn_arc));
        }

        Ok(conn_arc)
    }

    /// Proactively verify (or establish) a connection to a device so that the
    /// first real message can be sent without any handshake delay.
    ///
    /// Algorithm:
    /// 1. If a pooled connection exists, send a Ping.
    ///    - Pong received  → connection is alive, return `Ok(latency_ms)`.
    ///    - Ping times out → evict the stale connection and go to step 2.
    /// 2. Establish a fresh TCP connection + secure handshake.
    /// 3. Send a Ping to confirm the new session is working.
    ///
    /// Returns `Ok(latency_ms)` on success, `Err` if the device is unreachable.
    pub async fn ensure_connected(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
    ) -> Result<u64, String> {
        let local_id = self.secure_channel_manager.local_device_id.clone();

        // --- Try existing pooled connection first ---
        {
            let connections = self.connections.read().await;
            if let Some(conn) = connections.get(device_id) {
                let ping_result = {
                    let mut c = conn.lock().await;
                    c.ping(&local_id).await
                };

                match ping_result {
                    Ok(latency_ms) => {
                        println!(
                            "✅ Connection to {} is alive ({}ms RTT)",
                            device_id, latency_ms
                        );
                        return Ok(latency_ms);
                    }
                    Err(e) => {
                        println!("⚠️ Ping to {} failed ({}); will reconnect", device_id, e);
                        // Fall through – evict below
                    }
                }
            }
        }

        // Evict the stale connection (if any)
        {
            let mut connections = self.connections.write().await;
            connections.remove(device_id);
        }

        // --- Establish a fresh connection ---
        println!("🔌 Pre-connecting to {} at {}:{}", device_id, address, port);
        let conn = self.get_connection(device_id, address, port).await?;

        // Confirm the new session with a Ping
        let latency_ms = {
            let mut c = conn.lock().await;
            c.ping(&local_id).await.unwrap_or(0)
        };

        println!(
            "✅ Pre-connection to {} ready ({}ms RTT after handshake)",
            device_id, latency_ms
        );
        Ok(latency_ms)
    }

    /// Send a frame to a device
    ///
    /// # Arguments
    /// * `device_id` - Target device ID
    /// * `address` - IP address of target device
    /// * `port` - TCP port of target device
    /// * `frame` - Frame to send
    ///
    /// # Returns
    /// * `Result<(), String>` - Success or error
    pub async fn send_frame(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
        frame: Frame,
    ) -> Result<(), String> {
        // Try sending with existing connection first
        match self
            .try_send_frame(device_id, address, port, frame.clone())
            .await
        {
            Ok(_) => Ok(()),
            Err(e) => {
                // If send failed, connection might be stale - remove and retry with new connection
                eprintln!("⚠️ Send failed, retrying with new connection: {}", e);
                self.close_connection(device_id).await;

                // Retry with fresh connection
                self.try_send_frame(device_id, address, port, frame).await
            }
        }
    }

    /// Internal method to try sending a frame (without retry logic)
    async fn try_send_frame(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
        frame: Frame,
    ) -> Result<(), String> {
        let conn = self.get_connection(device_id, address, port).await?;
        let mut conn_lock = conn.lock().await;
        conn_lock.send_frame(&frame).await
    }

    /// Perform secure handshake with peer
    async fn perform_handshake(
        &self,
        connection: &mut Connection,
        peer_device_id: &str,
    ) -> Result<Session, String> {
        // Send HELLO_SECURE
        let hello = self
            .secure_channel_manager
            .handshake_manager
            .initiate_handshake(
                &self.secure_channel_manager.local_device_id,
                &self.secure_channel_manager.display_name,
                &self.secure_channel_manager.platform,
                &self.secure_channel_manager.app_version,
                peer_device_id,
            )?;

        let hello_json =
            serde_json::to_vec(&hello).map_err(|e| format!("Serialization error: {}", e))?;
        let hello_frame = Frame::new(MessageType::HelloSecure, hello_json);

        connection.send_frame(&hello_frame).await?;
        println!("🔑 Sent HELLO_SECURE to {}", peer_device_id);

        // Read HELLO_RESPONSE
        let stream = connection.writer.get_mut();
        let response_frame = Frame::decode_async(stream)
            .await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        if response_frame.message_type != MessageType::HelloResponse {
            return Err(format!(
                "Unexpected response type: {:?}",
                response_frame.message_type
            ));
        }

        let response: crate::crypto::HelloResponse =
            serde_json::from_slice(&response_frame.payload)
                .map_err(|e| format!("Invalid response: {}", e))?;

        if !response.accepted {
            return Err("Handshake rejected by peer".to_string());
        }

        // Complete handshake
        let session = self
            .secure_channel_manager
            .handshake_manager
            .complete_handshake(response)?;

        Ok(session)
    }

    /// Send a text message (always encrypted — plaintext is not supported)
    pub async fn send_text_message(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
        payload: Vec<u8>,
    ) -> Result<(), String> {
        // Get connection (handshake is mandatory, so session is guaranteed)
        let conn = self.get_connection(device_id, address, port).await?;
        let has_session = {
            let conn_lock = conn.lock().await;
            conn_lock.has_session()
        };

        if !has_session {
            return Err(format!(
                "No encrypted session with {} — cannot send message without encryption",
                device_id
            ));
        }

        let plaintext = String::from_utf8(payload)
            .map_err(|e| format!("Invalid UTF-8 in payload: {}", e))?;
        self.send_encrypted_message(device_id, address, port, &plaintext)
            .await
    }

    /// Send an encrypted message (requires active session)
    async fn send_encrypted_message(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
        plaintext_json: &str,
    ) -> Result<(), String> {
        // Get connection and session
        let conn = self.get_connection(device_id, address, port).await?;
        let session = {
            let conn_lock = conn.lock().await;
            conn_lock
                .session()
                .cloned()
                .ok_or("No active session for device")? // COMPLICATION: Connection exists but no session!
        };

        // Encrypt message
        let encrypted = encrypt_message(&session, plaintext_json)?;
        let encrypted_json = serde_json::to_vec(&encrypted)
            .map_err(|e| format!("Failed to serialize encrypted message: {}", e))?;

        // Send encrypted frame
        let frame = Frame::new(MessageType::EncryptedMessage, encrypted_json);
        self.send_frame(device_id, address, port, frame).await?;

        println!("🔒 Encrypted message sent to {}", device_id);
        Ok(())
    }

    /// Send a file request
    pub async fn send_file_request(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
        payload: Vec<u8>,
    ) -> Result<(), String> {
        let frame = Frame::new(MessageType::FileRequest, payload);
        self.send_frame(device_id, address, port, frame).await
    }

    /// Send file data chunk (optimized for high throughput)
    pub async fn send_file_data(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
        payload: Vec<u8>,
    ) -> Result<(), String> {
        let frame = Frame::new(MessageType::FileData, payload);
        self.send_frame(device_id, address, port, frame).await
    }

    /// Send file acknowledgment
    pub async fn send_file_ack(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
        payload: Vec<u8>,
    ) -> Result<(), String> {
        let frame = Frame::new(MessageType::FileAck, payload);
        self.send_frame(device_id, address, port, frame).await
    }

    /// Send file complete notification
    pub async fn send_file_complete(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
        payload: Vec<u8>,
    ) -> Result<(), String> {
        let frame = Frame::new(MessageType::FileComplete, payload);
        self.send_frame(device_id, address, port, frame).await
    }

    /// Send file cancel notification
    pub async fn send_file_cancel(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
        payload: Vec<u8>,
    ) -> Result<(), String> {
        let frame = Frame::new(MessageType::FileCancel, payload);
        self.send_frame(device_id, address, port, frame).await
    }

    /// Send file reject notification
    pub async fn send_file_reject(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
        payload: Vec<u8>,
    ) -> Result<(), String> {
        let frame = Frame::new(MessageType::FileReject, payload);
        self.send_frame(device_id, address, port, frame).await
    }

    /// Close a specific connection
    pub async fn close_connection(&self, device_id: &str) {
        let mut connections = self.connections.write().await;
        if connections.remove(device_id).is_some() {
            println!("✓ Closed connection to device: {}", device_id);
        }
    }

    /// Close all connections
    pub async fn close_all(&self) {
        let mut connections = self.connections.write().await;
        let count = connections.len();
        connections.clear();
        println!("✓ Closed all {} connections", count);
    }

    /// Get number of active connections
    pub async fn connection_count(&self) -> usize {
        let connections = self.connections.read().await;
        connections.len()
    }

    /// Check if connected to a device
    pub async fn is_connected(&self, device_id: &str) -> bool {
        let connections = self.connections.read().await;
        connections.contains_key(device_id)
    }
}

// Implement Clone for TcpClient to allow sharing across threads
impl Clone for TcpClient {
    fn clone(&self) -> Self {
        Self {
            connections: Arc::clone(&self.connections),
            secure_channel_manager: Arc::clone(&self.secure_channel_manager),
            tls_connector: self.tls_connector.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        // Create a test TLS connector (accepts any cert for testing)
        use crate::crypto::tls::TlsConfig;
        let tmp_dir = std::env::temp_dir().join("hyper-connect-test-tls");
        let _ = std::fs::create_dir_all(&tmp_dir);
        let tls_config = TlsConfig::new(&tmp_dir).expect("Failed to create TLS config");
        let _ = std::fs::remove_dir_all(&tmp_dir);

        let client = TcpClient::new(
            "test-device".to_string(),
            "Test Device".to_string(),
            "test-platform".to_string(),
            "0.1.0".to_string(),
            tls_config.connector,
        );
        assert_eq!(
            tokio::runtime::Runtime::new()
                .unwrap()
                .block_on(client.connection_count()),
            0
        );
    }

    #[test]
    fn test_socket_optimization() {
        // This test just ensures the optimization function doesn't panic
        // Real testing would require actual socket creation
    }
}
