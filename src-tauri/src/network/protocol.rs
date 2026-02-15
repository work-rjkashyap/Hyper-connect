//! Network Protocol
//!
//! High-performance binary protocol optimized for LAN file transfers.
//! Uses a frame-based approach with minimal overhead.
//!
//! Frame Structure:
//! - [4 bytes] Payload length (big-endian u32)
//! - [1 byte]  Message type
//! - [N bytes] Payload (format depends on message type)
//!
//! For file chunks, payload is RAW BINARY DATA (no JSON serialization overhead)
//! For control messages, payload is JSON

use serde::{Deserialize, Serialize};
use std::io::{self, Read, Write};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

/// Protocol version for compatibility checking
pub const PROTOCOL_VERSION: u8 = 2;

/// Maximum payload size (100MB) - prevents memory exhaustion attacks
const MAX_PAYLOAD_SIZE: u32 = 100 * 1024 * 1024;

/// Message types for the protocol
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum MessageType {
    /// Connection handshake with device info
    Hello = 0x01,

    /// Text message between devices
    TextMessage = 0x02,

    /// File transfer request (includes metadata)
    FileRequest = 0x03,

    /// Raw file data chunk (binary, no JSON wrapping)
    FileData = 0x04,

    /// File transfer acknowledgment
    FileAck = 0x05,

    /// File transfer complete notification
    FileComplete = 0x06,

    /// File transfer cancellation
    FileCancel = 0x07,

    /// File transfer rejection
    FileReject = 0x08,

    /// Heartbeat for connection keep-alive
    Heartbeat = 0x09,

    /// Error notification
    Error = 0x0A,

    // ============================================================================
    // Encryption Message Types (0x10-0x1F)
    // ============================================================================
    /// Secure handshake with ephemeral public key (X25519)
    HelloSecure = 0x10,

    /// Handshake response with ephemeral public key
    HelloResponse = 0x11,

    /// Encrypted control message (AES-256-GCM)
    EncryptedMessage = 0x12,

    /// File stream initialization with IV (AES-256-CTR)
    FileStreamInit = 0x13,
}

impl MessageType {
    /// Convert from byte to MessageType
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0x01 => Some(MessageType::Hello),
            0x02 => Some(MessageType::TextMessage),
            0x03 => Some(MessageType::FileRequest),
            0x04 => Some(MessageType::FileData),
            0x05 => Some(MessageType::FileAck),
            0x06 => Some(MessageType::FileComplete),
            0x07 => Some(MessageType::FileCancel),
            0x08 => Some(MessageType::FileReject),
            0x09 => Some(MessageType::Heartbeat),
            0x0A => Some(MessageType::Error),
            // Encryption types
            0x10 => Some(MessageType::HelloSecure),
            0x11 => Some(MessageType::HelloResponse),
            0x12 => Some(MessageType::EncryptedMessage),
            0x13 => Some(MessageType::FileStreamInit),
            _ => None,
        }
    }
}

/// Protocol frame containing message type and payload
#[derive(Debug, Clone)]
pub struct Frame {
    pub message_type: MessageType,
    pub payload: Vec<u8>,
}

impl Frame {
    /// Create a new frame
    pub fn new(message_type: MessageType, payload: Vec<u8>) -> Self {
        Self {
            message_type,
            payload,
        }
    }

    /// Encode frame to bytes
    pub fn encode(&self) -> Vec<u8> {
        let payload_len = self.payload.len() as u32;
        let mut buffer = Vec::with_capacity(5 + self.payload.len());

        // Write length (4 bytes, big-endian)
        buffer.extend_from_slice(&payload_len.to_be_bytes());

        // Write message type (1 byte)
        buffer.push(self.message_type as u8);

        // Write payload
        buffer.extend_from_slice(&self.payload);

        buffer
    }

