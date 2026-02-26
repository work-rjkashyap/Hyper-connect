//! Screen Share Module
//!
//! LAN screen sharing via UDP frame streaming with signaling over existing TCP connections.
//! Captures screen frames, encodes as JPEG, and streams to viewers over UDP.

pub mod service;
pub mod types;

pub use service::ScreenShareService;
pub use types::ScreenShareSession;
