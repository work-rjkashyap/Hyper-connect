//! Group Chat Service
//!
//! Implements the **Temporary Host** model for group messaging:
//!
//! - The group creator becomes the initial host.
//! - All members send messages to the host via existing TCP connections.
//! - The host fans out each message to every other member.
//! - If the host leaves or goes offline, the member with the lexicographically
//!   smallest `device_id` is elected as the new host.
//! - Group metadata (members, host) is synchronised via `GROUP_CONTROL`
//!   messages sent through the encrypted channel.

use crate::db::{groups as db_groups, DbPool};
use crate::network::TcpClient;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

// Re-export DB types so the rest of the crate can use them via
// `messaging::group::*` without importing `db::groups` directly.
pub use db_groups::{GroupChat, GroupMember, GroupMessage, GroupRole, GroupSummary};

// ── Wire payloads ─────────────────────────────────────────────────────────────

/// Payload for a group text message sent over the encrypted channel.
///
/// The `type` field is always `"GROUP_MESSAGE"` so the TCP server can route it
/// correctly inside `handle_encrypted_message`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupMessagePayload {
    /// Discriminant — always `"GROUP_MESSAGE"`.
    #[serde(rename = "type")]
    pub msg_type: String,
    /// Unique message ID (UUID v4).
    pub id: String,
    /// The group this message belongs to.
    pub group_id: String,
    /// Device that authored the message.
    pub from_device_id: String,
    /// Message content type: `"text"`, `"emoji"`, or `"reply"`.
    pub msg_content_type: String,
    /// The actual text / emoji content.
    pub content: String,
    /// If this is a reply, the ID of the message being replied to.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply_to: Option<String>,
    /// Unix timestamp (seconds).
    pub timestamp: i64,
}

/// Actions that can be communicated via a `GROUP_CONTROL` payload.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GroupControlAction {
    /// A new group was created — recipients should store it locally.
    Create,
    /// A new member was invited / added.
    MemberAdded,
    /// A member left (voluntarily) or was removed.
    MemberRemoved,
    /// The host changed (election result).
    HostChanged,
    /// The group was dissolved by the host / creator.
    Disband,
}

/// Control payload for group lifecycle events.
///
/// `type` is always `"GROUP_CONTROL"`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupControlPayload {
    /// Discriminant — always `"GROUP_CONTROL"`.
    #[serde(rename = "type")]
    pub msg_type: String,
    /// The action being performed.
    pub action: GroupControlAction,
    /// Group ID.
    pub group_id: String,
    /// Group name (relevant for `Create`).
    pub group_name: String,
    /// The device that initiated this control message.
    pub from_device_id: String,
    /// The device targeted by the action (e.g. the added / removed member).
    /// `None` for broadcast actions like `Create` or `Disband`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_device_id: Option<String>,
    /// Current host device ID (always set so recipients stay in sync).
    pub host_device_id: String,
    /// Full member list at the time of the event.  Lets the recipient
    /// reconcile their local state in one shot.
    pub members: Vec<GroupMemberInfo>,
    /// Unix timestamp (seconds).
    pub timestamp: i64,
}

/// Minimal member info included in control payloads so recipients can
/// reconstruct the member list without extra round-trips.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupMemberInfo {
    pub device_id: String,
    pub role: GroupRole,
}

// ── Service ───────────────────────────────────────────────────────────────────

pub struct GroupService {
    db: Arc<DbPool>,
    tcp_client: Option<Arc<TcpClient>>,
    tcp_port: u16,
}

impl GroupService {
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

    // ── Group lifecycle ──────────────────────────────────────────────────────

