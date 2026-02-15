//! Network Module
//!
//! High-performance networking layer for file and message transfer.
//! Implements optimized TCP client/server with zero-copy streaming.

pub mod client;
pub mod file_transfer;
pub mod protocol;
pub mod secure_channel;
pub mod server;

pub use client::TcpClient;
pub use file_transfer::{FileTransfer, FileTransferService, TransferStatus};
pub use protocol::{
    deserialize_json, serialize_json, FileCompletePayload, FileDataHeader, FileRequestPayload,
    Frame, HelloPayload, MessageType, TextMessagePayload, PROTOCOL_VERSION,
};
pub use secure_channel::SecureChannelManager;
pub use server::TcpServer;
