//! Screen Share Types
//!
//! Data structures for screen sharing signaling, session state, and UDP frame headers.

use serde::{Deserialize, Serialize};

// ============================================================================
// SESSION STATE
// ============================================================================

/// Represents the current state of a screen share session.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScreenShareState {
    /// No active session
    Idle,
    /// Offer sent, waiting for answer
    Offering,
    /// Offer received, waiting for local user to accept/reject
    AwaitingAcceptance,
    /// Session is active and streaming
    Streaming,
    /// Session is stopping
    Stopping,
}

impl Default for ScreenShareState {
    fn default() -> Self {
        Self::Idle
    }
}

/// Quality preset for screen sharing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StreamQuality {
    /// 720p, 15fps, 60% JPEG quality — low bandwidth
    Low,
    /// 1080p, 24fps, 75% JPEG quality — balanced
    Medium,
    /// Native resolution, 30fps, 85% JPEG quality — best quality
    High,
}

impl Default for StreamQuality {
    fn default() -> Self {
        Self::Medium
    }
}

impl StreamQuality {
    /// Target frames per second for this quality level.
    pub fn target_fps(&self) -> u32 {
        match self {
            Self::Low => 15,
            Self::Medium => 24,
            Self::High => 30,
        }
    }

    /// JPEG quality (1-100) for this quality level.
    pub fn jpeg_quality(&self) -> u8 {
        match self {
            Self::Low => 60,
            Self::Medium => 75,
            Self::High => 85,
        }
    }

    /// Max width in pixels. Frames wider than this will be downscaled.
    pub fn max_width(&self) -> u32 {
        match self {
            Self::Low => 1280,
            Self::Medium => 1920,
            Self::High => 0, // 0 = native, no downscale
        }
    }

    /// Max height in pixels. Frames taller than this will be downscaled.
    pub fn max_height(&self) -> u32 {
        match self {
            Self::Low => 720,
            Self::Medium => 1080,
            Self::High => 0, // 0 = native
        }
    }

    /// Frame interval in milliseconds.
    pub fn frame_interval_ms(&self) -> u64 {
        1000 / self.target_fps() as u64
    }
}

/// Represents an active screen share session between two devices.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenShareSession {
    /// Unique session identifier (UUID v4)
    pub session_id: String,
    /// Device ID of the broadcaster (screen sharer)
    pub broadcaster_id: String,
    /// Display name of the broadcaster
    pub broadcaster_name: String,
    /// Device ID of the viewer
    pub viewer_id: String,
    /// Display name of the viewer
    pub viewer_name: String,
    /// Current session state
    pub state: ScreenShareState,
    /// Quality preset
    pub quality: StreamQuality,
    /// UDP port the broadcaster is streaming on
    pub stream_port: u16,
    /// Screen/display index being shared (0 = primary)
    pub display_index: u32,
    /// Original screen width in pixels
    pub screen_width: u32,
    /// Original screen height in pixels
    pub screen_height: u32,
    /// Timestamp when session was created (epoch seconds)
    pub created_at: i64,
    /// Timestamp of last activity (epoch seconds)
    pub updated_at: i64,
}

impl ScreenShareSession {
    pub fn new(
        session_id: String,
        broadcaster_id: String,
        broadcaster_name: String,
        viewer_id: String,
        viewer_name: String,
        quality: StreamQuality,
        stream_port: u16,
        display_index: u32,
    ) -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            session_id,
            broadcaster_id,
            broadcaster_name,
            viewer_id,
            viewer_name,
            state: ScreenShareState::Idle,
            quality,
            stream_port,
            display_index,
            screen_width: 0,
            screen_height: 0,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn is_active(&self) -> bool {
        self.state == ScreenShareState::Streaming
    }
}

// ============================================================================
// SIGNALING PAYLOADS (sent over existing encrypted TCP channel)
// ============================================================================