    /// Decode frame synchronously
    pub fn decode<R: Read>(reader: &mut R) -> io::Result<Self> {
        // Read length (4 bytes)
        let mut len_bytes = [0u8; 4];
        reader.read_exact(&mut len_bytes)?;
        let payload_len = u32::from_be_bytes(len_bytes);

        // Validate payload length
        if payload_len > MAX_PAYLOAD_SIZE {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("Payload too large: {} bytes", payload_len),
            ));
        }

        // Read message type (1 byte)
        let mut type_byte = [0u8; 1];
        reader.read_exact(&mut type_byte)?;
        let message_type = MessageType::from_u8(type_byte[0])
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "Invalid message type"))?;

        // Read payload
        let mut payload = vec![0u8; payload_len as usize];
        reader.read_exact(&mut payload)?;

        Ok(Self {
            message_type,
            payload,
        })
    }

    /// Decode frame asynchronously
    pub async fn decode_async<R: AsyncReadExt + Unpin>(reader: &mut R) -> io::Result<Self> {
        // Read length (4 bytes)
        let mut len_bytes = [0u8; 4];
        reader.read_exact(&mut len_bytes).await?;
        let payload_len = u32::from_be_bytes(len_bytes);

        // Validate payload length
        if payload_len > MAX_PAYLOAD_SIZE {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("Payload too large: {} bytes", payload_len),
            ));
        }

        // Read message type (1 byte)
        let mut type_byte = [0u8; 1];
        reader.read_exact(&mut type_byte).await?;
        let message_type = MessageType::from_u8(type_byte[0])
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "Invalid message type"))?;

        // Read payload
        let mut payload = vec![0u8; payload_len as usize];
        reader.read_exact(&mut payload).await?;

        Ok(Self {
            message_type,
            payload,
        })
    }

    /// Write frame asynchronously
    pub async fn write_async<W: AsyncWriteExt + Unpin>(&self, writer: &mut W) -> io::Result<()> {
        let encoded = self.encode();
        writer.write_all(&encoded).await?;
        writer.flush().await?;
        Ok(())
    }

    /// Write frame synchronously
    pub fn write<W: Write>(&self, writer: &mut W) -> io::Result<()> {
        let encoded = self.encode();
        writer.write_all(&encoded)?;
        writer.flush()?;
        Ok(())
    }
}

// ============================================================================
// Protocol Message Payloads (JSON-serialized except FileData)
// ============================================================================

/// Hello handshake message sent on connection establishment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelloPayload {
    pub protocol_version: u8,
    pub device_id: String,
    pub display_name: String,
    pub platform: String,
    pub app_version: String,
}

/// Text message between devices
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextMessagePayload {
    #[serde(rename = "type", default = "default_text_message_type")]
    pub msg_type: String,
    pub id: String,
    pub from_device_id: String,
    pub to_device_id: String,
    pub content: String,
    pub timestamp: i64,
    pub thread_id: Option<String>,
}

fn default_text_message_type() -> String {
    "TEXT_MESSAGE".to_string()
}

/// File transfer request with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileRequestPayload {
    #[serde(rename = "type", default = "default_file_request_type")]
    pub msg_type: String,
    pub transfer_id: String,
    pub filename: String,
    pub file_size: u64,
    pub from_device_id: String,
    pub to_device_id: String,
    pub checksum: String, // SHA-256 hash
}

fn default_file_request_type() -> String {
    "FILE_REQUEST".to_string()
}

/// File data chunk header (followed by raw binary data)
/// This is a COMPACT binary structure, NOT JSON
#[derive(Debug, Clone)]
pub struct FileDataHeader {
    pub transfer_id_len: u8, // Length of transfer_id string
    pub transfer_id: String, // Transfer ID
    pub offset: u64,         // Byte offset in file
    pub chunk_size: u32,     // Size of following data chunk
}

impl FileDataHeader {
    /// Encode header to bytes
    pub fn encode(&self) -> Vec<u8> {
        let mut buffer = Vec::with_capacity(1 + self.transfer_id.len() + 8 + 4);

        // Transfer ID length (1 byte)
        buffer.push(self.transfer_id_len);

        // Transfer ID (variable length)
        buffer.extend_from_slice(self.transfer_id.as_bytes());

        // Offset (8 bytes)
        buffer.extend_from_slice(&self.offset.to_be_bytes());

        // Chunk size (4 bytes)
        buffer.extend_from_slice(&self.chunk_size.to_be_bytes());

        buffer
    }

