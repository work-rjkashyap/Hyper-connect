use serde::{Deserialize, Serialize};
use std::io::{self, Read, Write};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

/// Protocol version for compatibility checking
pub const PROTOCOL_VERSION: u8 = 1;

/// Message types for the protocol
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum MessageType {
    TextMessage = 0x01,
    FileTransferRequest = 0x02,
    FileTransferChunk = 0x03,
    FileTransferAck = 0x04,
    Heartbeat = 0x05,
    FileTransferComplete = 0x06,
    FileTransferCancel = 0x07,
}

impl MessageType {
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0x01 => Some(MessageType::TextMessage),
            0x02 => Some(MessageType::FileTransferRequest),
            0x03 => Some(MessageType::FileTransferChunk),
            0x04 => Some(MessageType::FileTransferAck),
            0x05 => Some(MessageType::Heartbeat),
            0x06 => Some(MessageType::FileTransferComplete),
            0x07 => Some(MessageType::FileTransferCancel),
            _ => None,
        }
    }
}

/// Frame structure: [4-byte length][1-byte type][payload]
#[derive(Debug, Clone)]
pub struct Frame {
    pub message_type: MessageType,
    pub payload: Vec<u8>,
}

impl Frame {
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

    /// Decode frame from bytes (synchronous)
    pub fn decode<R: Read>(reader: &mut R) -> io::Result<Self> {
        // Read length (4 bytes)
        let mut len_bytes = [0u8; 4];
        reader.read_exact(&mut len_bytes)?;
        let payload_len = u32::from_be_bytes(len_bytes) as usize;

        // Read message type (1 byte)
        let mut type_byte = [0u8; 1];
        reader.read_exact(&mut type_byte)?;
        let message_type = MessageType::from_u8(type_byte[0])
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "Invalid message type"))?;

        // Read payload
        let mut payload = vec![0u8; payload_len];
        reader.read_exact(&mut payload)?;

        Ok(Self {
            message_type,
            payload,
        })
    }

    /// Decode frame from bytes (async)
    pub async fn decode_async<R: AsyncReadExt + Unpin>(reader: &mut R) -> io::Result<Self> {
        // Read length (4 bytes)
        let mut len_bytes = [0u8; 4];
        reader.read_exact(&mut len_bytes).await?;
        let payload_len = u32::from_be_bytes(len_bytes) as usize;

        // Sanity check: prevent excessive memory allocation
        if payload_len > 100 * 1024 * 1024 {
            // 100MB max
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "Payload too large",
            ));
        }

        // Read message type (1 byte)
        let mut type_byte = [0u8; 1];
        reader.read_exact(&mut type_byte).await?;
        let message_type = MessageType::from_u8(type_byte[0])
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "Invalid message type"))?;

        // Read payload
        let mut payload = vec![0u8; payload_len];
        reader.read_exact(&mut payload).await?;

        Ok(Self {
            message_type,
            payload,
        })
    }

    /// Write frame to stream (async)
    pub async fn write_async<W: AsyncWriteExt + Unpin>(&self, writer: &mut W) -> io::Result<()> {
        let encoded = self.encode();
        writer.write_all(&encoded).await?;
        writer.flush().await?;
        Ok(())
    }

    /// Write frame to stream (synchronous)
    pub fn write<W: Write>(&self, writer: &mut W) -> io::Result<()> {
        let encoded = self.encode();
        writer.write_all(&encoded)?;
        writer.flush()?;
        Ok(())
    }
}

/// Text message payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextMessagePayload {
    pub id: String,
    pub from_device_id: String,
    pub to_device_id: String,
    pub content: String,
    pub timestamp: i64,
    pub thread_id: Option<String>,
}

/// File transfer request payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTransferRequestPayload {
    pub transfer_id: String,
    pub filename: String,
    pub file_size: u64,
    pub from_device_id: String,
    pub to_device_id: String,
    pub checksum: Option<String>,
}

/// File transfer chunk payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTransferChunkPayload {
    pub transfer_id: String,
    pub offset: u64,
    pub data: Vec<u8>,
}

/// File transfer acknowledgment payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTransferAckPayload {
    pub transfer_id: String,
    pub offset: u64,
}

/// File transfer complete payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTransferCompletePayload {
    pub transfer_id: String,
    pub checksum: String,
}

/// Heartbeat payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatPayload {
    pub device_id: String,
    pub timestamp: i64,
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
    fn test_message_type_conversion() {
        assert_eq!(MessageType::from_u8(0x01), Some(MessageType::TextMessage));
        assert_eq!(MessageType::from_u8(0x02), Some(MessageType::FileTransferRequest));
        assert_eq!(MessageType::from_u8(0xFF), None);
    }
}