/// Sent by the broadcaster to initiate a screen share session.
/// Transmitted as an encrypted message with `type: "SCREEN_SHARE_OFFER"`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenShareOfferPayload {
    /// Inner message type discriminator for the encrypted channel router.
    #[serde(rename = "type", default = "default_offer_type")]
    pub msg_type: String,
    /// Unique session ID (UUID v4)
    pub session_id: String,
    /// Device ID of the broadcaster
    pub from_device_id: String,
    /// Display name of the broadcaster
    pub from_display_name: String,
    /// Device ID of the intended viewer
    pub to_device_id: String,
    /// Quality preset requested
    pub quality: StreamQuality,
    /// Display/screen index being shared
    pub display_index: u32,
    /// UDP port the broadcaster will stream frames on
    pub stream_port: u16,
    /// Width of the screen being shared
    pub screen_width: u32,
    /// Height of the screen being shared
    pub screen_height: u32,
}

fn default_offer_type() -> String {
    "SCREEN_SHARE_OFFER".to_string()
}

/// Sent by the viewer to accept or reject a screen share offer.
/// Transmitted as an encrypted message with `type: "SCREEN_SHARE_ANSWER"`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenShareAnswerPayload {
    /// Inner message type discriminator.
    #[serde(rename = "type", default = "default_answer_type")]
    pub msg_type: String,
    /// Session ID being answered
    pub session_id: String,
    /// Device ID of the viewer (responder)
    pub from_device_id: String,
    /// Device ID of the broadcaster
    pub to_device_id: String,
    /// Whether the viewer accepted the offer
    pub accepted: bool,
    /// Optional rejection reason
    pub reason: Option<String>,
}

fn default_answer_type() -> String {
    "SCREEN_SHARE_ANSWER".to_string()
}

/// Sent by either side to stop an active screen share session.
/// Transmitted as an encrypted message with `type: "SCREEN_SHARE_STOP"`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenShareStopPayload {
    /// Inner message type discriminator.
    #[serde(rename = "type", default = "default_stop_type")]
    pub msg_type: String,
    /// Session ID being stopped
    pub session_id: String,
    /// Device ID of the device requesting the stop
    pub from_device_id: String,
    /// Device ID of the other party
    pub to_device_id: String,
    /// Reason for stopping (e.g. "user_cancelled", "error", "timeout")
    pub reason: Option<String>,
}

fn default_stop_type() -> String {
    "SCREEN_SHARE_STOP".to_string()
}

// ============================================================================
// UDP FRAME HEADER (prepended to each JPEG frame sent over UDP)
// ============================================================================

/// Binary header prepended to each UDP datagram carrying a screen share frame chunk.
///
/// A single captured frame may be split across multiple UDP datagrams if it
/// exceeds the MTU. The viewer reassembles them using `frame_seq`, `chunk_index`,
/// and `total_chunks`.
///
/// Wire format (big-endian, 32 bytes total):
/// ```text
///  0..16   session_id (first 16 bytes of UUID, binary)
///  16..20  frame_seq  (u32) — monotonically increasing frame number
///  20..22  chunk_index (u16) — which chunk of this frame (0-based)
///  22..24  total_chunks (u16) — how many chunks make up this frame
///  24..28  chunk_size  (u32) — bytes of JPEG data in this datagram
///  28..30  frame_width (u16) — encoded frame width in pixels
///  30..32  frame_height (u16) — encoded frame height in pixels
/// ```
#[derive(Debug, Clone)]
pub struct ScreenShareFrameHeader {
    /// First 16 bytes of the session UUID (binary)
    pub session_id_bytes: [u8; 16],
    /// Monotonically increasing frame sequence number
    pub frame_seq: u32,
    /// Index of this chunk within the frame (0-based)
    pub chunk_index: u16,
    /// Total number of chunks that make up the complete frame
    pub total_chunks: u16,
    /// Number of bytes of JPEG payload in this datagram
    pub chunk_size: u32,
    /// Width of the encoded frame
    pub frame_width: u16,
    /// Height of the encoded frame
    pub frame_height: u16,
}

/// Size of the binary frame header in bytes.
pub const FRAME_HEADER_SIZE: usize = 32;

/// Maximum UDP payload size. We target 1400 bytes to stay well under
/// typical 1500-byte Ethernet MTU (minus IP + UDP headers).
pub const MAX_UDP_PAYLOAD: usize = 1400;

/// Maximum JPEG data per UDP datagram.
pub const MAX_CHUNK_DATA: usize = MAX_UDP_PAYLOAD - FRAME_HEADER_SIZE;