    /// Create a new group.  The local device becomes the host.
    ///
    /// Returns the created `GroupChat` and broadcasts a `GROUP_CONTROL/Create`
    /// message to every initial member.
    pub async fn create_group(
        &self,
        name: String,
        local_device_id: String,
        member_device_ids: Vec<String>,
        app_handle: AppHandle,
    ) -> Result<GroupChat, String> {
        let now = chrono::Utc::now().timestamp();
        let group_id = Uuid::new_v4().to_string();

        let group = GroupChat {
            id: group_id.clone(),
            name: name.clone(),
            creator_device_id: local_device_id.clone(),
            host_device_id: local_device_id.clone(),
            created_at: now,
            updated_at: now,
        };

        // Persist group
        db_groups::create_group(&self.db, &group)
            .await
            .map_err(|e| format!("DB create_group failed: {}", e))?;

        // Add creator as host
        let host_member = GroupMember {
            group_id: group_id.clone(),
            device_id: local_device_id.clone(),
            role: GroupRole::Host,
            joined_at: now,
        };
        db_groups::add_member(&self.db, &host_member)
            .await
            .map_err(|e| format!("DB add_member (host) failed: {}", e))?;

        // Add other members
        for device_id in &member_device_ids {
            if device_id == &local_device_id {
                continue; // already added as host
            }
            let member = GroupMember {
                group_id: group_id.clone(),
                device_id: device_id.clone(),
                role: GroupRole::Member,
                joined_at: now,
            };
            db_groups::add_member(&self.db, &member)
                .await
                .map_err(|e| format!("DB add_member failed: {}", e))?;
        }

        // Build the full member list for the control message
        let all_members = self.build_member_info_list(&group_id).await?;

        // Broadcast GROUP_CONTROL/Create to all remote members
        let control = GroupControlPayload {
            msg_type: "GROUP_CONTROL".to_string(),
            action: GroupControlAction::Create,
            group_id: group_id.clone(),
            group_name: name,
            from_device_id: local_device_id.clone(),
            target_device_id: None,
            host_device_id: local_device_id.clone(),
            members: all_members,
            timestamp: now,
        };

        self.broadcast_control(&control, &local_device_id, &app_handle)
            .await;

        // Emit local event so frontend picks it up
        let _ = app_handle.emit("group-created", &group);

        println!("✅ Group created: {} ({})", group.name, group.id);
        Ok(group)
    }

    /// Add a member to an existing group.  Only the host should call this.
    pub async fn add_member(
        &self,
        group_id: &str,
        new_device_id: &str,
        local_device_id: &str,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        let group = self.require_group(group_id).await?;
        self.require_host(&group, local_device_id)?;

        let now = chrono::Utc::now().timestamp();
        let member = GroupMember {
            group_id: group_id.to_string(),
            device_id: new_device_id.to_string(),
            role: GroupRole::Member,
            joined_at: now,
        };
        db_groups::add_member(&self.db, &member)
            .await
            .map_err(|e| format!("DB add_member failed: {}", e))?;

        let all_members = self.build_member_info_list(group_id).await?;

        let control = GroupControlPayload {
            msg_type: "GROUP_CONTROL".to_string(),
            action: GroupControlAction::MemberAdded,
            group_id: group_id.to_string(),
            group_name: group.name.clone(),
            from_device_id: local_device_id.to_string(),
            target_device_id: Some(new_device_id.to_string()),
            host_device_id: group.host_device_id.clone(),
            members: all_members,
            timestamp: now,
        };

        self.broadcast_control(&control, local_device_id, app_handle)
            .await;

        let _ = app_handle.emit("group-member-added", &member);
        println!(
            "✅ Added {} to group {} ({})",
            new_device_id, group.name, group_id
        );
        Ok(())
    }

    /// Remove a member from a group.  Only the host (or the member themselves
    /// via `leave_group`) should call this.
    pub async fn remove_member(
        &self,
        group_id: &str,
        target_device_id: &str,
        local_device_id: &str,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        let group = self.require_group(group_id).await?;

        // Either the host is removing someone, or a member is removing
        // themselves (leave).
        if local_device_id != target_device_id {
            self.require_host(&group, local_device_id)?;
        }

        db_groups::remove_member(&self.db, group_id, target_device_id)
            .await
            .map_err(|e| format!("DB remove_member failed: {}", e))?;

        // If the removed member was the host, elect a new one
        let mut new_host = group.host_device_id.clone();
        if target_device_id == group.host_device_id {
            new_host = self.elect_new_host(group_id).await?;
        }

        let all_members = self.build_member_info_list(group_id).await?;

        let control = GroupControlPayload {
            msg_type: "GROUP_CONTROL".to_string(),
            action: GroupControlAction::MemberRemoved,
            group_id: group_id.to_string(),
            group_name: group.name,
            from_device_id: local_device_id.to_string(),
            target_device_id: Some(target_device_id.to_string()),
            host_device_id: new_host,
            members: all_members,
            timestamp: chrono::Utc::now().timestamp(),
        };

        self.broadcast_control(&control, local_device_id, app_handle)
            .await;

        let _ = app_handle.emit(
            "group-member-removed",
            serde_json::json!({
                "group_id": group_id,
                "device_id": target_device_id,
            }),
        );

        println!(
            "✅ Removed {} from group {}",
            target_device_id, group_id
        );
        Ok(())
    }

