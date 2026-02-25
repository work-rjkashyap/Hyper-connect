//! Group Chat repository
//!
//! All SQL operations for groups, group members, and group messages.

use crate::db::DbPool;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::Row;

// ── Data Structures ───────────────────────────────────────────────────────────

/// Role of a device within a group.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum GroupRole {
    Host,
    Member,
}

/// A group chat.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupChat {
    pub id: String,
    pub name: String,
    pub creator_device_id: String,
    pub host_device_id: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// A member of a group.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupMember {
    pub group_id: String,
    pub device_id: String,
    pub role: GroupRole,
    pub joined_at: i64,
}

/// A message in a group chat.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupMessage {
    pub id: String,
    pub group_id: String,
    pub from_device_id: String,
    pub msg_type: String,
    pub content: String,
    pub reply_to: Option<String>,
    pub timestamp: i64,
}

/// Summary of a group returned to the frontend (group + member list +
/// last message preview).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupSummary {
    pub group: GroupChat,
    pub members: Vec<GroupMember>,
    pub last_message: Option<GroupMessage>,
    pub unread_count: u32,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn role_to_str(r: &GroupRole) -> &'static str {
    match r {
        GroupRole::Host => "host",
        GroupRole::Member => "member",
    }
}

fn str_to_role(s: &str) -> GroupRole {
    match s {
        "host" => GroupRole::Host,
        _ => GroupRole::Member,
    }
}

// ── Group CRUD ────────────────────────────────────────────────────────────────

/// Create a new group.
pub async fn create_group(pool: &DbPool, group: &GroupChat) -> Result<()> {
    sqlx::query(
        "INSERT OR IGNORE INTO groups
             (id, name, creator_device_id, host_device_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&group.id)
    .bind(&group.name)
    .bind(&group.creator_device_id)
    .bind(&group.host_device_id)
    .bind(group.created_at)
    .bind(group.updated_at)
    .execute(pool)
    .await?;

    Ok(())
}

/// Fetch a group by ID.
pub async fn get_group(pool: &DbPool, group_id: &str) -> Result<Option<GroupChat>> {
    let row = sqlx::query(
        "SELECT id, name, creator_device_id, host_device_id, created_at, updated_at
         FROM   groups
         WHERE  id = ?",
    )
    .bind(group_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| GroupChat {
        id: r.get("id"),
        name: r.get("name"),
        creator_device_id: r.get("creator_device_id"),
        host_device_id: r.get("host_device_id"),
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }))
}

