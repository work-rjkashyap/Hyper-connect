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
    pub read: bool,
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
            read: false,
        };

        // Store locally
        let conversation_key = Self::get_conversation_key(&from_device_id, &to_device_id);
        {
            let mut messages = self.messages.write().await;
            messages
                .entry(conversation_key.clone())
                .or_insert_with(Vec::new)
                .push(message.clone());
        }

        // Update thread
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

        // Send over network
        if let Some(client) = &self.tcp_client {
            let content = match &message_type {
                MessageType::Text { content } => content.clone(),
                MessageType::Emoji { emoji } => emoji.clone(),
                MessageType::Reply { content, .. } => content.clone(),
            };

            let payload = TextMessagePayload {
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
            read: false,
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

        {
            let mut threads = self.threads.write().await;
            threads.entry(conversation_key).and_modify(|t| {
                t.last_message_timestamp = message.timestamp;
                t.unread_count += 1;
            });
        }

        let _ = app_handle.emit("message-received", message);
        Ok(())
    }

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

    pub async fn mark_as_read(&self, message_id: &str, conversation_key: &str) -> Result<(), String> {
        let mut messages = self.messages.write().await;
        if let Some(conversation) = messages.get_mut(conversation_key) {
            if let Some(msg) = conversation.iter_mut().find(|m| m.id == message_id) {
                msg.read = true;
                return Ok(());
            }
        }
        Err("Message not found".to_string())
    }

    pub async fn mark_thread_as_read(&self, thread_id: &str) -> Result<(), String> {
        let mut threads = self.threads.write().await;
        if let Some(thread) = threads.get_mut(thread_id) {
            thread.unread_count = 0;
            Ok(())
        } else {
            Err("Thread not found".to_string())
        }
    }

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
