//! IPC Commands
//!
//! Tauri command handlers for frontend-backend communication.

use crate::discovery::{Device, MdnsDiscoveryService};
use crate::identity::{DeviceIdentity, IdentityManager};
use crate::messaging::{Message, MessageType, MessagingService, Thread};
use crate::network::protocol::{serialize_json, FileAckPayload, FileRejectPayload};
use crate::network::{FileTransfer, FileTransferService};
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
) -> Result<(), String> {
    messaging.clear_all().await;
    file_transfer.clear_all().await;
    println!("✓ All application data cleared via IPC");
    Ok(())
}