    /// Decode header from bytes
    pub fn decode(data: &[u8]) -> io::Result<(Self, usize)> {
        if data.is_empty() {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "Empty data"));
        }

        let mut offset = 0;

        // Read transfer_id length
        let transfer_id_len = data[offset];
        offset += 1;

        // Read transfer_id
        if offset + transfer_id_len as usize > data.len() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "Invalid transfer_id length",
            ));
        }
        let transfer_id = String::from_utf8(
            data[offset..offset + transfer_id_len as usize].to_vec(),
        )
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "Invalid UTF-8 in transfer_id"))?;
        offset += transfer_id_len as usize;

        // Read offset (8 bytes)
        if offset + 8 > data.len() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "Incomplete offset",
            ));
        }
        let file_offset = u64::from_be_bytes([
            data[offset],
            data[offset + 1],
            data[offset + 2],
            data[offset + 3],
            data[offset + 4],
            data[offset + 5],
            data[offset + 6],
            data[offset + 7],
        ]);
        offset += 8;

        // Read chunk_size (4 bytes)
        if offset + 4 > data.len() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "Incomplete chunk_size",
            ));
        }
        let chunk_size = u32::from_be_bytes([
            data[offset],
            data[offset + 1],
            data[offset + 2],
            data[offset + 3],
        ]);
        offset += 4;

        Ok((
            Self {
                transfer_id_len,
                transfer_id,
                offset: file_offset,
                chunk_size,
            },
            offset,
        ))
    }
}

/// File transfer acknowledgment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileAckPayload {
    pub transfer_id: String,
    pub offset: u64,
}

/// File transfer complete notification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileCompletePayload {
    #[serde(rename = "type", default = "default_file_complete_type")]
    pub msg_type: String,
    pub transfer_id: String,
    pub checksum: String, // SHA-256 hash for verification
}

fn default_file_complete_type() -> String {
    "FILE_COMPLETE".to_string()
}

/// File transfer cancellation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileCancelPayload {
    #[serde(rename = "type", default = "default_file_cancel_type")]
    pub msg_type: String,
    pub transfer_id: String,
    pub reason: Option<String>,
}

fn default_file_cancel_type() -> String {
    "FILE_CANCEL".to_string()
}

/// File transfer rejection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileRejectPayload {
    #[serde(rename = "type", default = "default_file_reject_type")]
    pub msg_type: String,
    pub transfer_id: String,
    pub reason: String,
}

fn default_file_reject_type() -> String {
    "FILE_REJECT".to_string()
}

/// Heartbeat message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatPayload {
    pub device_id: String,
    pub timestamp: i64,
}

/// Error message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorPayload {
    pub code: String,
    pub message: String,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Serialize a payload to JSON bytes
pub fn serialize_json<T: Serialize>(payload: &T) -> Result<Vec<u8>, String> {
    serde_json::to_vec(payload).map_err(|e| format!("Serialization error: {}", e))
}

/// Deserialize JSON bytes to payload
pub fn deserialize_json<'a, T: Deserialize<'a>>(data: &'a [u8]) -> Result<T, String> {
    serde_json::from_slice(data).map_err(|e| format!("Deserialization error: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_frame_encode_decode() {
        let payload = b"Hello, World!".to_vec();
        let frame = Frame::new(MessageType::TextMessage, payload.clone());

        let encoded = frame.encode();
        let mut cursor = std::io::Cursor::new(encoded);
        let decoded = Frame::decode(&mut cursor).unwrap();

        assert_eq!(decoded.message_type, MessageType::TextMessage);
        assert_eq!(decoded.payload, payload);
    }

    #[test]
    fn test_file_data_header() {
        let header = FileDataHeader {
            transfer_id_len: 36,
            transfer_id: "550e8400-e29b-41d4-a716-446655440000".to_string(),
            offset: 1024,
            chunk_size: 262144,
        };

        let encoded = header.encode();
        let (decoded, _) = FileDataHeader::decode(&encoded).unwrap();

        assert_eq!(decoded.transfer_id, header.transfer_id);
        assert_eq!(decoded.offset, header.offset);
        assert_eq!(decoded.chunk_size, header.chunk_size);
    }

    #[test]
    fn test_message_type_conversion() {
        assert_eq!(MessageType::from_u8(0x01), Some(MessageType::Hello));
        assert_eq!(MessageType::from_u8(0x04), Some(MessageType::FileData));
        assert_eq!(MessageType::from_u8(0xFF), None);
    }

    #[test]
    fn test_payload_size_limit() {
        let mut large_payload = vec![0u8; (MAX_PAYLOAD_SIZE + 1) as usize];
        large_payload[0..4].copy_from_slice(&((MAX_PAYLOAD_SIZE + 1) as u32).to_be_bytes());
        large_payload[4] = MessageType::TextMessage as u8;

        let mut cursor = std::io::Cursor::new(large_payload);
        assert!(Frame::decode(&mut cursor).is_err());
    }
}
