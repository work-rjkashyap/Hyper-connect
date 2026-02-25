//! IPC Commands
//!
//! Tauri command handlers for frontend-backend communication.

use crate::discovery::{Device, MdnsDiscoveryService};
use crate::identity::{DeviceIdentity, IdentityManager};
use crate::messaging::{
    GroupChat, GroupControlAction, GroupMember, GroupMemberInfo, GroupMessage, GroupRole,
    GroupService, GroupSummary, Message, MessageType, MessagingService, Thread,
};
use crate::network::protocol::{serialize_json, FileAckPayload, FileRejectPayload};
use crate::network::{FileTransfer, FileTransferService};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Emitter;
use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex;

/// Newtype wrapper so `u16` can be stored as distinct managed state.
pub struct TcpPort(pub u16);

/// Managed state that holds the user's chosen download directory.
/// Defaults to the system Downloads folder when not explicitly set.
pub struct DownloadDir(pub Mutex<Option<PathBuf>>);

// ============================================================================
// Connection Health Commands
// ============================================================================

/// Proactively verify or establish the TCP connection to a peer device.
///
/// Called by the frontend the moment a chat window opens so that the first
/// real message can be sent without any handshake delay.
///
/// Returns the round-trip latency in milliseconds on success.
/// Also emits a `connection-status` event:
/// ```json
/// { "device_id": "...", "connected": true,  "latency_ms": 12 }
/// { "device_id": "...", "connected": false, "error": "..." }
/// ```
#[tauri::command]
pub async fn ping_device(
    messaging: State<'_, MessagingService>,
    device_id: String,
    peer_address: String,
    peer_port: Option<u16>,
    app_handle: AppHandle,
) -> Result<u64, String> {
    messaging
        .ensure_connected(&device_id, &peer_address, peer_port, app_handle)
        .await
}

// ============================================================================
// Identity Commands
// ============================================================================

#[tauri::command]
pub fn get_device_info(
    identity: State<std::sync::Mutex<IdentityManager>>,
) -> Result<DeviceIdentity, String> {
    let manager = identity
        .lock()
        .map_err(|_| "Identity lock poisoned".to_string())?;
    Ok(manager.identity().clone())
}

#[tauri::command]
pub fn update_display_name(
    identity: State<std::sync::Mutex<IdentityManager>>,
    name: String,
) -> Result<(), String> {
    let mut manager = identity
        .lock()
        .map_err(|_| "Identity lock poisoned".to_string())?;
    manager.update_display_name(name)
}

// ============================================================================
// Discovery Commands
// ============================================================================

#[tauri::command]
pub fn start_discovery(
    discovery: State<Arc<MdnsDiscoveryService>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    discovery.start_discovery(app_handle)
}

#[tauri::command]
pub fn start_advertising(
    discovery: State<Arc<MdnsDiscoveryService>>,
    port: u16,
) -> Result<(), String> {
    discovery.start_advertising(port)
}

#[tauri::command]
pub async fn get_devices(
    discovery: State<'_, Arc<MdnsDiscoveryService>>,
) -> Result<Vec<Device>, String> {
    Ok(discovery.get_devices().await)
}

#[tauri::command]
pub fn get_local_device_id(discovery: State<Arc<MdnsDiscoveryService>>) -> String {
    discovery.local_device_id().to_string()
}

// ============================================================================
// Messaging Commands
// ============================================================================

#[tauri::command]
pub async fn send_message(
    messaging: State<'_, MessagingService>,
    from_device_id: String,
    to_device_id: String,
    content: String,
    peer_address: String,
    peer_port: Option<u16>,
    app_handle: AppHandle,
) -> Result<Message, String> {
    let message_type = MessageType::Text { content };
    messaging
        .send_message(
            from_device_id,
            to_device_id,
            message_type,
            peer_address,
            peer_port,
            app_handle,
        )
        .await
}

#[tauri::command]
pub async fn get_messages(
    messaging: State<'_, MessagingService>,
    device1: String,
    device2: String,
) -> Result<Vec<Message>, String> {
    Ok(messaging.get_messages(&device1, &device2).await)
}

#[tauri::command]
pub async fn get_threads(messaging: State<'_, MessagingService>) -> Result<Vec<Thread>, String> {
    Ok(messaging.get_threads().await)
}

#[tauri::command]
pub async fn mark_as_read(
    messaging: State<'_, MessagingService>,
    message_id: String,
    conversation_key: String,
) -> Result<(), String> {
    messaging.mark_as_read(&message_id, &conversation_key).await
}