impl ScreenShareFrameHeader {
    /// Encode the header into a 32-byte big-endian buffer.
    pub fn encode(&self) -> [u8; FRAME_HEADER_SIZE] {
        let mut buf = [0u8; FRAME_HEADER_SIZE];
        buf[0..16].copy_from_slice(&self.session_id_bytes);
        buf[16..20].copy_from_slice(&self.frame_seq.to_be_bytes());
        buf[20..22].copy_from_slice(&self.chunk_index.to_be_bytes());
        buf[22..24].copy_from_slice(&self.total_chunks.to_be_bytes());
        buf[24..28].copy_from_slice(&self.chunk_size.to_be_bytes());
        buf[28..30].copy_from_slice(&self.frame_width.to_be_bytes());
        buf[30..32].copy_from_slice(&self.frame_height.to_be_bytes());
        buf
    }

    /// Decode a 32-byte big-endian buffer into a frame header.
    /// Returns `None` if the buffer is too short.
    pub fn decode(buf: &[u8]) -> Option<Self> {
        if buf.len() < FRAME_HEADER_SIZE {
            return None;
        }

        let mut session_id_bytes = [0u8; 16];
        session_id_bytes.copy_from_slice(&buf[0..16]);

        Some(Self {
            session_id_bytes,
            frame_seq: u32::from_be_bytes([buf[16], buf[17], buf[18], buf[19]]),
            chunk_index: u16::from_be_bytes([buf[20], buf[21]]),
            total_chunks: u16::from_be_bytes([buf[22], buf[23]]),
            chunk_size: u32::from_be_bytes([buf[24], buf[25], buf[26], buf[27]]),
            frame_width: u16::from_be_bytes([buf[28], buf[29]]),
            frame_height: u16::from_be_bytes([buf[30], buf[31]]),
        })
    }

    /// Convert a UUID string to the 16-byte binary representation used in the header.
    /// Strips hyphens and parses hex. Returns zeros on failure.
    pub fn uuid_to_bytes(uuid_str: &str) -> [u8; 16] {
        let hex: String = uuid_str.chars().filter(|c| *c != '-').collect();
        let mut bytes = [0u8; 16];
        if hex.len() == 32 {
            for i in 0..16 {
                bytes[i] = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16).unwrap_or(0);
            }
        }
        bytes
    }

    /// Convert the 16-byte binary session ID back to a UUID string with hyphens.
    pub fn bytes_to_uuid(bytes: &[u8; 16]) -> String {
        let hex: String = bytes.iter().map(|b| format!("{:02x}", b)).collect();
        format!(
            "{}-{}-{}-{}-{}",
            &hex[0..8],
            &hex[8..12],
            &hex[12..16],
            &hex[16..20],
            &hex[20..32],
        )
    }
}

// ============================================================================
// FRONTEND EVENT TYPES (emitted to the React frontend via Tauri events)
// ============================================================================

/// Emitted when a screen share offer is received from a remote device.
/// Event name: `screen-share-offer`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenShareOfferEvent {
    pub session_id: String,
    pub from_device_id: String,
    pub from_display_name: String,
    pub quality: StreamQuality,
    pub screen_width: u32,
    pub screen_height: u32,
}

/// Emitted when a screen share answer is received.
/// Event name: `screen-share-answer`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenShareAnswerEvent {
    pub session_id: String,
    pub from_device_id: String,
    pub accepted: bool,
    pub reason: Option<String>,
}

/// Emitted when a screen share session is stopped.
/// Event name: `screen-share-stopped`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenShareStoppedEvent {
    pub session_id: String,
    pub from_device_id: String,
    pub reason: Option<String>,
}

/// Emitted periodically with streaming statistics.
/// Event name: `screen-share-stats`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenShareStatsEvent {
    pub session_id: String,
    /// Current frames per second being sent/received
    pub fps: f32,
    /// Average frame size in bytes
    pub avg_frame_size: u64,
    /// Total bytes transferred in this session
    pub total_bytes: u64,
    /// Estimated latency in milliseconds (broadcaster → viewer)
    pub latency_ms: u32,
    /// Number of dropped/lost frames
    pub dropped_frames: u64,
}

