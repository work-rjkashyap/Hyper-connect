//! Messaging Service
//!
//! Handles text message sending, receiving, and storage.
//! All message history is persisted to SQLite via the `db` module so that
//! conversation history survives application restarts.

#![allow(dead_code)]

use crate::db::{self, DbPool};
use crate::network::{
    serialize_json, Frame, MessageAckPayload, MessageType as FrameType, TcpClient,
    TextMessagePayload,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

/// Delivery status of a message – mirrors the frontend `MessageStatus` type.
/// Serialised in lowercase to match TypeScript conventions.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MessageStatus {
    /// Message is waiting to be sent — the peer was offline when the user
    /// hit "send".  Will be retried automatically when the peer reappears.
    Queued,
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
    /// Delivery / read status
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
    /// SQLite connection pool — all messages and threads are persisted here.
    db: Arc<DbPool>,
    tcp_client: Option<Arc<TcpClient>>,
    tcp_port: u16,
}

impl MessagingService {
    pub fn new(db: Arc<DbPool>) -> Self {
        Self {
            db,
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
    // Port helper
    // -------------------------------------------------------------------------

    fn resolve_peer_port(&self, peer_port: Option<u16>) -> u16 {
        peer_port.unwrap_or(self.tcp_port)
    }

    // -------------------------------------------------------------------------
    // Connection management
    // -------------------------------------------------------------------------

    pub async fn ensure_connected(
        &self,
        device_id: &str,
        peer_address: &str,
        peer_port: Option<u16>,
        app_handle: AppHandle,
    ) -> Result<u64, String> {
        let client = self
            .tcp_client
            .as_ref()
            .ok_or_else(|| "TCP client not initialised".to_string())?;

        let port = self.resolve_peer_port(peer_port);
        let result = client.ensure_connected(device_id, peer_address, port).await;

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
        peer_port: Option<u16>,
        app_handle: AppHandle,
    ) -> Result<Message, String> {
        let message = Message {
            id: Uuid::new_v4().to_string(),
            from_device_id: from_device_id.clone(),
            to_device_id: to_device_id.clone(),
            message_type: message_type.clone(),
            timestamp: chrono::Utc::now().timestamp(),
            thread_id: None,
            status: MessageStatus::Sent,
        };

        let conversation_key = Self::get_conversation_key(&from_device_id, &to_device_id);

        // Persist to SQLite
        if let Err(e) = db::messages::insert_message(&self.db, &message, &conversation_key).await {
            eprintln!("⚠️  DB insert_message failed: {}", e);
        }
        if let Err(e) = db::messages::upsert_thread(
            &self.db,
            &conversation_key,
            &from_device_id,
            &to_device_id,
            message.timestamp,
        )
        .await
        {
            eprintln!("⚠️  DB upsert_thread failed: {}", e);
        }

        // Transmit over the network — on failure, queue for later retry
        if let Some(client) = &self.tcp_client {
            let content_str = match &message_type {
                MessageType::Text { content } => content.clone(),
                MessageType::Emoji { emoji } => emoji.clone(),
                MessageType::Reply { content, .. } => content.clone(),
            };

            let payload = TextMessagePayload {
                msg_type: "TEXT_MESSAGE".to_string(),
                id: message.id.clone(),
                from_device_id: from_device_id.clone(),
                to_device_id: to_device_id.clone(),
                content: content_str,
                timestamp: message.timestamp,
                thread_id: None,
            };

            let port = self.resolve_peer_port(peer_port);
            let payload_bytes = serialize_json(&payload)?;

            match client
                .send_text_message(&to_device_id, &peer_address, port, payload_bytes)
                .await
            {
                Ok(()) => {
                    // Sent successfully
                    let _ = app_handle.emit("message-sent", &message);
                }
                Err(e) => {
                    // Network send failed — queue for retry instead of erroring
                    println!(
                        "⏳ Queuing message {} for {} (send failed: {})",
                        message.id, to_device_id, e
                    );
                    let mut queued_message = message.clone();
                    queued_message.status = MessageStatus::Queued;

                    // Update the DB row to queued status
                    if let Err(db_err) = db::messages::update_message_status(
                        &self.db,
                        &queued_message.id,
                        &MessageStatus::Queued,
                    )
                    .await
                    {
                        eprintln!("⚠️  DB update to queued failed: {}", db_err);
                    }

                    let _ = app_handle.emit("message-queued", &queued_message);
                    return Ok(queued_message);
                }
            }
        }

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
        let message = Self::build_received_message(payload);
        let conversation_key =
            Self::get_conversation_key(&message.from_device_id, &message.to_device_id);
        self.persist_message(&message, &conversation_key, true).await;
        let _ = app_handle.emit("message-received", &message);
        Ok(())
    }

    pub async fn store_received_message(&self, payload: &TextMessagePayload) {
        let message = Self::build_received_message(payload.clone());
        let conversation_key =
            Self::get_conversation_key(&message.from_device_id, &message.to_device_id);
        self.persist_message(&message, &conversation_key, true).await;
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    fn build_received_message(payload: TextMessagePayload) -> Message {
        Message {
            id: payload.id,
            from_device_id: payload.from_device_id,
            to_device_id: payload.to_device_id,
            message_type: MessageType::Text {
                content: payload.content,
            },
            timestamp: payload.timestamp,
            thread_id: payload.thread_id,
            status: MessageStatus::Delivered,
        }
    }

    /// Write a message to SQLite and update thread metadata.
    ///
    /// `increment_unread` should be `true` for incoming messages and `false`
    /// for our own outgoing messages.
    async fn persist_message(&self, message: &Message, conversation_key: &str, increment_unread: bool) {
        if let Err(e) = db::messages::insert_message(&self.db, message, conversation_key).await {
            eprintln!("⚠️  DB insert_message failed: {}", e);
        }

        if let Err(e) = db::messages::upsert_thread(
            &self.db,
            conversation_key,
            &message.from_device_id,
            &message.to_device_id,
            message.timestamp,
        )
        .await
        {
            eprintln!("⚠️  DB upsert_thread failed: {}", e);
        }

        if increment_unread {
            if let Err(e) =
                db::messages::increment_thread_unread(&self.db, conversation_key).await
            {
                eprintln!("⚠️  DB increment_thread_unread failed: {}", e);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    pub async fn get_messages(&self, device1: &str, device2: &str) -> Vec<Message> {
        let key = Self::get_conversation_key(device1, device2);
        match db::messages::get_messages(&self.db, &key).await {
            Ok(msgs) => msgs,
            Err(e) => {
                eprintln!("⚠️  DB get_messages failed: {}", e);
                vec![]
            }
        }
    }

    pub async fn get_threads(&self) -> Vec<Thread> {
        match db::messages::get_threads(&self.db).await {
            Ok(threads) => threads,
            Err(e) => {
                eprintln!("⚠️  DB get_threads failed: {}", e);
                vec![]
            }
        }
    }

    // -------------------------------------------------------------------------
    // Mark as read / delivered
    // -------------------------------------------------------------------------

    pub async fn mark_as_read(
        &self,
        message_id: &str,
        _conversation_key: &str,
    ) -> Result<(), String> {
        db::messages::update_message_status(&self.db, message_id, &MessageStatus::Read)
            .await
            .map_err(|e| format!("DB mark_as_read failed: {}", e))
    }

    pub async fn mark_conversation_as_read(
        &self,
        conversation_key: &str,
        reader_device_id: &str,
    ) -> Result<u32, String> {
        let marked =
            db::messages::mark_conversation_messages_read(&self.db, conversation_key, reader_device_id)
                .await
                .map_err(|e| format!("DB mark_conversation_as_read failed: {}", e))?;

        if let Err(e) = db::messages::reset_thread_unread(&self.db, conversation_key).await {
            eprintln!("⚠️  DB reset_thread_unread failed: {}", e);
        }

        Ok(marked)
    }

    // -------------------------------------------------------------------------
    // Delivery ACK / Read receipt helpers
    // -------------------------------------------------------------------------

    pub async fn update_message_status(
        &self,
        _conversation_key: &str,
        message_id: &str,
        new_status: MessageStatus,
    ) -> Result<(), String> {
        db::messages::update_message_status(&self.db, message_id, &new_status)
            .await
            .map_err(|e| format!("DB update_message_status failed: {}", e))
    }

    pub async fn mark_outgoing_as_read(&self, conversation_key: &str, sender_device_id: &str) {
        if let Err(e) =
            db::messages::mark_outgoing_as_read(&self.db, conversation_key, sender_device_id).await
        {
            eprintln!("⚠️  DB mark_outgoing_as_read failed: {}", e);
        }
    }

    pub async fn send_delivery_ack(
        &self,
        message_id: &str,
        conversation_key: &str,
        from_device_id: &str,
        to_device_id: &str,
        peer_address: &str,
        peer_port: u16,
    ) -> Result<(), String> {
        let client = match self.tcp_client.as_ref() {
            Some(c) => c,
            None => return Ok(()),
        };

        let ack = MessageAckPayload {
            msg_type: "MESSAGE_DELIVERED".to_string(),
            conversation_key: conversation_key.to_string(),
            message_id: Some(message_id.to_string()),
            from_device_id: from_device_id.to_string(),
            to_device_id: to_device_id.to_string(),
        };

        let payload =
            serialize_json(&ack).map_err(|e| format!("Failed to serialize ACK: {}", e))?;
        let frame = Frame::new(FrameType::MessageDelivered, payload);

        if let Err(e) = client
            .send_frame(to_device_id, peer_address, peer_port, frame)
            .await
        {
            eprintln!("⚠️  Delivery ACK failed (non-fatal): {}", e);
        }
        Ok(())
    }

    pub async fn send_read_receipt(
        &self,
        conversation_key: &str,
        from_device_id: &str,
        to_device_id: &str,
        peer_address: &str,
        peer_port: u16,
    ) -> Result<(), String> {
        let client = match self.tcp_client.as_ref() {
            Some(c) => c,
            None => return Ok(()),
        };

        let ack = MessageAckPayload {
            msg_type: "MESSAGE_READ".to_string(),
            conversation_key: conversation_key.to_string(),
            message_id: None,
            from_device_id: from_device_id.to_string(),
            to_device_id: to_device_id.to_string(),
        };

        let payload =
            serialize_json(&ack).map_err(|e| format!("Failed to serialize read receipt: {}", e))?;
        let frame = Frame::new(FrameType::MessageRead, payload);

        if let Err(e) = client
            .send_frame(to_device_id, peer_address, peer_port, frame)
            .await
        {
            eprintln!("⚠️  Read receipt failed (non-fatal): {}", e);
        }
        Ok(())
    }

    /// Reset a thread's unread counter.
    /// `thread_id` here is treated as a `conversation_key` (historical naming).
    pub async fn mark_thread_as_read(&self, conversation_key: &str) -> Result<(), String> {
        db::messages::reset_thread_unread(&self.db, conversation_key)
            .await
            .map_err(|e| format!("DB mark_thread_as_read failed: {}", e))
    }

    /// Clear all messages and threads from SQLite and close TCP connections.
    pub async fn clear_all(&self) {
        if let Err(e) = db::messages::clear_messages(&self.db).await {
            eprintln!("⚠️  DB clear_messages failed: {}", e);
        }

        if let Some(ref client) = self.tcp_client {
            client.close_all().await;
        }

        println!("✓ Cleared all messages, threads, and TCP connections");
    }

    // -------------------------------------------------------------------------
    // Offline Queue & Retry
    // -------------------------------------------------------------------------

    /// Flush all queued messages destined for `peer_device_id`.
    ///
    /// Looks up the peer address from the provided list of discovered devices
    /// and retransmits each queued message over TCP.  On success the message
    /// status is flipped to `Sent`; on failure it stays `Queued` for the next
    /// retry opportunity.
    ///
    /// Returns the number of messages successfully flushed.
    pub async fn flush_queue_for_device(
        &self,
        peer_device_id: &str,
        peer_address: &str,
        peer_port: u16,
        app_handle: AppHandle,
    ) -> u32 {
        let queued = match db::messages::get_queued_messages_for_device(&self.db, peer_device_id)
            .await
        {
            Ok(msgs) => msgs,
            Err(e) => {
                eprintln!("⚠️  Failed to load queued messages: {}", e);
                return 0;
            }
        };

        if queued.is_empty() {
            return 0;
        }

        println!(
            "🔄 Flushing {} queued message(s) for {}",
            queued.len(),
            peer_device_id
        );

        let client = match self.tcp_client.as_ref() {
            Some(c) => c,
            None => return 0,
        };

        let mut flushed: u32 = 0;

        for msg in &queued {
            let content_str = match &msg.message_type {
                MessageType::Text { content } => content.clone(),
                MessageType::Emoji { emoji } => emoji.clone(),
                MessageType::Reply { content, .. } => content.clone(),
            };

            let payload = TextMessagePayload {
                msg_type: "TEXT_MESSAGE".to_string(),
                id: msg.id.clone(),
                from_device_id: msg.from_device_id.clone(),
                to_device_id: msg.to_device_id.clone(),
                content: content_str,
                timestamp: msg.timestamp,
                thread_id: msg.thread_id.clone(),
            };

            let payload_bytes = match serialize_json(&payload) {
                Ok(b) => b,
                Err(e) => {
                    eprintln!("⚠️  Failed to serialize queued message: {}", e);
                    continue;
                }
            };

            match client
                .send_text_message(peer_device_id, peer_address, peer_port, payload_bytes)
                .await
            {
                Ok(()) => {
                    // Update status to Sent
                    if let Err(e) = db::messages::update_message_status(
                        &self.db,
                        &msg.id,
                        &MessageStatus::Sent,
                    )
                    .await
                    {
                        eprintln!("⚠️  DB update queued→sent failed: {}", e);
                    }

                    let mut sent_msg = msg.clone();
                    sent_msg.status = MessageStatus::Sent;
                    let _ = app_handle.emit("message-queue-flushed", &sent_msg);

                    flushed += 1;
                }
                Err(e) => {
                    // Still can't reach peer — leave as queued
                    eprintln!(
                        "⚠️  Retry failed for message {} to {}: {}",
                        msg.id, peer_device_id, e
                    );
                    // Stop trying more messages to this device this round
                    break;
                }
            }
        }

        if flushed > 0 {
            println!(
                "✓ Flushed {}/{} queued messages for {}",
                flushed,
                queued.len(),
                peer_device_id
            );
        }

        flushed
    }

    /// Return the count of queued (unsent) messages for a specific peer.
    pub async fn queued_count_for_device(&self, peer_device_id: &str) -> u32 {
        db::messages::get_queued_count_for_device(&self.db, peer_device_id)
            .await
            .unwrap_or(0)
    }

    /// Return the total count of all queued messages across all peers.
    pub async fn total_queued_count(&self) -> u32 {
        db::messages::get_total_queued_count(&self.db)
            .await
            .unwrap_or(0)
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    pub fn get_conversation_key(device1: &str, device2: &str) -> String {
        let mut participants = vec![device1, device2];
        participants.sort();
        participants.join("_")
    }
}

impl Clone for MessagingService {
    fn clone(&self) -> Self {
        Self {
            db: Arc::clone(&self.db),
            tcp_client: self.tcp_client.clone(),
            tcp_port: self.tcp_port,
        }
    }
}