#[tauri::command]
pub async fn mark_thread_as_read(
    messaging: State<'_, MessagingService>,
    thread_id: String,
) -> Result<(), String> {
    messaging.mark_thread_as_read(&thread_id).await
}

/// Mark every received message in a conversation as `Read`, emit a
/// `conversation-read` event so the sidebar badge updates in real-time,
/// and send a TCP read receipt to the original sender(s) so their bubbles
/// flip to blue double-ticks.
#[tauri::command]
pub async fn mark_conversation_as_read(
    messaging: State<'_, MessagingService>,
    discovery: State<'_, Arc<MdnsDiscoveryService>>,
    conversation_key: String,
    reader_device_id: String,
    app_handle: AppHandle,
) -> Result<u32, String> {
    let marked = messaging
        .mark_conversation_as_read(&conversation_key, &reader_device_id)
        .await?;

    if marked > 0 {
        let _ = app_handle.emit(
            "conversation-read",
            serde_json::json!({
                "conversation_key": conversation_key,
                "reader_device_id": reader_device_id,
            }),
        );

        // Derive the peer device ID from the conversation key
        // (conversation_key = sorted(id_a, id_b).join("_"))
        let peer_device_id = conversation_key
            .split('_')
            .find(|part| *part != reader_device_id.as_str())
            .map(|s| s.to_string());

        if let Some(peer_id) = peer_device_id {
            // Look up peer address in mDNS
            let devices = discovery.get_devices().await;
            if let Some(peer) = devices.iter().find(|d| d.id == peer_id) {
                if let Some(addr) = peer.addresses.first() {
                    let _ = messaging
                        .send_read_receipt(
                            &conversation_key,
                            &reader_device_id, // we are the reader
                            &peer_id,          // receipt goes to the original sender
                            addr,
                            peer.port,
                        )
                        .await;
                }
            }
        }
    }

    Ok(marked)
}

// ============================================================================
// Offline Message Queue Commands
// ============================================================================

/// Result of a queue flush operation.
#[derive(Debug, Clone, Serialize)]
pub struct FlushResult {
    pub device_id: String,
    pub flushed: u32,
    pub remaining: u32,
}

/// Flush all queued (unsent) messages for a peer device that just came online.
///
/// The frontend should call this whenever a `device-discovered` event fires so
/// that messages queued while the peer was offline are delivered automatically.
#[tauri::command]
pub async fn flush_message_queue(
    messaging: State<'_, MessagingService>,
    discovery: State<'_, Arc<MdnsDiscoveryService>>,
    device_id: String,
    app_handle: AppHandle,
) -> Result<FlushResult, String> {
    // Look up the device's current address from mDNS discovery
    let devices = discovery.get_devices().await;
    let peer = devices
        .iter()
        .find(|d| d.id == device_id)
        .ok_or_else(|| format!("Device {} not found in discovery", device_id))?;

    let peer_address = peer
        .addresses
        .first()
        .ok_or_else(|| format!("Device {} has no network address", device_id))?;

    let flushed = messaging
        .flush_queue_for_device(&device_id, peer_address, peer.port, app_handle)
        .await;

    let remaining = messaging.queued_count_for_device(&device_id).await;

    Ok(FlushResult {
        device_id,
        flushed,
        remaining,
    })
}

/// Return the number of queued (unsent) messages for a specific peer, or the
/// total across all peers when `device_id` is `None`.
#[tauri::command]
pub async fn get_queued_count(
    messaging: State<'_, MessagingService>,
    device_id: Option<String>,
) -> Result<u32, String> {
    match device_id {
        Some(id) => Ok(messaging.queued_count_for_device(&id).await),
        None => Ok(messaging.total_queued_count().await),
    }
}

// ============================================================================
// File Transfer Commands
// ============================================================================

#[tauri::command]
pub async fn create_transfer(
    file_transfer: State<'_, FileTransferService>,
    filename: String,
    file_path: String,
    from_device_id: String,
    to_device_id: String,
) -> Result<FileTransfer, String> {
    file_transfer
        .create_transfer(filename, file_path, from_device_id, to_device_id)
        .await
}

#[tauri::command]
pub async fn start_transfer(
    file_transfer: State<'_, FileTransferService>,
    transfer_id: String,
    peer_address: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    file_transfer
        .start_transfer(&transfer_id, Some(peer_address), app_handle)
        .await
}