/// Emitted when the local screen share state changes.
/// Event name: `screen-share-state-changed`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenShareStateChangedEvent {
    pub session_id: String,
    pub state: ScreenShareState,
    /// "broadcaster" or "viewer"
    pub role: String,
    pub peer_device_id: String,
    pub peer_display_name: String,
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_frame_header_encode_decode() {
        let session_bytes = ScreenShareFrameHeader::uuid_to_bytes(
            "550e8400-e29b-41d4-a716-446655440000",
        );
        let header = ScreenShareFrameHeader {
            session_id_bytes: session_bytes,
            frame_seq: 42,
            chunk_index: 0,
            total_chunks: 3,
            chunk_size: 1200,
            frame_width: 1920,
            frame_height: 1080,
        };

        let encoded = header.encode();
        assert_eq!(encoded.len(), FRAME_HEADER_SIZE);

        let decoded = ScreenShareFrameHeader::decode(&encoded).unwrap();
        assert_eq!(decoded.session_id_bytes, session_bytes);
        assert_eq!(decoded.frame_seq, 42);
        assert_eq!(decoded.chunk_index, 0);
        assert_eq!(decoded.total_chunks, 3);
        assert_eq!(decoded.chunk_size, 1200);
        assert_eq!(decoded.frame_width, 1920);
        assert_eq!(decoded.frame_height, 1080);
    }

    #[test]
    fn test_uuid_roundtrip() {
        let uuid = "550e8400-e29b-41d4-a716-446655440000";
        let bytes = ScreenShareFrameHeader::uuid_to_bytes(uuid);
        let back = ScreenShareFrameHeader::bytes_to_uuid(&bytes);
        assert_eq!(uuid, back);
    }

    #[test]
    fn test_decode_too_short() {
        let buf = [0u8; 10];
        assert!(ScreenShareFrameHeader::decode(&buf).is_none());
    }

    #[test]
    fn test_quality_presets() {
        assert_eq!(StreamQuality::Low.target_fps(), 15);
        assert_eq!(StreamQuality::Medium.target_fps(), 24);
        assert_eq!(StreamQuality::High.target_fps(), 30);

        assert_eq!(StreamQuality::Low.jpeg_quality(), 60);
        assert_eq!(StreamQuality::Medium.jpeg_quality(), 75);
        assert_eq!(StreamQuality::High.jpeg_quality(), 85);
    }

    #[test]
    fn test_max_chunk_data_fits_mtu() {
        // Ensure header + max chunk data fits in our UDP payload limit
        assert_eq!(MAX_CHUNK_DATA + FRAME_HEADER_SIZE, MAX_UDP_PAYLOAD);
        // And that it's under typical MTU (1500 - 20 IP - 8 UDP = 1472)
        assert!(MAX_UDP_PAYLOAD <= 1472);
    }

    #[test]
    fn test_session_new() {
        let session = ScreenShareSession::new(
            "test-session".into(),
            "broadcaster-id".into(),
            "Broadcaster".into(),
            "viewer-id".into(),
            "Viewer".into(),
            StreamQuality::Medium,
            9090,
            0,
        );
        assert_eq!(session.state, ScreenShareState::Idle);
        assert!(!session.is_active());
        assert_eq!(session.stream_port, 9090);
    }

    #[test]
    fn test_signaling_payload_serialization() {
        let offer = ScreenShareOfferPayload {
            msg_type: "SCREEN_SHARE_OFFER".into(),
            session_id: "test-id".into(),
            from_device_id: "dev-1".into(),
            from_display_name: "Device 1".into(),
            to_device_id: "dev-2".into(),
            quality: StreamQuality::High,
            display_index: 0,
            stream_port: 9090,
            screen_width: 2560,
            screen_height: 1440,
        };

        let json = serde_json::to_string(&offer).unwrap();
        assert!(json.contains("SCREEN_SHARE_OFFER"));
        assert!(json.contains("dev-1"));

        let parsed: ScreenShareOfferPayload = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.session_id, "test-id");
        assert_eq!(parsed.quality, StreamQuality::High);
        assert_eq!(parsed.screen_width, 2560);
    }
}
