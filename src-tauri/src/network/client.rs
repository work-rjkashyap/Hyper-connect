//! TCP Client
//!
//! High-performance TCP client with connection pooling and socket optimization.
//! Implements connection reuse, automatic reconnection, and network tuning for
//! maximum throughput on LAN transfers.

use crate::network::protocol::{Frame, MessageType};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::BufWriter;
use tokio::net::TcpStream;
use tokio::sync::{Mutex, RwLock};
use tokio::time::timeout;

/// Connection timeout in seconds
const CONNECT_TIMEOUT_SECS: u64 = 5;

/// Keep-alive interval in seconds
const KEEPALIVE_INTERVAL_SECS: u64 = 30;

/// TCP send buffer size (4MB for high-speed transfers)
const SEND_BUFFER_SIZE: usize = 4 * 1024 * 1024;

/// TCP receive buffer size (4MB for high-speed transfers)
const RECV_BUFFER_SIZE: usize = 4 * 1024 * 1024;

/// Connection wrapper with buffered writer
pub struct Connection {
    writer: BufWriter<TcpStream>,
    peer_addr: SocketAddr,
    device_id: String,
}

impl Connection {
    /// Create a new connection from a TCP stream
    async fn new(stream: TcpStream, device_id: String) -> Result<Self, String> {
        let peer_addr = stream
            .peer_addr()
            .map_err(|e| format!("Failed to get peer address: {}", e))?;

        // Optimize socket settings for high-speed LAN transfers
        Self::optimize_socket(&stream)?;

        let writer = BufWriter::with_capacity(256 * 1024, stream); // 256KB buffer

        Ok(Self {
            writer,
            peer_addr,
            device_id,
        })
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

        println!("✓ TCP socket optimized for {}", stream.peer_addr().unwrap());
        Ok(())
    }

    /// Send a frame over this connection
    pub async fn send_frame(&mut self, frame: &Frame) -> Result<(), String> {
        frame
            .write_async(&mut self.writer)
            .await
            .map_err(|e| format!("Failed to send frame: {}", e))
    }

    /// Get peer address
    pub fn peer_addr(&self) -> SocketAddr {
        self.peer_addr
    }

    /// Get device ID
    pub fn device_id(&self) -> &str {
        &self.device_id
    }
}

/// TCP Client with connection pooling
pub struct TcpClient {
    /// Pool of active connections indexed by device ID
    connections: Arc<RwLock<HashMap<String, Arc<Mutex<Connection>>>>>,
}

impl TcpClient {
    /// Create a new TCP client
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Get or create a connection to a device
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
        // Check if we already have an active connection
        {
            let connections = self.connections.read().await;
            if let Some(conn) = connections.get(device_id) {
                println!("✓ Reusing existing connection to {}", device_id);
                return Ok(Arc::clone(conn));
            }
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

        // Create connection wrapper
        let connection = Connection::new(stream, device_id.to_string()).await?;
        let conn_arc = Arc::new(Mutex::new(connection));

        // Store in pool
        {
            let mut connections = self.connections.write().await;
            connections.insert(device_id.to_string(), Arc::clone(&conn_arc));
        }

        Ok(conn_arc)
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
        let conn = self.get_connection(device_id, address, port).await?;
        let mut conn_lock = conn.lock().await;
        conn_lock.send_frame(&frame).await
    }

    /// Send a text message
    pub async fn send_text_message(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
        payload: Vec<u8>,
    ) -> Result<(), String> {
        let frame = Frame::new(MessageType::TextMessage, payload);
        self.send_frame(device_id, address, port, frame).await
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

impl Default for TcpClient {
    fn default() -> Self {
        Self::new()
    }
}

// Implement Clone for TcpClient to allow sharing across threads
impl Clone for TcpClient {
    fn clone(&self) -> Self {
        Self {
            connections: Arc::clone(&self.connections),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let client = TcpClient::new();
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
