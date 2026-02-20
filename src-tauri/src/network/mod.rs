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
pub use file_transfer::{FileTransfer, FileTransferService};
pub use protocol::{serialize_json, Frame, MessageAckPayload, MessageType, TextMessagePayload};
pub use server::TcpServer;