    /// Leave a group (convenience wrapper around `remove_member`).
    pub async fn leave_group(
        &self,
        group_id: &str,
        local_device_id: &str,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        self.remove_member(group_id, local_device_id, local_device_id, app_handle)
            .await?;

        // Check if the group is now empty and clean up
        let remaining = db_groups::member_count(&self.db, group_id)
            .await
            .unwrap_or(0);
        if remaining == 0 {
            let _ = db_groups::delete_group(&self.db, group_id).await;
            println!("🗑️  Group {} disbanded (last member left)", group_id);
        }

        let _ = app_handle.emit(
            "group-left",
            serde_json::json!({ "group_id": group_id }),
        );

        Ok(())
    }

    /// Disband (delete) a group.  Only the creator or current host can do this.
    pub async fn disband_group(
        &self,
        group_id: &str,
        local_device_id: &str,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        let group = self.require_group(group_id).await?;

        if local_device_id != group.host_device_id
            && local_device_id != group.creator_device_id
        {
            return Err("Only the host or creator can disband a group".to_string());
        }

        let all_members = self.build_member_info_list(group_id).await?;

        let control = GroupControlPayload {
            msg_type: "GROUP_CONTROL".to_string(),
            action: GroupControlAction::Disband,
            group_id: group_id.to_string(),
            group_name: group.name.clone(),
            from_device_id: local_device_id.to_string(),
            target_device_id: None,
            host_device_id: group.host_device_id.clone(),
            members: all_members,
            timestamp: chrono::Utc::now().timestamp(),
        };

        self.broadcast_control(&control, local_device_id, app_handle)
            .await;

        db_groups::delete_group(&self.db, group_id)
            .await
            .map_err(|e| format!("DB delete_group failed: {}", e))?;

        let _ = app_handle.emit(
            "group-disbanded",
            serde_json::json!({ "group_id": group_id }),
        );

        println!("🗑️  Group {} ({}) disbanded", group.name, group_id);
        Ok(())
    }

    /// Rename a group.  Only the host can rename.
    ///
    /// Persists the new name to SQLite via `update_group_name` and broadcasts
    /// a `HostChanged` control message (which carries the updated group name)
    /// so all members reconcile.
    pub async fn rename_group(
        &self,
        group_id: &str,
        new_name: String,
        local_device_id: &str,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        let group = self.require_group(group_id).await?;
        self.require_host(&group, local_device_id)?;

        db_groups::update_group_name(&self.db, group_id, &new_name)
            .await
            .map_err(|e| format!("DB update_group_name failed: {}", e))?;

        let all_members = self.build_member_info_list(group_id).await?;

        // Broadcast a HostChanged control with the new name so every member
        // updates their local copy.
        let control = GroupControlPayload {
            msg_type: "GROUP_CONTROL".to_string(),
            action: GroupControlAction::HostChanged,
            group_id: group_id.to_string(),
            group_name: new_name.clone(),
            from_device_id: local_device_id.to_string(),
            target_device_id: None,
            host_device_id: group.host_device_id.clone(),
            members: all_members,
            timestamp: chrono::Utc::now().timestamp(),
        };

        self.broadcast_control(&control, local_device_id, app_handle)
            .await;

        let _ = app_handle.emit(
            "group-renamed",
            serde_json::json!({
                "group_id": group_id,
                "name": new_name,
            }),
        );

        println!("✅ Renamed group {} to \"{}\"", group_id, new_name);
        Ok(())
    }

    /// Clear all messages in a group (host only).
    ///
    /// Uses `clear_group_messages` to wipe the group's message history from
    /// SQLite without removing the group itself.
    pub async fn clear_group_history(
        &self,
        group_id: &str,
        local_device_id: &str,
    ) -> Result<(), String> {
        let group = self.require_group(group_id).await?;
        self.require_host(&group, local_device_id)?;

        db_groups::clear_group_messages(&self.db, group_id)
            .await
            .map_err(|e| format!("DB clear_group_messages failed: {}", e))?;

        println!("🗑️  Cleared message history for group {}", group_id);
        Ok(())
    }

