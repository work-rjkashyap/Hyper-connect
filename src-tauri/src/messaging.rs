use crate::protocol::TextMessagePayload;
use crate::tcp_client::TcpClient;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum MessageType {
    Text { content: String },
    Emoji { emoji: String },
    Reply { content: String, reply_to: String },
    File { file_id: String, filename: String, size: u64 },
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

#[derive(Clone)]
pub struct MessagingService {
    messages: Arc<Mutex<HashMap<String, Vec<Message>>>>,
    threads: Arc<Mutex<HashMap<String, Thread>>>,
    tcp_client: Option<Arc<TcpClient>>,
}

impl MessagingService {
    pub fn new() -> Self {
        Self {
            messages: Arc::new(Mutex::new(HashMap::new())),
            threads: Arc::new(Mutex::new(HashMap::new())),
            tcp_client: None,
        }
    }

    pub fn set_tcp_client(&mut self, tcp_client: Arc<TcpClient>) {
        self.tcp_client = Some(tcp_client);
    }

    pub fn send_message(
        &self,
        from_device_id: String,
        to_device_id: String,
        message_type: MessageType,
        thread_id: Option<String>,
        peer_address: Option<String>,
        app_handle: AppHandle,
    ) -> Result<Message, String> {
        let message = Message {
            id: Uuid::new_v4().to_string(),
            from_device_id: from_device_id.clone(),
            to_device_id: to_device_id.clone(),
            message_type: message_type.clone(),
            timestamp: chrono::Utc::now().timestamp(),
            thread_id: thread_id.clone(),
            read: false,
        };

        // Store message
        let mut messages = self.messages.lock().unwrap();
        let conversation_key = Self::get_conversation_key(&from_device_id, &to_device_id);
        messages.entry(conversation_key.clone())
            .or_insert_with(Vec::new)
            .push(message.clone());
        drop(messages);

        // Update or create thread
        let actual_thread_id = thread_id.clone().unwrap_or_else(|| conversation_key);
        let mut threads = self.threads.lock().unwrap();
        threads.entry(actual_thread_id.clone())
            .and_modify(|t| {
                t.last_message_timestamp = message.timestamp;
            })
            .or_insert_with(|| Thread {
                id: actual_thread_id.clone(),
                participants: vec![from_device_id.clone(), to_device_id.clone()],
                last_message_timestamp: message.timestamp,
                unread_count: 0,
            });
        drop(threads);

        // Send over network if TCP client is available and we have peer address
        if let (Some(tcp_client), Some(address)) = (&self.tcp_client, peer_address) {
            let content = match &message_type {
                MessageType::Text { content } => content.clone(),
                MessageType::Emoji { emoji } => emoji.clone(),
                _ => String::new(),
            };

            let payload = TextMessagePayload {
                id: message.id.clone(),
                from_device_id: from_device_id.clone(),
                to_device_id: to_device_id.clone(),
                content,
                timestamp: message.timestamp,
                thread_id,
            };

            let payload_bytes = serde_json::to_vec(&payload)
                .map_err(|e| format!("Failed to serialize message: {}", e))?;

            let tcp_client = Arc::clone(tcp_client);
            let to_device = to_device_id.clone();
            tokio::spawn(async move {
                if let Err(e) = tcp_client
                    .send_text_message(&to_device, &address, 8080, payload_bytes)
                    .await
                {
                    eprintln!("Failed to send message over network: {}", e);
                }
            });
        }

        // Emit event
        let _ = app_handle.emit("message-sent", message.clone());

        Ok(message)
    }

    /// Receive a message from the network
    pub async fn receive_message_from_network(
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
            thread_id: payload.thread_id.clone(),
            read: false,
        };

        self.receive_message(message, app_handle)
    }

    #[allow(dead_code)]
    pub fn receive_message(&self, message: Message, app_handle: AppHandle) -> Result<(), String> {
        let conversation_key = Self::get_conversation_key(&message.from_device_id, &message.to_device_id);

        let mut messages = self.messages.lock().unwrap();
        messages.entry(conversation_key.clone())
            .or_insert_with(Vec::new)
            .push(message.clone());
        drop(messages);

        // Update thread
        let thread_id = message.thread_id.clone().unwrap_or(conversation_key);
        let mut threads = self.threads.lock().unwrap();
        threads.entry(thread_id.clone())
            .and_modify(|t| {
                t.last_message_timestamp = message.timestamp;
                t.unread_count += 1;
            });
        drop(threads);

        // Emit event
        let _ = app_handle.emit("message-received", message);

        Ok(())
    }

    pub fn get_messages(&self, device1: &str, device2: &str) -> Vec<Message> {
        let messages = self.messages.lock().unwrap();
        let conversation_key = Self::get_conversation_key(device1, device2);
        messages.get(&conversation_key)
            .cloned()
            .unwrap_or_default()
    }

    pub fn get_threads(&self) -> Vec<Thread> {
        let threads = self.threads.lock().unwrap();
        let mut thread_list: Vec<Thread> = threads.values().cloned().collect();
        thread_list.sort_by(|a, b| b.last_message_timestamp.cmp(&a.last_message_timestamp));
        thread_list
    }

    pub fn mark_as_read(&self, message_id: &str, conversation_key: &str) -> Result<(), String> {
        let mut messages = self.messages.lock().unwrap();
        if let Some(conversation) = messages.get_mut(conversation_key) {
            if let Some(msg) = conversation.iter_mut().find(|m| m.id == message_id) {
                msg.read = true;
                return Ok(());
            }
        }
        Err("Message not found".to_string())
    }

    pub fn mark_thread_as_read(&self, thread_id: &str) -> Result<(), String> {
        let mut threads = self.threads.lock().unwrap();
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
