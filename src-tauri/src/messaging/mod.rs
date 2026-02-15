//! Messaging Module
//!
//! Handles text message sending, receiving, and storage.

pub mod service;

pub use service::{Message, MessageType, MessagingService, Thread};