    // ── Group messaging ──────────────────────────────────────────────────────

    /// Send a text message to the group.
    ///
    /// - If the local device **is** the host, it stores the message locally and
    ///   fans it out to all other members directly.
    /// - If the local device is **not** the host, it sends the message to the
    ///   host, which will fan it out (handled server-side).
    pub async fn send_group_message(
        &self,
        group_id: &str,
        local_device_id: &str,
        content: String,
        msg_content_type: String,
        reply_to: Option<String>,
        app_handle: AppHandle,
    ) -> Result<GroupMessage, String> {
        let group = self.require_group(group_id).await?;

        // Verify the sender is actually a member of this group
        let is_member = db_groups::is_member(&self.db, group_id, local_device_id)
            .await
            .map_err(|e| format!("DB is_member check failed: {}", e))?;
        if !is_member {
            return Err(format!(
                "Device {} is not a member of group {}",
                local_device_id, group_id
            ));
        }

        let now = chrono::Utc::now().timestamp();
        let msg_id = Uuid::new_v4().to_string();

        let group_msg = GroupMessage {
            id: msg_id.clone(),
            group_id: group_id.to_string(),
            from_device_id: local_device_id.to_string(),
            msg_type: msg_content_type.clone(),
            content: content.clone(),
            reply_to: reply_to.clone(),
            timestamp: now,
        };

        // Persist locally
        db_groups::insert_group_message(&self.db, &group_msg)
            .await
            .map_err(|e| format!("DB insert_group_message failed: {}", e))?;

        // Build wire payload
        let payload = GroupMessagePayload {
            msg_type: "GROUP_MESSAGE".to_string(),
            id: msg_id.clone(),
            group_id: group_id.to_string(),
            from_device_id: local_device_id.to_string(),
            msg_content_type,
            content,
            reply_to,
            timestamp: now,
        };

        let payload_json = serde_json::to_string(&payload)
            .map_err(|e| format!("Serialize GROUP_MESSAGE failed: {}", e))?;

        if group.host_device_id == local_device_id {
            // We ARE the host — fan out to every other member
            self.fan_out_message(&payload_json, local_device_id, group_id, &app_handle)
                .await;
        } else {
            // Send to the host — the host's server will fan out
            self.send_to_device(&group.host_device_id, &payload_json, &app_handle)
                .await?;
        }

        let _ = app_handle.emit("group-message-sent", &group_msg);
        Ok(group_msg)
    }

    /// Called by the TCP server when a `GROUP_MESSAGE` arrives.
    ///
    /// 1. Stores the message locally.
    /// 2. If this device is the group host, fans it out to all other members
    ///    (excluding the original sender).
    /// 3. Emits `group-message-received` to the frontend.
    pub async fn handle_incoming_group_message(
        &self,
        payload: &GroupMessagePayload,
        local_device_id: &str,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        // Verify the sender is actually a member of this group
        let sender_is_member = db_groups::is_member(&self.db, &payload.group_id, &payload.from_device_id)
            .await
            .unwrap_or(false);
        if !sender_is_member {
            eprintln!(
                "⚠️  Rejected group message from non-member {} in group {}",
                payload.from_device_id, payload.group_id
            );
            return Err(format!(
                "Device {} is not a member of group {}",
                payload.from_device_id, payload.group_id
            ));
        }

        let group_msg = GroupMessage {
            id: payload.id.clone(),
            group_id: payload.group_id.clone(),
            from_device_id: payload.from_device_id.clone(),
            msg_type: payload.msg_content_type.clone(),
            content: payload.content.clone(),
            reply_to: payload.reply_to.clone(),
            timestamp: payload.timestamp,
        };

        // Persist
        if let Err(e) = db_groups::insert_group_message(&self.db, &group_msg).await {
            eprintln!("⚠️  DB insert_group_message (incoming) failed: {}", e);
        }

        // Emit to frontend
        let _ = app_handle.emit("group-message-received", &group_msg);

        // If we are the host, fan out to everyone except the original sender
        let group = self.require_group(&payload.group_id).await;
        if let Ok(group) = group {
            if group.host_device_id == local_device_id {
                let payload_json = serde_json::to_string(payload)
                    .map_err(|e| format!("Serialize GROUP_MESSAGE for fan-out: {}", e))?;
                self.fan_out_message(
                    &payload_json,
                    &payload.from_device_id, // exclude original sender
                    &payload.group_id,
                    app_handle,
                )
                .await;
            }
        }

        Ok(())
    }