/// Return all groups that the given device is a member of, ordered by most
/// recently updated first.
pub async fn get_groups_for_device(pool: &DbPool, device_id: &str) -> Result<Vec<GroupChat>> {
    let rows = sqlx::query(
        "SELECT g.id, g.name, g.creator_device_id, g.host_device_id,
                g.created_at, g.updated_at
         FROM   groups g
         JOIN   group_members gm ON gm.group_id = g.id
         WHERE  gm.device_id = ?
         ORDER  BY g.updated_at DESC",
    )
    .bind(device_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .iter()
        .map(|r| GroupChat {
            id: r.get("id"),
            name: r.get("name"),
            creator_device_id: r.get("creator_device_id"),
            host_device_id: r.get("host_device_id"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        })
        .collect())
}

/// Update the group name.
pub async fn update_group_name(pool: &DbPool, group_id: &str, name: &str) -> Result<()> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query("UPDATE groups SET name = ?, updated_at = ? WHERE id = ?")
        .bind(name)
        .bind(now)
        .bind(group_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Update the host device for a group (used during host election).
pub async fn update_group_host(
    pool: &DbPool,
    group_id: &str,
    new_host_device_id: &str,
) -> Result<()> {
    let now = chrono::Utc::now().timestamp();

    // Demote old host to member
    sqlx::query(
        "UPDATE group_members SET role = 'member'
         WHERE group_id = ? AND role = 'host'",
    )
    .bind(group_id)
    .execute(pool)
    .await?;

    // Promote new host
    sqlx::query(
        "UPDATE group_members SET role = 'host'
         WHERE group_id = ? AND device_id = ?",
    )
    .bind(group_id)
    .bind(new_host_device_id)
    .execute(pool)
    .await?;

    // Update the groups table
    sqlx::query("UPDATE groups SET host_device_id = ?, updated_at = ? WHERE id = ?")
        .bind(new_host_device_id)
        .bind(now)
        .bind(group_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Delete a group and all its members/messages (cascaded by FK).
pub async fn delete_group(pool: &DbPool, group_id: &str) -> Result<()> {
    // Delete members and messages first (SQLite FK cascade may not be enabled)
    sqlx::query("DELETE FROM group_messages WHERE group_id = ?")
        .bind(group_id)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM group_members WHERE group_id = ?")
        .bind(group_id)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM groups WHERE id = ?")
        .bind(group_id)
        .execute(pool)
        .await?;
    Ok(())
}

// ── Member CRUD ───────────────────────────────────────────────────────────────

/// Add a member to a group.
pub async fn add_member(pool: &DbPool, member: &GroupMember) -> Result<()> {
    sqlx::query(
        "INSERT OR IGNORE INTO group_members (group_id, device_id, role, joined_at)
         VALUES (?, ?, ?, ?)",
    )
    .bind(&member.group_id)
    .bind(&member.device_id)
    .bind(role_to_str(&member.role))
    .bind(member.joined_at)
    .execute(pool)
    .await?;

    // Touch the group's updated_at
    let now = chrono::Utc::now().timestamp();
    sqlx::query("UPDATE groups SET updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(&member.group_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Remove a member from a group.
pub async fn remove_member(pool: &DbPool, group_id: &str, device_id: &str) -> Result<()> {
    sqlx::query("DELETE FROM group_members WHERE group_id = ? AND device_id = ?")
        .bind(group_id)
        .bind(device_id)
        .execute(pool)
        .await?;

    let now = chrono::Utc::now().timestamp();
    sqlx::query("UPDATE groups SET updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(group_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Get all members of a group.
pub async fn get_members(pool: &DbPool, group_id: &str) -> Result<Vec<GroupMember>> {
    let rows = sqlx::query(
        "SELECT group_id, device_id, role, joined_at
         FROM   group_members
         WHERE  group_id = ?
         ORDER  BY joined_at ASC",
    )
    .bind(group_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .iter()
        .map(|r| {
            let role_str: String = r.get("role");
            GroupMember {
                group_id: r.get("group_id"),
                device_id: r.get("device_id"),
                role: str_to_role(&role_str),
                joined_at: r.get("joined_at"),
            }
        })
        .collect())
}

/// Check if a device is a member of a group.
pub async fn is_member(pool: &DbPool, group_id: &str, device_id: &str) -> Result<bool> {
    let row = sqlx::query(
        "SELECT COUNT(*) as cnt FROM group_members
         WHERE group_id = ? AND device_id = ?",
    )
    .bind(group_id)
    .bind(device_id)
    .fetch_one(pool)
    .await?;

    let count: i64 = row.get("cnt");
    Ok(count > 0)
}

/// Return the number of members in a group.
pub async fn member_count(pool: &DbPool, group_id: &str) -> Result<u32> {
    let row = sqlx::query(
        "SELECT COUNT(*) as cnt FROM group_members
         WHERE group_id = ?",
    )
    .bind(group_id)
    .fetch_one(pool)
    .await?;

    let count: i64 = row.get("cnt");
    Ok(count as u32)
}

// ── Group Message CRUD ────────────────────────────────────────────────────────

/// Insert a group message.  Uses `INSERT OR IGNORE` so replayed messages
/// are silently dropped (idempotent).
pub async fn insert_group_message(pool: &DbPool, message: &GroupMessage) -> Result<()> {
    sqlx::query(
        "INSERT OR IGNORE INTO group_messages
             (id, group_id, from_device_id, msg_type, content, reply_to, timestamp, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&message.id)
    .bind(&message.group_id)
    .bind(&message.from_device_id)
    .bind(&message.msg_type)
    .bind(&message.content)
    .bind(&message.reply_to)
    .bind(message.timestamp)
    .bind(message.timestamp)
    .execute(pool)
    .await?;

    // Touch the group's updated_at
    sqlx::query("UPDATE groups SET updated_at = ? WHERE id = ?")
        .bind(message.timestamp)
        .bind(&message.group_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Fetch all messages for a group, ordered oldest-first.
pub async fn get_group_messages(pool: &DbPool, group_id: &str) -> Result<Vec<GroupMessage>> {
    let rows = sqlx::query(
        "SELECT id, group_id, from_device_id, msg_type, content, reply_to, timestamp
         FROM   group_messages
         WHERE  group_id = ?
         ORDER  BY timestamp ASC",
    )
    .bind(group_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .iter()
        .map(|r| GroupMessage {
            id: r.get("id"),
            group_id: r.get("group_id"),
            from_device_id: r.get("from_device_id"),
            msg_type: r.get("msg_type"),
            content: r.get("content"),
            reply_to: r.get("reply_to"),
            timestamp: r.get("timestamp"),
        })
        .collect())
}

/// Fetch the most recent message for a group (for summaries / sidebar).
pub async fn get_last_group_message(
    pool: &DbPool,
    group_id: &str,
) -> Result<Option<GroupMessage>> {
    let row = sqlx::query(
        "SELECT id, group_id, from_device_id, msg_type, content, reply_to, timestamp
         FROM   group_messages
         WHERE  group_id = ?
         ORDER  BY timestamp DESC
         LIMIT  1",
    )
    .bind(group_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| GroupMessage {
        id: r.get("id"),
        group_id: r.get("group_id"),
        from_device_id: r.get("from_device_id"),
        msg_type: r.get("msg_type"),
        content: r.get("content"),
        reply_to: r.get("reply_to"),
        timestamp: r.get("timestamp"),
    }))
}

/// Return message count for a group.
pub async fn get_group_message_count(pool: &DbPool, group_id: &str) -> Result<u32> {
    let row = sqlx::query(
        "SELECT COUNT(*) as cnt FROM group_messages
         WHERE group_id = ?",
    )
    .bind(group_id)
    .fetch_one(pool)
    .await?;

    let count: i64 = row.get("cnt");
    Ok(count as u32)
}

/// Delete all messages in a group.
pub async fn clear_group_messages(pool: &DbPool, group_id: &str) -> Result<()> {
    sqlx::query("DELETE FROM group_messages WHERE group_id = ?")
        .bind(group_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Delete all groups, members, and group messages (used by "Reset App").
pub async fn clear_all_groups(pool: &DbPool) -> Result<()> {
    sqlx::query("DELETE FROM group_messages")
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM group_members")
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM groups").execute(pool).await?;
    Ok(())
}

// ── Group Summaries ───────────────────────────────────────────────────────────

/// Build full summaries (group + members + last message) for all groups a
/// device belongs to.  Returns them ordered by most-recently-updated first.
pub async fn get_group_summaries(pool: &DbPool, device_id: &str) -> Result<Vec<GroupSummary>> {
    let groups = get_groups_for_device(pool, device_id).await?;

    let mut summaries = Vec::with_capacity(groups.len());

    for group in groups {
        let members = get_members(pool, &group.id).await?;
        let last_message = get_last_group_message(pool, &group.id).await?;
        let msg_count = get_group_message_count(pool, &group.id).await?;

        summaries.push(GroupSummary {
            group,
            members,
            last_message,
            // For now, unread_count is just the total count — a proper
            // implementation would track per-device read cursors, but that's
            // a follow-up enhancement.
            unread_count: msg_count,
        });
    }

    Ok(summaries)
}
