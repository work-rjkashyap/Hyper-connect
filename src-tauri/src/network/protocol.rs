//! Network Protocol
//!
//! High-performance binary protocol optimized for LAN file transfers.
//! Uses a frame-based approach with minimal overhead.
//!

#![allow(dead_code)]
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

/// Maximum payload size (100MB) - prevents memory exhaustion attacks
const MAX_PAYLOAD_SIZE: u32 = 100 * 1024 * 1024;

/// Message types for the protocol
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum MessageType {
    /// Connection handshake with device info
    #[deprecated(note = "Plaintext Hello is no longer accepted. Use HelloSecure (0x10) instead.")]
    Hello = 0x01,

    /// Text message between devices
    #[deprecated(
        note = "Plaintext TextMessage is no longer accepted. Send text inside EncryptedMessage (0x12) instead."
    )]
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

    // ============================================================================
    // Connection Health (0x14-0x15)
    // ============================================================================
    /// Liveness probe – sender expects a Pong back immediately
    Ping = 0x14,

    /// Reply to a Ping – confirms the connection and session are alive
    Pong = 0x15,

    // ============================================================================
    // Message Status ACKs (0x16-0x17)
    // ============================================================================
    /// Delivery acknowledgement – recipient confirms they received a message
    MessageDelivered = 0x16,

    /// Read receipt – recipient confirms they have opened and read the message(s)
    MessageRead = 0x17,

    // ============================================================================
    // SAS Verification (0x18-0x19)
    // ============================================================================
    /// SAS verification confirmed — the local user verified the code matches
    SasConfirm = 0x18,

    /// SAS verification rejected — the local user says the codes don't match
    SasReject = 0x19,

    /// SAS verification request — asks the peer to start the verification flow
    SasVerifyRequest = 0x1A,
}

impl MessageType {
    /// Convert from byte to MessageType.
    ///
    /// Note: deprecated variants are still parsed here so the server can
    /// produce a meaningful rejection error when a legacy client connects.
    #[allow(deprecated)]
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
            0x14 => Some(MessageType::Ping),
            0x15 => Some(MessageType::Pong),
            0x16 => Some(MessageType::MessageDelivered),
            0x17 => Some(MessageType::MessageRead),
            // SAS verification types
            0x18 => Some(MessageType::SasConfirm),
            0x19 => Some(MessageType::SasReject),
            0x1A => Some(MessageType::SasVerifyRequest),
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
    /// Byte offset to resume from (0 = fresh transfer, >0 = resume).
    #[serde(default)]
    pub resume_offset: u64,
    /// Compression algorithm used for this transfer (e.g. "zstd", or empty/None for no compression).
    /// The sender advertises this; the receiver must support it or the transfer falls back to uncompressed.
    #[serde(default)]
    pub compression: Option<String>,
    /// Number of parallel TCP streams the sender intends to use for this transfer.
    /// 1 = single-stream (default/legacy), >1 = parallel chunked transfer.
    /// The receiver should expect data chunks arriving out-of-order from multiple connections.
    #[serde(default = "default_parallel_streams")]
    pub parallel_streams: u8,
}

fn default_parallel_streams() -> u8 {
    1
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
    pub chunk_size: u32,     // Size of following data chunk (uncompressed)
    /// Size of the compressed payload that follows the header.
    /// When 0, the data is uncompressed and `chunk_size` bytes follow.
    /// When >0, `compressed_size` bytes of zstd-compressed data follow,
    /// which decompress to `chunk_size` bytes.
    pub compressed_size: u32,
}

