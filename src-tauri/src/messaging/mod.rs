//! Messaging Module
//!
//! Handles text message sending, receiving, and storage.

pub mod service;

pub use service::{Message, MessageStatus, MessageType, MessagingService, Thread};