    /// Called by the TCP server when a `GROUP_CONTROL` arrives.
    ///
    /// Reconciles local group state (creates groups, adds/removes members,
    /// handles host changes and disbands) and emits events to the frontend.
    pub async fn handle_incoming_group_control(
        &self,
        payload: &GroupControlPayload,
        _local_device_id: &str,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        match payload.action {
            GroupControlAction::Create => {
                // Store the group locally
                let group = GroupChat {
                    id: payload.group_id.clone(),
                    name: payload.group_name.clone(),
                    creator_device_id: payload.from_device_id.clone(),
                    host_device_id: payload.host_device_id.clone(),
                    created_at: payload.timestamp,
                    updated_at: payload.timestamp,
                };
                if let Err(e) = db_groups::create_group(&self.db, &group).await {
                    eprintln!("⚠️  DB create_group (incoming) failed: {}", e);
                }
                // Reconcile member list
                self.reconcile_members(&payload.group_id, &payload.members)
                    .await;

                let _ = app_handle.emit("group-created", &group);
                println!(
                    "📥 Group invite received: {} ({})",
                    group.name, group.id
                );
            }

            GroupControlAction::MemberAdded => {
                self.reconcile_members(&payload.group_id, &payload.members)
                    .await;
                let _ = app_handle.emit(
                    "group-member-added",
                    serde_json::json!({
                        "group_id": payload.group_id,
                        "device_id": payload.target_device_id,
                    }),
                );
            }

            GroupControlAction::MemberRemoved => {
                self.reconcile_members(&payload.group_id, &payload.members)
                    .await;
                // Update host if changed
                if let Err(e) =
                    db_groups::update_group_host(&self.db, &payload.group_id, &payload.host_device_id)
                        .await
                {
                    eprintln!("⚠️  DB update_group_host failed: {}", e);
                }
                let _ = app_handle.emit(
                    "group-member-removed",
                    serde_json::json!({
                        "group_id": payload.group_id,
                        "device_id": payload.target_device_id,
                    }),
                );
            }

            GroupControlAction::HostChanged => {
                if let Err(e) =
                    db_groups::update_group_host(&self.db, &payload.group_id, &payload.host_device_id)
                        .await
                {
                    eprintln!("⚠️  DB update_group_host failed: {}", e);
                }
                let _ = app_handle.emit(
                    "group-host-changed",
                    serde_json::json!({
                        "group_id": payload.group_id,
                        "host_device_id": payload.host_device_id,
                    }),
                );
            }

            GroupControlAction::Disband => {
                if let Err(e) = db_groups::delete_group(&self.db, &payload.group_id).await {
                    eprintln!("⚠️  DB delete_group (disband) failed: {}", e);
                }
                let _ = app_handle.emit(
                    "group-disbanded",
                    serde_json::json!({ "group_id": payload.group_id }),
                );
                println!("🗑️  Group {} disbanded by {}", payload.group_id, payload.from_device_id);
            }
        }

        Ok(())
    }

    // ── Queries ──────────────────────────────────────────────────────────────

    /// Return all groups the local device belongs to.
    pub async fn get_groups(&self, local_device_id: &str) -> Result<Vec<GroupChat>, String> {
        db_groups::get_groups_for_device(&self.db, local_device_id)
            .await
            .map_err(|e| format!("DB get_groups_for_device: {}", e))
    }

    /// Return summaries (group + members + last message) for sidebar display.
    pub async fn get_group_summaries(
        &self,
        local_device_id: &str,
    ) -> Result<Vec<GroupSummary>, String> {
        db_groups::get_group_summaries(&self.db, local_device_id)
            .await
            .map_err(|e| format!("DB get_group_summaries: {}", e))
    }

    /// Return all messages for a group.
    pub async fn get_group_messages(&self, group_id: &str) -> Result<Vec<GroupMessage>, String> {
        db_groups::get_group_messages(&self.db, group_id)
            .await
            .map_err(|e| format!("DB get_group_messages: {}", e))
    }

    /// Return members of a group.
    pub async fn get_group_members(&self, group_id: &str) -> Result<Vec<GroupMember>, String> {
        db_groups::get_members(&self.db, group_id)
            .await
            .map_err(|e| format!("DB get_members: {}", e))
    }