#[tauri::command]
pub async fn accept_transfer(
    file_transfer: State<'_, FileTransferService>,
    discovery: State<'_, Arc<MdnsDiscoveryService>>,
    transfer_id: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    // 1. Accept locally (sets status to InProgress, assigns download path)
    file_transfer.accept_transfer(&transfer_id).await?;

    // 2. Look up the sender's address so we can send the ACK back
    let sender_device_id = {
        let transfers = file_transfer.transfers.lock().await;
        let t = transfers
            .get(&transfer_id)
            .ok_or("Transfer not found after accept")?;
        t.from_device_id.clone()
    };

    // Get the TCP port from managed state
    let tcp_port = app_handle
        .try_state::<TcpPort>()
        .map(|p| p.0)
        .unwrap_or(8080);

    let devices = discovery.get_devices().await;
    if let Some(sender) = devices.iter().find(|d| d.id == sender_device_id) {
        if let Some(addr) = sender.addresses.first() {
            // Send FILE_ACK so the sender knows to start streaming
            let ack = FileAckPayload {
                transfer_id: transfer_id.clone(),
                offset: 0,
            };
            if let Ok(payload) = serialize_json(&ack) {
                if let Some(ref tcp_client) = file_transfer.tcp_client_ref() {
                    let _ = tcp_client
                        .send_file_ack(&sender_device_id, addr, tcp_port, payload)
                        .await;
                    println!("✓ Sent FILE_ACK to {}", sender_device_id);
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn reject_transfer(
    file_transfer: State<'_, FileTransferService>,
    discovery: State<'_, Arc<MdnsDiscoveryService>>,
    transfer_id: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    // 1. Reject locally (sets status to Cancelled)
    file_transfer.reject_transfer(&transfer_id).await?;

    // 2. Look up the sender's address so we can notify them
    let sender_device_id = {
        let transfers = file_transfer.transfers.lock().await;
        let t = transfers
            .get(&transfer_id)
            .ok_or("Transfer not found after reject")?;
        t.from_device_id.clone()
    };

    let tcp_port = app_handle
        .try_state::<TcpPort>()
        .map(|p| p.0)
        .unwrap_or(8080);

    let devices = discovery.get_devices().await;
    if let Some(sender) = devices.iter().find(|d| d.id == sender_device_id) {
        if let Some(addr) = sender.addresses.first() {
            let reject = FileRejectPayload {
                msg_type: "FILE_REJECT".to_string(),
                transfer_id: transfer_id.clone(),
                reason: "Declined by receiver".to_string(),
            };
            if let Ok(payload) = serialize_json(&reject) {
                if let Some(ref tcp_client) = file_transfer.tcp_client_ref() {
                    let _ = tcp_client
                        .send_file_reject(&sender_device_id, addr, tcp_port, payload)
                        .await;
                    println!("✓ Sent FILE_REJECT to {}", sender_device_id);
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn pause_transfer(
    file_transfer: State<'_, FileTransferService>,
    transfer_id: String,
) -> Result<(), String> {
    file_transfer.pause_transfer(&transfer_id).await
}

#[tauri::command]
pub async fn cancel_transfer(
    file_transfer: State<'_, FileTransferService>,
    transfer_id: String,
) -> Result<(), String> {
    file_transfer.cancel_transfer(&transfer_id).await
}

#[tauri::command]
pub async fn get_transfers(
    file_transfer: State<'_, FileTransferService>,
) -> Result<Vec<FileTransfer>, String> {
    Ok(file_transfer.get_transfers().await)
}

#[tauri::command]
pub async fn resume_transfer(
    file_transfer: State<'_, FileTransferService>,
    transfer_id: String,
    peer_address: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    file_transfer
        .resume_transfer(&transfer_id, Some(peer_address), app_handle)
        .await
}

#[tauri::command]
pub async fn get_resumable_transfers(
    file_transfer: State<'_, FileTransferService>,
) -> Result<Vec<FileTransfer>, String> {
    Ok(file_transfer.get_resumable_transfers().await)
}

#[tauri::command]
pub fn get_tcp_port(tcp_port: State<TcpPort>) -> u16 {
    tcp_port.0
}

// ============================================================================
// App Reset Commands
// ============================================================================

// ============================================================================
// Download Directory Commands
// ============================================================================

/// Return the current effective download directory.
///
/// If the user has set a custom path via `set_download_dir`, that path is
/// returned.  Otherwise the platform's standard Downloads folder is used.
#[tauri::command]
pub async fn get_default_downloads_dir(
    download_dir: State<'_, DownloadDir>,
    app_handle: AppHandle,
) -> Result<String, String> {
    // Check if user has set a custom dir
    let guard = download_dir.0.lock().await;
    if let Some(ref custom) = *guard {
        return Ok(custom.to_string_lossy().to_string());
    }
    drop(guard);

    // Fall back to system Downloads directory
    if let Some(dirs) = dirs::download_dir() {
        Ok(dirs.to_string_lossy().to_string())
    } else {
        // Last resort: app data dir / downloads
        let fallback = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?
            .join("downloads");
        let _ = std::fs::create_dir_all(&fallback);
        Ok(fallback.to_string_lossy().to_string())
    }
}

/// Let the user change where received files are saved.
#[tauri::command]
pub async fn set_download_dir(
    download_dir: State<'_, DownloadDir>,
    path: String,
) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.is_dir() {
        return Err(format!("Path is not a valid directory: {}", path));
    }
    let mut guard = download_dir.0.lock().await;
    *guard = Some(p);
    println!("✓ Download directory set to: {}", path);
    Ok(())
}

/// Open the containing folder of a file in the system file manager,
/// or open the folder itself if the path points to a directory.
#[tauri::command]
pub async fn open_file_location(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);

    // Determine the folder to reveal
    let folder = if p.is_dir() {
        p.to_path_buf()
    } else if let Some(parent) = p.parent() {
        parent.to_path_buf()
    } else {
        return Err("Cannot determine parent directory".to_string());
    };

    if !folder.exists() {
        return Err(format!("Path does not exist: {}", folder.display()));
    }

    // Platform-specific "reveal in file manager"
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&folder)
            .spawn()
            .map_err(|e| format!("Failed to open Finder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&folder)
            .spawn()
            .map_err(|e| format!("Failed to open Explorer: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&folder)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }

    Ok(())
}

// ============================================================================
// App Reset Commands
// ============================================================================

/// Clear all in-memory application data: messages, threads, file transfers,
/// and pooled TCP connections.
///
/// Called by the frontend "Reset App" / "Clear All Data" button. The frontend
/// is responsible for also clearing its own persisted Zustand store and
/// localStorage after this command succeeds.
#[tauri::command]
pub async fn clear_all_data(
    messaging: State<'_, MessagingService>,
    file_transfer: State<'_, FileTransferService>,
    group_service: State<'_, GroupService>,
) -> Result<(), String> {
    messaging.clear_all().await;
    file_transfer.clear_all().await;
    group_service.clear_all().await?;
    println!("✓ All application data cleared via IPC");
    Ok(())
}

// ============================================================================
// Group Chat Commands
// ============================================================================

/// Create a new group chat.  The local device becomes the host.
///
/// `member_device_ids` should include ALL members (the local device will be
/// added automatically if not present).
#[tauri::command]
pub async fn create_group(
    group_service: State<'_, GroupService>,
    name: String,
    local_device_id: String,
    member_device_ids: Vec<String>,
    app_handle: AppHandle,
) -> Result<GroupChat, String> {
    group_service
        .create_group(name, local_device_id, member_device_ids, app_handle)
        .await
}

/// Add a member to an existing group.  Only the host can do this.
#[tauri::command]
pub async fn add_group_member(
    group_service: State<'_, GroupService>,
    group_id: String,
    new_device_id: String,
    local_device_id: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    group_service
        .add_member(&group_id, &new_device_id, &local_device_id, &app_handle)
        .await
}

/// Remove a member from a group.  Only the host can do this.
#[tauri::command]
pub async fn remove_group_member(
    group_service: State<'_, GroupService>,
    group_id: String,
    target_device_id: String,
    local_device_id: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    group_service
        .remove_member(&group_id, &target_device_id, &local_device_id, &app_handle)
        .await
}

/// Leave a group.  If the leaving member is the host, a new host is elected.
#[tauri::command]
pub async fn leave_group(
    group_service: State<'_, GroupService>,
    group_id: String,
    local_device_id: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    group_service
        .leave_group(&group_id, &local_device_id, &app_handle)
        .await
}

/// Disband (delete) a group.  Only the host or creator can do this.
#[tauri::command]
pub async fn disband_group(
    group_service: State<'_, GroupService>,
    group_id: String,
    local_device_id: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    group_service
        .disband_group(&group_id, &local_device_id, &app_handle)
        .await
}

/// Send a text message to a group.
///
/// If the sender is the host, the message is fanned out directly.
/// Otherwise it is forwarded to the host, which fans it out.
#[tauri::command]
pub async fn send_group_message(
    group_service: State<'_, GroupService>,
    group_id: String,
    local_device_id: String,
    content: String,
    msg_content_type: Option<String>,
    reply_to: Option<String>,
    app_handle: AppHandle,
) -> Result<GroupMessage, String> {
    group_service
        .send_group_message(
            &group_id,
            &local_device_id,
            content,
            msg_content_type.unwrap_or_else(|| "text".to_string()),
            reply_to,
            app_handle,
        )
        .await
}

/// Return all groups the local device belongs to.
#[tauri::command]
pub async fn get_groups(
    group_service: State<'_, GroupService>,
    local_device_id: String,
) -> Result<Vec<GroupChat>, String> {
    group_service.get_groups(&local_device_id).await
}

/// Return all messages for a group, ordered oldest-first.
#[tauri::command]
pub async fn get_group_messages(
    group_service: State<'_, GroupService>,
    group_id: String,
) -> Result<Vec<GroupMessage>, String> {
    group_service.get_group_messages(&group_id).await
}

/// Return all members of a group.
#[tauri::command]
pub async fn get_group_members(
    group_service: State<'_, GroupService>,
    group_id: String,
) -> Result<Vec<GroupMember>, String> {
    group_service.get_group_members(&group_id).await
}

/// Rename a group.  Only the host can do this.
#[tauri::command]
pub async fn rename_group(
    group_service: State<'_, GroupService>,
    group_id: String,
    new_name: String,
    local_device_id: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    group_service
        .rename_group(&group_id, new_name, &local_device_id, &app_handle)
        .await
}

/// Clear all messages in a group.  Only the host can do this.
#[tauri::command]
pub async fn clear_group_history(
    group_service: State<'_, GroupService>,
    group_id: String,
    local_device_id: String,
) -> Result<(), String> {
    group_service
        .clear_group_history(&group_id, &local_device_id)
        .await
}

/// Detailed group info including member roles and available actions.
///
/// Returns the group metadata, a list of members annotated with their
/// [`GroupRole`], and the set of [`GroupControlAction`]s the caller can
/// perform (based on whether they are the host).
#[derive(Debug, Clone, Serialize)]
pub struct GroupInfo {
    pub group: GroupChat,
    pub members: Vec<GroupMemberInfo>,
    pub my_role: GroupRole,
    pub available_actions: Vec<String>,
}

/// Map a [`GroupControlAction`] to the string label shown in the UI.
fn action_label(action: &GroupControlAction) -> &'static str {
    match action {
        GroupControlAction::Create => "create",
        GroupControlAction::MemberAdded => "add_member",
        GroupControlAction::MemberRemoved => "remove_member",
        GroupControlAction::HostChanged => "change_host",
        GroupControlAction::Disband => "disband",
    }
}

/// Get detailed info about a group, including member roles and the set of
/// actions the requesting device is allowed to perform.
#[tauri::command]
pub async fn get_group_info(
    group_service: State<'_, GroupService>,
    group_id: String,
    local_device_id: String,
) -> Result<GroupInfo, String> {
    let group = group_service
        .get_group(&group_id)
        .await?
        .ok_or_else(|| format!("Group {} not found", group_id))?;

    let members = group_service.get_group_members(&group_id).await?;

    // Build GroupMemberInfo list with roles
    let member_infos: Vec<GroupMemberInfo> = members
        .iter()
        .map(|m| GroupMemberInfo {
            device_id: m.device_id.clone(),
            role: m.role.clone(),
        })
        .collect();

    // Determine the caller's role
    let my_role = members
        .iter()
        .find(|m| m.device_id == local_device_id)
        .map(|m| m.role.clone())
        .unwrap_or(GroupRole::Member);

    // Compute available actions based on role
    let mut available_actions = Vec::new();
    match my_role {
        GroupRole::Host => {
            available_actions.push(action_label(&GroupControlAction::MemberAdded).to_string());
            available_actions.push(action_label(&GroupControlAction::MemberRemoved).to_string());
            available_actions.push(action_label(&GroupControlAction::HostChanged).to_string());
            available_actions.push(action_label(&GroupControlAction::Disband).to_string());
        }
        GroupRole::Member => {
            // Regular members can only leave (which is MemberRemoved on self)
            available_actions.push("leave".to_string());
        }
    }

    Ok(GroupInfo {
        group,
        members: member_infos,
        my_role,
        available_actions,
    })
}

/// Return group summaries (group + members + last message) for sidebar display.
#[tauri::command]
pub async fn get_group_summaries(
    group_service: State<'_, GroupService>,
    local_device_id: String,
) -> Result<Vec<GroupSummary>, String> {
    group_service.get_group_summaries(&local_device_id).await
}
