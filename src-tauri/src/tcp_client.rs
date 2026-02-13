use crate::protocol::{Frame, MessageType};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::BufWriter;
use tokio::net::TcpStream;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct TcpClient {
    connections: Arc<Mutex<HashMap<String, Arc<Mutex<BufWriter<TcpStream>>>>>>,
}

impl TcpClient {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Get or create a connection to a peer
    pub async fn get_connection(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
    ) -> Result<Arc<Mutex<BufWriter<TcpStream>>>, String> {
        let mut connections = self.connections.lock().await;

        // Check if we already have a connection
        if let Some(conn) = connections.get(device_id) {
            return Ok(Arc::clone(conn));
        }

        // Create new connection
        let addr = format!("{}:{}", address, port);
        let stream = TcpStream::connect(&addr)
            .await
            .map_err(|e| format!("Failed to connect to {}: {}", addr, e))?;

        let writer = BufWriter::new(stream);
        let conn = Arc::new(Mutex::new(writer));
        connections.insert(device_id.to_string(), Arc::clone(&conn));

        Ok(conn)
    }

    /// Send a frame to a peer
    pub async fn send_frame(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
        frame: Frame,
    ) -> Result<(), String> {
        let conn = self.get_connection(device_id, address, port).await?;
        let mut writer = conn.lock().await;

        frame
            .write_async(&mut *writer)
            .await
            .map_err(|e| format!("Failed to send frame: {}", e))?;

        Ok(())
    }

    /// Send a text message to a peer
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

    /// Send a file transfer request to a peer
    pub async fn send_file_transfer_request(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
        payload: Vec<u8>,
    ) -> Result<(), String> {
        let frame = Frame::new(MessageType::FileTransferRequest, payload);
        self.send_frame(device_id, address, port, frame).await
    }

    /// Send a file chunk to a peer
    pub async fn send_file_chunk(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
        payload: Vec<u8>,
    ) -> Result<(), String> {
        let frame = Frame::new(MessageType::FileTransferChunk, payload);
        self.send_frame(device_id, address, port, frame).await
    }

    /// Send a file transfer acknowledgment to a peer
    pub async fn send_file_ack(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
        payload: Vec<u8>,
    ) -> Result<(), String> {
        let frame = Frame::new(MessageType::FileTransferAck, payload);
        self.send_frame(device_id, address, port, frame).await
    }

    /// Send a file transfer complete notification
    pub async fn send_file_complete(
        &self,
        device_id: &str,
        address: &str,
        port: u16,
        payload: Vec<u8>,
    ) -> Result<(), String> {
        let frame = Frame::new(MessageType::FileTransferComplete, payload);
        self.send_frame(device_id, address, port, frame).await
    }

    /// Close a connection to a peer
    pub async fn close_connection(&self, device_id: &str) {
        let mut connections = self.connections.lock().await;
        connections.remove(device_id);
    }

    /// Close all connections
    pub async fn close_all(&self) {
        let mut connections = self.connections.lock().await;
        connections.clear();
    }
}