    /// Get a single group by ID.
    pub async fn get_group(&self, group_id: &str) -> Result<Option<GroupChat>, String> {
        db_groups::get_group(&self.db, group_id)
            .await
            .map_err(|e| format!("DB get_group: {}", e))
    }

    // ── Host election ────────────────────────────────────────────────────────

    /// Elect a new host for the group.  Picks the remaining member with the
    /// lexicographically smallest `device_id`.
    async fn elect_new_host(&self, group_id: &str) -> Result<String, String> {
        let members = db_groups::get_members(&self.db, group_id)
            .await
            .map_err(|e| format!("DB get_members for election: {}", e))?;

        if members.is_empty() {
            return Err("No members remaining — cannot elect host".to_string());
        }

        // Smallest device_id wins
        let new_host = members
            .iter()
            .min_by(|a, b| a.device_id.cmp(&b.device_id))
            .unwrap();

        db_groups::update_group_host(&self.db, group_id, &new_host.device_id)
            .await
            .map_err(|e| format!("DB update_group_host: {}", e))?;

        println!(
            "👑 New host for group {}: {}",
            group_id, new_host.device_id
        );
        Ok(new_host.device_id.clone())
    }

    /// Public API to trigger host election — called when discovery detects
    /// that the current host went offline.
    pub async fn check_and_elect_host(
        &self,
        group_id: &str,
        offline_device_id: &str,
        local_device_id: &str,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        let group = match self.get_group(group_id).await? {
            Some(g) => g,
            None => return Ok(()), // group doesn't exist locally
        };

        // Only trigger election if the offline device was the host
        if group.host_device_id != offline_device_id {
            return Ok(());
        }

        let new_host = self.elect_new_host(group_id).await?;

        // If we became the new host, broadcast the change
        if new_host == local_device_id {
            let all_members = self.build_member_info_list(group_id).await?;
            let control = GroupControlPayload {
                msg_type: "GROUP_CONTROL".to_string(),
                action: GroupControlAction::HostChanged,
                group_id: group_id.to_string(),
                group_name: group.name,
                from_device_id: local_device_id.to_string(),
                target_device_id: None,
                host_device_id: new_host.clone(),
                members: all_members,
                timestamp: chrono::Utc::now().timestamp(),
            };
            self.broadcast_control(&control, local_device_id, app_handle)
                .await;
        }

        let _ = app_handle.emit(
            "group-host-changed",
            serde_json::json!({
                "group_id": group_id,
                "host_device_id": new_host,
            }),
        );

        Ok(())
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /// Require that a group exists, returning it or an error.
    async fn require_group(&self, group_id: &str) -> Result<GroupChat, String> {
        db_groups::get_group(&self.db, group_id)
            .await
            .map_err(|e| format!("DB get_group: {}", e))?
            .ok_or_else(|| format!("Group {} not found", group_id))
    }

    /// Require that the given device is the host of the group.
    fn require_host(&self, group: &GroupChat, device_id: &str) -> Result<(), String> {
        if group.host_device_id != device_id {
            return Err(format!(
                "Device {} is not the host of group {}",
                device_id, group.id
            ));
        }
        Ok(())
    }

    /// Build a `Vec<GroupMemberInfo>` from the current DB state.
    async fn build_member_info_list(
        &self,
        group_id: &str,
    ) -> Result<Vec<GroupMemberInfo>, String> {
        let members = db_groups::get_members(&self.db, group_id)
            .await
            .map_err(|e| format!("DB get_members: {}", e))?;

        Ok(members
            .into_iter()
            .map(|m| GroupMemberInfo {
                device_id: m.device_id,
                role: m.role,
            })
            .collect())
    }

    /// Fan out a JSON message to every member of a group except
    /// `exclude_device_id`.
    async fn fan_out_message(
        &self,
        payload_json: &str,
        exclude_device_id: &str,
        group_id: &str,
        app_handle: &AppHandle,
    ) {
        let members = match db_groups::get_members(&self.db, group_id).await {
            Ok(m) => m,
            Err(e) => {
                eprintln!("⚠️  fan_out: failed to load members for {}: {}", group_id, e);
                return;
            }
        };

        for member in &members {
            if member.device_id == exclude_device_id {
                continue;
            }
            if let Err(e) = self
                .send_to_device(&member.device_id, payload_json, app_handle)
                .await
            {
                eprintln!(
                    "⚠️  fan_out to {} failed: {}",
                    member.device_id, e
                );
            }
        }
    }

    /// Broadcast a `GroupControlPayload` to every member except the sender.
    async fn broadcast_control(
        &self,
        control: &GroupControlPayload,
        exclude_device_id: &str,
        app_handle: &AppHandle,
    ) {
        let json = match serde_json::to_string(control) {
            Ok(j) => j,
            Err(e) => {
                eprintln!("⚠️  broadcast_control serialize failed: {}", e);
                return;
            }
        };

        // If there's a target (e.g. a new member being added who may not be
        // in the DB member list yet), ensure they get the message too.
        let members = match db_groups::get_members(&self.db, &control.group_id).await {
            Ok(m) => m,
            Err(e) => {
                eprintln!("⚠️  broadcast_control: member lookup failed: {}", e);
                return;
            }
        };

        let mut sent_to = std::collections::HashSet::new();

        for member in &members {
            if member.device_id == exclude_device_id {
                continue;
            }
            if let Err(e) = self
                .send_to_device(&member.device_id, &json, app_handle)
                .await
            {
                eprintln!(
                    "⚠️  broadcast_control to {} failed: {}",
                    member.device_id, e
                );
            }
            sent_to.insert(member.device_id.clone());
        }

        // Also send to the target if they weren't in the member list yet
        if let Some(ref target) = control.target_device_id {
            if !sent_to.contains(target) && target != exclude_device_id {
                if let Err(e) = self.send_to_device(target, &json, app_handle).await {
                    eprintln!(
                        "⚠️  broadcast_control to target {} failed: {}",
                        target, e
                    );
                }
            }
        }
    }

    /// Send an already-serialised JSON payload to a single device using the
    /// existing encrypted TCP channel.
    ///
    /// Looks up the device address from mDNS discovery via the `AppHandle`.
    async fn send_to_device(
        &self,
        device_id: &str,
        payload_json: &str,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        let client = self
            .tcp_client
            .as_ref()
            .ok_or_else(|| "TCP client not initialised".to_string())?;

        // Look up peer address from discovery
        let discovery = app_handle
            .try_state::<Arc<crate::discovery::MdnsDiscoveryService>>()
            .ok_or_else(|| "Discovery service not available".to_string())?;

        let devices: Vec<crate::discovery::Device> = discovery.get_devices().await;
        let peer = devices
            .iter()
            .find(|d| d.id == device_id)
            .ok_or_else(|| format!("Device {} not found in discovery", device_id))?;

        let peer_address = peer
            .addresses
            .first()
            .ok_or_else(|| format!("Device {} has no network address", device_id))?;

        let port = peer.port;

        client
            .send_text_message(
                device_id,
                peer_address,
                port,
                payload_json.as_bytes().to_vec(),
            )
            .await
    }

    /// Reconcile the local member list for a group with the authoritative
    /// list from a control payload.
    async fn reconcile_members(&self, group_id: &str, members: &[GroupMemberInfo]) {
        // Remove all existing members and re-insert — simple and correct.
        // (For a large group this could be optimised with a diff, but LAN
        // groups are small.)
        let _ = sqlx::query("DELETE FROM group_members WHERE group_id = ?")
            .bind(group_id)
            .execute(&*self.db)
            .await;

        let now = chrono::Utc::now().timestamp();
        for m in members {
            let member = GroupMember {
                group_id: group_id.to_string(),
                device_id: m.device_id.clone(),
                role: m.role.clone(),
                joined_at: now,
            };
            if let Err(e) = db_groups::add_member(&self.db, &member).await {
                eprintln!("⚠️  reconcile_members add {} failed: {}", m.device_id, e);
            }
        }
    }

    /// Clear all group data (used by "Reset App").
    pub async fn clear_all(&self) -> Result<(), String> {
        db_groups::clear_all_groups(&self.db)
            .await
            .map_err(|e| format!("DB clear_all_groups: {}", e))
    }
}

impl Clone for GroupService {
    fn clone(&self) -> Self {
        Self {
            db: Arc::clone(&self.db),
            tcp_client: self.tcp_client.clone(),
            tcp_port: self.tcp_port,
        }
    }
}
