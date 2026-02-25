//! Message & Thread repository
//!
//! All SQL operations for messages and conversation threads.

use crate::db::DbPool;
use crate::messaging::service::{Message, MessageStatus, MessageType, Thread};
use anyhow::Result;
use sqlx::Row;
use uuid::Uuid;

// ── Helpers ───────────────────────────────────────────────────────────────────

fn status_to_str(s: &MessageStatus) -> &'static str {
    match s {
        MessageStatus::Queued => "queued",
        MessageStatus::Sent => "sent",
        MessageStatus::Delivered => "delivered",
        MessageStatus::Read => "read",
    }
}

fn str_to_status(s: &str) -> MessageStatus {
    match s {
        "queued" => MessageStatus::Queued,
        "delivered" => MessageStatus::Delivered,
        "read" => MessageStatus::Read,
        _ => MessageStatus::Sent,
    }
}

// ── Message CRUD ──────────────────────────────────────────────────────────────

/// Insert a new message.  Uses `INSERT OR IGNORE` so replayed messages are
/// silently dropped (idempotent).
pub async fn insert_message(
    pool: &DbPool,
    message: &Message,
    conversation_key: &str,
) -> Result<()> {
    let (msg_type_str, content, reply_to): (&str, &str, Option<&str>) =
        match &message.message_type {
            MessageType::Text { content } => ("text", content.as_str(), None),
            MessageType::Emoji { emoji } => ("emoji", emoji.as_str(), None),
            MessageType::Reply { content, reply_to } => {
                ("reply", content.as_str(), Some(reply_to.as_str()))
            }
        };

    sqlx::query(
        "INSERT OR IGNORE INTO messages
             (id, conversation_key, from_device_id, to_device_id,
              msg_type, content, reply_to, status, timestamp, thread_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&message.id)
    .bind(conversation_key)
    .bind(&message.from_device_id)
    .bind(&message.to_device_id)
    .bind(msg_type_str)
    .bind(content)
    .bind(reply_to)
    .bind(status_to_str(&message.status))
    .bind(message.timestamp)
    .bind(&message.thread_id)
    .bind(message.timestamp)
    .execute(pool)
    .await?;

    Ok(())
}

/// Fetch all messages for a conversation, ordered oldest-first.
pub async fn get_messages(pool: &DbPool, conversation_key: &str) -> Result<Vec<Message>> {
    let rows = sqlx::query(
        "SELECT id, from_device_id, to_device_id, msg_type, content,
                reply_to, status, timestamp, thread_id
         FROM   messages
         WHERE  conversation_key = ?
         ORDER  BY timestamp ASC",
    )
    .bind(conversation_key)
    .fetch_all(pool)
    .await?;

    let messages = rows
        .iter()
        .map(|row| {
            let msg_type: String = row.get("msg_type");
            let content: String = row.get("content");
            let reply_to: Option<String> = row.get("reply_to");

            let message_type = match msg_type.as_str() {
                "emoji" => MessageType::Emoji { emoji: content },
                "reply" => MessageType::Reply {
                    content,
                    reply_to: reply_to.unwrap_or_default(),
                },
                _ => MessageType::Text { content },
            };

            let status_str: String = row.get("status");

            Message {
                id: row.get("id"),
                from_device_id: row.get("from_device_id"),
                to_device_id: row.get("to_device_id"),
                message_type,
                timestamp: row.get("timestamp"),
                thread_id: row.get("thread_id"),
                status: str_to_status(&status_str),
            }
        })
        .collect();

    Ok(messages)
}

/// Update the delivery/read status of a single message.
pub async fn update_message_status(
    pool: &DbPool,
    message_id: &str,
    status: &MessageStatus,
) -> Result<()> {
    sqlx::query("UPDATE messages SET status = ? WHERE id = ?")
        .bind(status_to_str(status))
        .bind(message_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Mark every message in `conversation_key` that was sent by someone *other
/// than* `reader_device_id` as `read`.  Returns the number of rows updated.
pub async fn mark_conversation_messages_read(
    pool: &DbPool,
    conversation_key: &str,
    reader_device_id: &str,
) -> Result<u32> {
    let result = sqlx::query(
        "UPDATE messages
         SET    status = 'read'
         WHERE  conversation_key = ?
           AND  from_device_id  != ?
           AND  status          != 'read'",
    )
    .bind(conversation_key)
    .bind(reader_device_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() as u32)
}

/// Mark all messages *sent by* `sender_device_id` in `conversation_key` as
/// `read` — used when we receive a read-receipt from the peer.
pub async fn mark_outgoing_as_read(
    pool: &DbPool,
    conversation_key: &str,
    sender_device_id: &str,
) -> Result<()> {
    sqlx::query(
        "UPDATE messages
         SET    status = 'read'
         WHERE  conversation_key = ?
           AND  from_device_id  = ?
           AND  status         != 'read'",
    )
    .bind(conversation_key)
    .bind(sender_device_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Delete all messages and threads (used by "Reset App").
pub async fn clear_messages(pool: &DbPool) -> Result<()> {
    sqlx::query("DELETE FROM messages").execute(pool).await?;
    sqlx::query("DELETE FROM threads").execute(pool).await?;
    Ok(())
}

// ── Thread CRUD ───────────────────────────────────────────────────────────────

/// Upsert a thread record.  On conflict (same conversation_key) only the
/// `last_message_timestamp` is updated; `unread_count` is left unchanged.
pub async fn upsert_thread(
    pool: &DbPool,
    conversation_key: &str,
    participant_1: &str,
    participant_2: &str,
    last_message_timestamp: i64,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO threads
             (conversation_key, id, participant_1, participant_2,
              last_message_timestamp, unread_count)
         VALUES (?, ?, ?, ?, ?, 0)
         ON CONFLICT(conversation_key) DO UPDATE
             SET last_message_timestamp = excluded.last_message_timestamp",
    )
    .bind(conversation_key)
    .bind(Uuid::new_v4().to_string())
    .bind(participant_1)
    .bind(participant_2)
    .bind(last_message_timestamp)
    .execute(pool)
    .await?;
    Ok(())
}

/// Increment the unread counter for a thread by 1.
pub async fn increment_thread_unread(pool: &DbPool, conversation_key: &str) -> Result<()> {
    sqlx::query(
        "UPDATE threads SET unread_count = unread_count + 1
         WHERE  conversation_key = ?",
    )
    .bind(conversation_key)
    .execute(pool)
    .await?;
    Ok(())
}

/// Reset the unread counter to 0 (conversation opened).
pub async fn reset_thread_unread(pool: &DbPool, conversation_key: &str) -> Result<()> {
    sqlx::query("UPDATE threads SET unread_count = 0 WHERE conversation_key = ?")
        .bind(conversation_key)
        .execute(pool)
        .await?;
    Ok(())
}

// ── Offline Queue Queries ─────────────────────────────────────────────────────

/// Fetch all queued messages destined for a specific peer device, oldest first.
pub async fn get_queued_messages_for_device(
    pool: &DbPool,
    peer_device_id: &str,
) -> Result<Vec<Message>> {
    let rows = sqlx::query(
        "SELECT id, from_device_id, to_device_id, msg_type, content,
                reply_to, status, timestamp, thread_id
         FROM   messages
         WHERE  to_device_id = ?
           AND  status       = 'queued'
         ORDER  BY timestamp ASC",
    )
    .bind(peer_device_id)
    .fetch_all(pool)
    .await?;

    let messages = rows
        .iter()
        .map(|row| {
            let msg_type: String = row.get("msg_type");
            let content: String = row.get("content");
            let reply_to: Option<String> = row.get("reply_to");

            let message_type = match msg_type.as_str() {
                "emoji" => MessageType::Emoji { emoji: content },
                "reply" => MessageType::Reply {
                    content,
                    reply_to: reply_to.unwrap_or_default(),
                },
                _ => MessageType::Text { content },
            };

            let status_str: String = row.get("status");

            Message {
                id: row.get("id"),
                from_device_id: row.get("from_device_id"),
                to_device_id: row.get("to_device_id"),
                message_type,
                timestamp: row.get("timestamp"),
                thread_id: row.get("thread_id"),
                status: str_to_status(&status_str),
            }
        })
        .collect();

    Ok(messages)
}

/// Return the number of queued messages for a specific peer device.
pub async fn get_queued_count_for_device(pool: &DbPool, peer_device_id: &str) -> Result<u32> {
    let row = sqlx::query(
        "SELECT COUNT(*) as cnt FROM messages
         WHERE to_device_id = ? AND status = 'queued'",
    )
    .bind(peer_device_id)
    .fetch_one(pool)
    .await?;

    let count: i64 = row.get("cnt");
    Ok(count as u32)
}

/// Return the total number of queued messages across all peers.
pub async fn get_total_queued_count(pool: &DbPool) -> Result<u32> {
    let row = sqlx::query("SELECT COUNT(*) as cnt FROM messages WHERE status = 'queued'")
        .fetch_one(pool)
        .await?;

    let count: i64 = row.get("cnt");
    Ok(count as u32)
}

/// Return all threads sorted by most-recent message first.
pub async fn get_threads(pool: &DbPool) -> Result<Vec<Thread>> {
    let rows = sqlx::query(
        "SELECT id, participant_1, participant_2,
                last_message_timestamp, unread_count
         FROM   threads
         ORDER  BY last_message_timestamp DESC",
    )
    .fetch_all(pool)
    .await?;

    let threads = rows
        .iter()
        .map(|row| {
            let unread_count: i64 = row.get("unread_count");
            Thread {
                id: row.get("id"),
                participants: vec![row.get("participant_1"), row.get("participant_2")],
                last_message_timestamp: row.get("last_message_timestamp"),
                unread_count: unread_count as u32,
            }
        })
        .collect();

    Ok(threads)
}
