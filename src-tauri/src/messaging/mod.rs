//! Messaging Module
//!
//! Handles text message sending, receiving, and storage.
//! Includes group chat support with temporary host model.

pub mod group;
pub mod service;

pub use group::{
    GroupChat, GroupControlAction, GroupControlPayload, GroupMember, GroupMemberInfo,
    GroupMessage, GroupMessagePayload, GroupRole, GroupService, GroupSummary,
};
pub use service::{Message, MessageStatus, MessageType, MessagingService, Thread};