impl FileDataHeader {
    /// Encode header to bytes
    pub fn encode(&self) -> Vec<u8> {
        let mut buffer = Vec::with_capacity(1 + self.transfer_id.len() + 8 + 4 + 4);

        // Transfer ID length (1 byte)
        buffer.push(self.transfer_id_len);

        // Transfer ID (variable length)
        buffer.extend_from_slice(self.transfer_id.as_bytes());

        // Offset (8 bytes)
        buffer.extend_from_slice(&self.offset.to_be_bytes());

        // Chunk size (4 bytes) — uncompressed size
        buffer.extend_from_slice(&self.chunk_size.to_be_bytes());

        // Compressed size (4 bytes) — 0 means uncompressed
        buffer.extend_from_slice(&self.compressed_size.to_be_bytes());

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

        // Read compressed_size (4 bytes) — optional for backward compat
        let compressed_size = if offset + 4 <= data.len() {
            let cs = u32::from_be_bytes([
                data[offset],
                data[offset + 1],
                data[offset + 2],
                data[offset + 3],
            ]);
            offset += 4;
            cs
        } else {
            0 // No compression field present (legacy sender)
        };

        Ok((
            Self {
                transfer_id_len,
                transfer_id,
                offset: file_offset,
                chunk_size,
                compressed_size,
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

/// Error message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorPayload {
    pub code: String,
    pub message: String,
}

/// Message delivery / read acknowledgement
///
/// Sent from the *recipient* back to the *original sender* to update the
/// delivery status of one or more messages.
///
/// - `msg_type` = `"MESSAGE_DELIVERED"` – a single message was received.
/// - `msg_type` = `"MESSAGE_READ"`      – all messages in the conversation
///    sent by `to_device_id` have been opened by `from_device_id`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageAckPayload {
    /// Discriminant: "MESSAGE_DELIVERED" or "MESSAGE_READ"
    #[serde(rename = "type")]
    pub msg_type: String,
    /// Sorted, underscore-joined participant IDs (same key used by both sides)
    pub conversation_key: String,
    /// Present for delivery ACKs; absent for conversation-level read receipts
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
    /// Device that is sending this acknowledgement (the message recipient)
    pub from_device_id: String,
    /// Device that should receive this acknowledgement (the message sender)
    pub to_device_id: String,
}

/// Ping – liveness probe sent by the client before assuming the connection is
/// still usable.  The peer must reply immediately with a `PongPayload`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingPayload {
    /// Sender's device ID
    pub device_id: String,
    /// Unix timestamp (ms) at send time – echoed back so the caller can
    /// compute round-trip latency.
    pub sent_at_ms: i64,
}

/// Pong – sent in direct response to a `PingPayload`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PongPayload {
    /// Responding device's ID
    pub device_id: String,
    /// Original `sent_at_ms` from the ping – returned unchanged
    pub sent_at_ms: i64,
}

// ============================================================================
// SAS Verification Payloads
// ============================================================================

/// Sent when the local user confirms that the SAS verification code matches
/// what the peer is displaying. The peer should transition the verification
/// state accordingly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SasConfirmPayload {
    /// Device ID of the user who confirmed
    pub device_id: String,
    /// The verification code the user saw (formatted as "XXX-XXX")
    pub verification_code: String,
}

/// Sent when the local user rejects the SAS verification code (it does not
/// match what the peer is showing). Both sides should tear down the session
/// or at least mark it as unverified.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SasRejectPayload {
    /// Device ID of the user who rejected
    pub device_id: String,
    /// Optional reason for rejection
    pub reason: Option<String>,
}

/// Sent to request the peer to start the SAS verification flow.
/// On receipt, the peer derives the verification code from the existing
/// ECDH session's shared secret and presents it to the user.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SasVerifyRequestPayload {
    /// Device ID of the user who initiated verification
    pub device_id: String,
    /// Display name of the initiator (for the peer's UI)
    pub display_name: String,
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
#[allow(deprecated)]
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
            compressed_size: 0,
        };

        let encoded = header.encode();
        let (decoded, _) = FileDataHeader::decode(&encoded).unwrap();

        assert_eq!(decoded.transfer_id, header.transfer_id);
        assert_eq!(decoded.offset, header.offset);
        assert_eq!(decoded.chunk_size, header.chunk_size);
        assert_eq!(decoded.compressed_size, 0);
    }

    #[test]
    fn test_file_data_header_compressed() {
        let header = FileDataHeader {
            transfer_id_len: 36,
            transfer_id: "550e8400-e29b-41d4-a716-446655440000".to_string(),
            offset: 2048,
            chunk_size: 262144,
            compressed_size: 131072,
        };

        let encoded = header.encode();
        let (decoded, _) = FileDataHeader::decode(&encoded).unwrap();

        assert_eq!(decoded.transfer_id, header.transfer_id);
        assert_eq!(decoded.offset, header.offset);
        assert_eq!(decoded.chunk_size, header.chunk_size);
        assert_eq!(decoded.compressed_size, 131072);
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
