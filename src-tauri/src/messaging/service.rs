//! Messaging Service
//!
//! Handles text message sending, receiving, and storage.

use crate::network::{serialize_json, TcpClient, TextMessagePayload};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;
use uuid::Uuid;

/// Delivery status of a message – mirrors the frontend `MessageStatus` type.
/// Serialised in lowercase to match TypeScript conventions.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MessageStatus {
    /// Message was queued / transmitted to the network by the sender.
    Sent,
    /// Message was received and stored on the recipient device.
    Delivered,
    /// The recipient has opened the conversation and seen the message.
    Read,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum MessageType {
    Text { content: String },
    Emoji { emoji: String },
    Reply { content: String, reply_to: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub from_device_id: String,
    pub to_device_id: String,
    pub message_type: MessageType,
    pub timestamp: i64,
    pub thread_id: Option<String>,
    /// Delivery / read status – replaces the old `read: bool` field.
    pub status: MessageStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Thread {
    pub id: String,
    pub participants: Vec<String>,
    pub last_message_timestamp: i64,
    pub unread_count: u32,
}

pub struct MessagingService {
    messages: Arc<RwLock<HashMap<String, Vec<Message>>>>,
    threads: Arc<RwLock<HashMap<String, Thread>>>,
    tcp_client: Option<Arc<TcpClient>>,
    tcp_port: u16,
}

impl MessagingService {
    pub fn new() -> Self {
        Self {
            messages: Arc::new(RwLock::new(HashMap::new())),
            threads: Arc::new(RwLock::new(HashMap::new())),
            tcp_client: None,
            tcp_port: 8080,
        }
    }

    pub fn set_tcp_client(&mut self, client: Arc<TcpClient>) {
        self.tcp_client = Some(client);
    }

    pub fn set_tcp_port(&mut self, port: u16) {
        self.tcp_port = port;
    }

    // -------------------------------------------------------------------------
    // Connection management
    // -------------------------------------------------------------------------

    /// Proactively verify or establish the TCP connection to a peer device so
    /// that the first real message can be sent without any handshake delay.
    ///
    /// Returns `Ok(latency_ms)` when the connection is confirmed alive,
    /// `Err` if the device is unreachable.
    pub async fn ensure_connected(
        &self,
        device_id: &str,
        peer_address: &str,
        app_handle: AppHandle,
    ) -> Result<u64, String> {
        let client = self
            .tcp_client
            .as_ref()
            .ok_or_else(|| "TCP client not initialised".to_string())?;

        let result = client
            .ensure_connected(device_id, peer_address, self.tcp_port)
            .await;

        match &result {
            Ok(latency_ms) => {
                let _ = app_handle.emit(
                    "connection-status",
                    serde_json::json!({
                        "device_id": device_id,
                        "connected": true,
                        "latency_ms": latency_ms,
                    }),
                );
            }
            Err(e) => {
                let _ = app_handle.emit(
                    "connection-status",
                    serde_json::json!({
                        "device_id": device_id,
                        "connected": false,
                        "error": e,
                    }),
                );
            }
        }

        result
    }

    // -------------------------------------------------------------------------
    // Sending
    // -------------------------------------------------------------------------

    pub async fn send_message(
        &self,
        from_device_id: String,
        to_device_id: String,
        message_type: MessageType,
        peer_address: String,
        app_handle: AppHandle,
    ) -> Result<Message, String> {
        let message = Message {
            id: Uuid::new_v4().to_string(),
            from_device_id: from_device_id.clone(),
            to_device_id: to_device_id.clone(),
            message_type: message_type.clone(),
            timestamp: chrono::Utc::now().timestamp(),
            thread_id: None,
            // Our own outbound message starts as "sent" (not yet confirmed by peer).
            status: MessageStatus::Sent,
        };

        // Store locally.
        let conversation_key = Self::get_conversation_key(&from_device_id, &to_device_id);
        {
            let mut messages = self.messages.write().await;
            messages
                .entry(conversation_key.clone())
                .or_insert_with(Vec::new)
                .push(message.clone());
        }

        // Update / create thread entry.
        {
            let mut threads = self.threads.write().await;
            threads
                .entry(conversation_key)
                .and_modify(|t| t.last_message_timestamp = message.timestamp)
                .or_insert_with(|| Thread {
                    id: Uuid::new_v4().to_string(),
                    participants: vec![from_device_id.clone(), to_device_id.clone()],
                    last_message_timestamp: message.timestamp,
                    unread_count: 0,
                });
        }

        // Transmit over the network.
        if let Some(client) = &self.tcp_client {
            let content = match &message_type {
                MessageType::Text { content } => content.clone(),
                MessageType::Emoji { emoji } => emoji.clone(),
                MessageType::Reply { content, .. } => content.clone(),
            };

            let payload = TextMessagePayload {
                msg_type: "TEXT_MESSAGE".to_string(),
                id: message.id.clone(),
                from_device_id: from_device_id.clone(),
                to_device_id: to_device_id.clone(),
                content,
                timestamp: message.timestamp,
                thread_id: None,
            };

            let payload_bytes = serialize_json(&payload)?;
            client
                .send_text_message(&to_device_id, &peer_address, self.tcp_port, payload_bytes)
                .await?;
        }

        let _ = app_handle.emit("message-sent", &message);
        Ok(message)
    }

    // -------------------------------------------------------------------------
    // Receiving
    // -------------------------------------------------------------------------

    pub async fn receive_message(
        &self,
        payload: TextMessagePayload,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let message = Message {
            id: payload.id,
            from_device_id: payload.from_device_id.clone(),
            to_device_id: payload.to_device_id.clone(),
            message_type: MessageType::Text {
                content: payload.content,
            },
            timestamp: payload.timestamp,
            thread_id: payload.thread_id,
            // A message that has arrived on this device is "delivered".
            // It becomes "read" when the recipient opens the conversation.
            status: MessageStatus::Delivered,
        };

        let conversation_key =
            Self::get_conversation_key(&message.from_device_id, &message.to_device_id);

        {
            let mut messages = self.messages.write().await;
            messages
                .entry(conversation_key.clone())
                .or_insert_with(Vec::new)
                .push(message.clone());
        }

        // Update thread unread counter (only non-Read messages count).
        {
            let mut threads = self.threads.write().await;
            threads
                .entry(conversation_key)
                .and_modify(|t| {
                    t.last_message_timestamp = message.timestamp;
                    t.unread_count += 1;
                })
                .or_insert_with(|| Thread {
                    id: Uuid::new_v4().to_string(),
                    participants: vec![
                        message.from_device_id.clone(),
                        message.to_device_id.clone(),
                    ],
                    last_message_timestamp: message.timestamp,
                    unread_count: 1,
                });
        }

        let _ = app_handle.emit("message-received", message);
        Ok(())
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    pub async fn get_messages(&self, device1: &str, device2: &str) -> Vec<Message> {
        let key = Self::get_conversation_key(device1, device2);
        let messages = self.messages.read().await;
        messages.get(&key).cloned().unwrap_or_default()
    }

    pub async fn get_threads(&self) -> Vec<Thread> {
        let threads = self.threads.read().await;
        let mut list: Vec<Thread> = threads.values().cloned().collect();
        list.sort_by(|a, b| b.last_message_timestamp.cmp(&a.last_message_timestamp));
        list
    }

    // -------------------------------------------------------------------------
    // Mark as read / delivered
    // -------------------------------------------------------------------------

    /// Mark a single message as `Read`.
    pub async fn mark_as_read(
        &self,
        message_id: &str,
        conversation_key: &str,
    ) -> Result<(), String> {
        let mut messages = self.messages.write().await;
        if let Some(conversation) = messages.get_mut(conversation_key) {
            if let Some(msg) = conversation.iter_mut().find(|m| m.id == message_id) {
                msg.status = MessageStatus::Read;
                return Ok(());
            }
        }
        Err("Message not found".to_string())
    }

    /// Mark **all** messages in a conversation that were sent by `sender_device_id` as `Read`.
    /// Called when the local user opens a chat window – clears the unread badge.
    pub async fn mark_conversation_as_read(
        &self,
        conversation_key: &str,
        reader_device_id: &str,
    ) -> Result<u32, String> {
        let mut marked = 0u32;

        {
            let mut messages = self.messages.write().await;
            if let Some(conversation) = messages.get_mut(conversation_key) {
                for msg in conversation.iter_mut() {
                    // Only mark messages that were NOT sent by the reader and are not yet read.
                    if msg.from_device_id != reader_device_id && msg.status != MessageStatus::Read {
                        msg.status = MessageStatus::Read;
                        marked += 1;
                    }
                }
            }
        }

        // Recalculate the thread unread count.
        {
            let mut threads = self.threads.write().await;
            if let Some(thread) = threads.get_mut(conversation_key) {
                thread.unread_count = 0;
            }
        }

        Ok(marked)
    }

    /// Reset a thread's unread counter (legacy helper, kept for compatibility).
    pub async fn mark_thread_as_read(&self, thread_id: &str) -> Result<(), String> {
        let mut threads = self.threads.write().await;
        if let Some(thread) = threads.get_mut(thread_id) {
            thread.unread_count = 0;
            Ok(())
        } else {
            Err("Thread not found".to_string())
        }
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    fn get_conversation_key(device1: &str, device2: &str) -> String {
        let mut participants = vec![device1, device2];
        participants.sort();
        participants.join("_")
    }
}

impl Clone for MessagingService {
    fn clone(&self) -> Self {
        Self {
            messages: Arc::clone(&self.messages),
            threads: Arc::clone(&self.threads),
            tcp_client: self.tcp_client.clone(),
            tcp_port: self.tcp_port,
        }
    }
}
