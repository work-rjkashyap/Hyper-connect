//! IPC Commands
//!
//! Tauri command handlers for frontend-backend communication.

use crate::ai::AiService;
use crate::ai::types::{
    AiChatMessage, AiModel, AiStatus, AnalyzeRequest, AnalyzeResponse, AskRequest, AskResponse,
    SmartReplyRequest, SmartReplyResponse, SmartSearchRequest, SmartSearchResponse,
    SummarizeRequest, SummarizeResponse,
};
use crate::crypto::VerificationService;
use crate::crypto::verification_service::VerificationStatus;
use crate::db;
use crate::db::search::{SearchResponse, MessageSearchResult, GroupMessageSearchResult, FileSearchResult};
use crate::discovery::{Device, MdnsDiscoveryService};
use crate::identity::{DeviceIdentity, IdentityManager};
use crate::messaging::{
    GroupChat, GroupControlAction, GroupMember, GroupMemberInfo, GroupMessage, GroupRole,
    GroupService, GroupSummary, Message, MessageType, MessagingService, Thread,
};
use crate::network::protocol::{serialize_json, FileAckPayload, FileRejectPayload};
use crate::network::{FileTransfer, FileTransferService, TcpClient};
use crate::screen_share::{ScreenShareService, ScreenShareSession};
use crate::screen_share::types::StreamQuality;
use crate::mesh::MeshRouter;
use crate::mesh::types::MeshRoute;
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

// ── Android: copy a content:// URI to a real file via JNI ContentResolver ───

#[cfg(target_os = "android")]
fn copy_content_uri_jni(uri_str: &str, dest: &std::path::Path) -> Result<(), String> {
    use jni::objects::{JObject, JValue};
    use std::io::Write;

    // Obtain the JVM and Android activity that ndk-context set up at process start.
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }
        .map_err(|e| format!("JavaVM init: {e}"))?;
    let mut env = vm
        .attach_current_thread()
        .map_err(|e| format!("JNI attach: {e}"))?;

    let activity = unsafe { JObject::from_raw(ctx.context().cast()) };

    // ContentResolver resolver = activity.getContentResolver();
    let resolver = env
        .call_method(&activity, "getContentResolver", "()Landroid/content/ContentResolver;", &[])
        .map_err(|e| format!("getContentResolver: {e}"))?
        .l()
        .map_err(|e| format!("ContentResolver l(): {e}"))?;

    // Uri uri = Uri.parse(uriStr);
    let uri_jstr = env.new_string(uri_str).map_err(|e| format!("new_string: {e}"))?;
    let uri_class = env.find_class("android/net/Uri").map_err(|e| format!("find Uri: {e}"))?;
    let uri_obj = env
        .call_static_method(
            uri_class,
            "parse",
            "(Ljava/lang/String;)Landroid/net/Uri;",
            &[JValue::from(&uri_jstr)],
        )
        .map_err(|e| format!("Uri.parse: {e}"))?
        .l()
        .map_err(|e| format!("Uri l(): {e}"))?;

    // InputStream is = resolver.openInputStream(uri);
    let input_stream = env
        .call_method(
            &resolver,
            "openInputStream",
            "(Landroid/net/Uri;)Ljava/io/InputStream;",
            &[JValue::from(&uri_obj)],
        )
        .map_err(|e| format!("openInputStream: {e}"))?
        .l()
        .map_err(|e| format!("InputStream l(): {e}"))?;

    if input_stream.is_null() {
        return Err(format!("ContentResolver returned null stream for {}", uri_str));
    }

    // Read in 64KB chunks
    let buf_size = 65536i32;
    let byte_array = env.new_byte_array(buf_size).map_err(|e| format!("new_byte_array: {e}"))?;

    let mut dest_file = std::fs::File::create(dest)
        .map_err(|e| format!("create dest file: {e}"))?;

    loop {
        let n = env
            .call_method(&input_stream, "read", "([B)I", &[JValue::from(&byte_array)])
            .map_err(|e| format!("InputStream.read: {e}"))?
            .i()
            .map_err(|e| format!("read i(): {e}"))?;

        if n <= 0 {
            break;
        }

        let chunk = env
            .convert_byte_array(&byte_array)
            .map_err(|e| format!("convert_byte_array: {e}"))?;

        dest_file
            .write_all(&chunk[..n as usize])
            .map_err(|e| format!("write chunk: {e}"))?;
    }

    let _ = env.call_method(&input_stream, "close", "()V", &[]);

    Ok(())
}

fn push_unique_address(addresses: &mut Vec<String>, address: String) {
    if !address.is_empty() && !addresses.iter().any(|existing| existing == &address) {
        addresses.push(address);
    }
}

async fn candidate_peer_endpoints(
    discovery: &Arc<MdnsDiscoveryService>,
    device_id: &str,
    fallback_address: Option<&str>,
    fallback_port: Option<u16>,
) -> Vec<(String, u16)> {
    let mut addresses = Vec::new();
    let mut port = fallback_port;

    let devices = discovery.get_devices().await;
    if let Some(peer) = devices.iter().find(|d| d.id == device_id) {
        port = Some(port.unwrap_or(peer.port));
        for address in &peer.addresses {
            push_unique_address(&mut addresses, address.clone());
        }
    }

    if let Some(address) = fallback_address {
        push_unique_address(&mut addresses, address.to_string());
    }

    let port = port.unwrap_or(8080);
    addresses.into_iter().map(|address| (address, port)).collect()
}

async fn resolve_reachable_message_endpoint(
    messaging: &MessagingService,
    discovery: &Arc<MdnsDiscoveryService>,
    device_id: &str,
    fallback_address: Option<&str>,
    fallback_port: Option<u16>,
    app_handle: &AppHandle,
) -> Result<(String, u16), String> {
    let candidates = candidate_peer_endpoints(discovery, device_id, fallback_address, fallback_port).await;

    if candidates.is_empty() {
        return Err(format!("Device {} has no reachable endpoints", device_id));
    }

    let mut last_error = None;
    for (address, port) in &candidates {
        match messaging
            .ensure_connected(device_id, address, Some(*port), app_handle.clone())
            .await
        {
            Ok(_) => return Ok((address.clone(), *port)),
            Err(error) => last_error = Some(format!("{}:{} -> {}", address, port, error)),
        }
    }

    Err(last_error.unwrap_or_else(|| format!("Unable to reach device {}", device_id)))
}

async fn resolve_reachable_tcp_endpoint(
    tcp_client: &Arc<TcpClient>,
    discovery: &Arc<MdnsDiscoveryService>,
    device_id: &str,
    fallback_address: Option<&str>,
    fallback_port: Option<u16>,
) -> Result<(String, u16), String> {
    let candidates = candidate_peer_endpoints(discovery, device_id, fallback_address, fallback_port).await;

    if candidates.is_empty() {
        return Err(format!("Device {} has no reachable endpoints", device_id));
    }

    let mut last_error = None;
    for (address, port) in &candidates {
        match tcp_client.ensure_connected(device_id, address, *port).await {
            Ok(_) => return Ok((address.clone(), *port)),
            Err(error) => last_error = Some(format!("{}:{} -> {}", address, port, error)),
        }
    }

    Err(last_error.unwrap_or_else(|| format!("Unable to reach device {}", device_id)))
}

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
    discovery: State<'_, Arc<MdnsDiscoveryService>>,
    device_id: String,
    peer_address: String,
    peer_port: Option<u16>,
    app_handle: AppHandle,
) -> Result<u64, String> {
    let (resolved_address, resolved_port) = resolve_reachable_message_endpoint(
        &messaging,
        discovery.inner(),
        &device_id,
        Some(&peer_address),
        peer_port,
        &app_handle,
    )
    .await?;

    messaging
        .ensure_connected(
            &device_id,
            &resolved_address,
            Some(resolved_port),
            app_handle,
        )
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
    discovery: State<'_, Arc<MdnsDiscoveryService>>,
    from_device_id: String,
    to_device_id: String,
    content: String,
    peer_address: String,
    peer_port: Option<u16>,
    app_handle: AppHandle,
) -> Result<Message, String> {
    let resolved = resolve_reachable_message_endpoint(
        &messaging,
        discovery.inner(),
        &to_device_id,
        Some(&peer_address),
        peer_port,
        &app_handle,
    )
    .await;

    let (peer_address, peer_port) = match resolved {
        Ok((address, port)) => (address, Some(port)),
        Err(error) => {
            eprintln!(
                "⚠️ Failed to pre-resolve reachable endpoint for {}: {}",
                to_device_id, error
            );
            (peer_address, peer_port)
        }
    };

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
    let (peer_address, peer_port) = resolve_reachable_message_endpoint(
        &messaging,
        discovery.inner(),
        &device_id,
        None,
        None,
        &app_handle,
    )
    .await?;

    let flushed = messaging
        .flush_queue_for_device(&device_id, &peer_address, peer_port, app_handle)
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
    app_handle: AppHandle,
    filename: String,
    file_path: String,
    from_device_id: String,
    to_device_id: String,
) -> Result<FileTransfer, String> {
    // On Android the dialog returns a content:// URI, not a real filesystem
    // path. Use Android's ContentResolver (via JNI) to copy the file into
    // the app's temp directory, then pass the real path to the transfer logic.
    #[cfg(target_os = "android")]
    let file_path = {
        if file_path.starts_with("content://") {
            use tauri::Manager;
            use std::io::Write;

            let tmp_dir = app_handle
                .path()
                .temp_dir()
                .map_err(|e| format!("Failed to get temp dir: {}", e))?;
            std::fs::create_dir_all(&tmp_dir)
                .map_err(|e| format!("Failed to create temp dir: {}", e))?;
            let tmp_path = tmp_dir.join(&filename);

            copy_content_uri_jni(&file_path, &tmp_path)?;

            tmp_path.to_string_lossy().to_string()
        } else {
            file_path
        }
    };

    #[cfg(not(target_os = "android"))]
    let _ = app_handle; // suppress unused warning

    file_transfer
        .create_transfer(filename, file_path, from_device_id, to_device_id)
        .await
}

#[tauri::command]
pub async fn start_transfer(
    file_transfer: State<'_, FileTransferService>,
    discovery: State<'_, Arc<MdnsDiscoveryService>>,
    transfer_id: String,
    peer_address: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    let to_device_id = {
        let transfers = file_transfer.transfers.lock().await;
        let transfer = transfers
            .get(&transfer_id)
            .ok_or("Transfer not found")?;
        transfer.to_device_id.clone()
    };

    let tcp_client = file_transfer
        .tcp_client_ref()
        .ok_or("TCP client not initialized")?
        .clone();

    let (resolved_address, _) = resolve_reachable_tcp_endpoint(
        &tcp_client,
        discovery.inner(),
        &to_device_id,
        Some(&peer_address),
        None,
    )
    .await?;

    file_transfer
        .start_transfer(&transfer_id, Some(resolved_address), app_handle)
        .await
}

#[tauri::command]
pub async fn accept_transfer(
    file_transfer: State<'_, FileTransferService>,
    discovery: State<'_, Arc<MdnsDiscoveryService>>,
    download_dir: State<'_, DownloadDir>,
    transfer_id: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    // Resolve target directory: user's chosen dir → Android app dir → transfer_dir fallback
    let target_dir: Option<PathBuf> = {
        let guard = download_dir.0.lock().await;
        guard.clone()
    };

    // On Android, if no explicit dir is set, default to app_data_dir/downloads
    #[cfg(target_os = "android")]
    let target_dir = Some(target_dir.unwrap_or_else(|| {
        app_handle
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("/data/data"))
            .join("downloads")
    }));

    // 1. Accept locally (sets status to InProgress, assigns download path)
    file_transfer.accept_transfer(&transfer_id, target_dir).await?;

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
        if let Some(ref tcp_client) = file_transfer.tcp_client_ref() {
            let resolved = resolve_reachable_tcp_endpoint(
                tcp_client,
                discovery.inner(),
                &sender_device_id,
                sender.addresses.first().map(String::as_str),
                Some(tcp_port),
            )
            .await;

            if let Ok((addr, port)) = resolved {
            // Send FILE_ACK so the sender knows to start streaming
            let ack = FileAckPayload {
                transfer_id: transfer_id.clone(),
                offset: 0,
            };
            if let Ok(payload) = serialize_json(&ack) {
                let _ = tcp_client
                    .send_file_ack(&sender_device_id, &addr, port, payload)
                    .await;
                println!("✓ Sent FILE_ACK to {} via {}:{}", sender_device_id, addr, port);
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
        if let Some(ref tcp_client) = file_transfer.tcp_client_ref() {
            let resolved = resolve_reachable_tcp_endpoint(
                tcp_client,
                discovery.inner(),
                &sender_device_id,
                sender.addresses.first().map(String::as_str),
                Some(tcp_port),
            )
            .await;

            if let Ok((addr, port)) = resolved {
            let reject = FileRejectPayload {
                msg_type: "FILE_REJECT".to_string(),
                transfer_id: transfer_id.clone(),
                reason: "Declined by receiver".to_string(),
            };
            if let Ok(payload) = serialize_json(&reject) {
                let _ = tcp_client
                    .send_file_reject(&sender_device_id, &addr, port, payload)
                    .await;
                println!("✓ Sent FILE_REJECT to {} via {}:{}", sender_device_id, addr, port);
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
    discovery: State<'_, Arc<MdnsDiscoveryService>>,
    transfer_id: String,
    peer_address: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    let to_device_id = {
        let transfers = file_transfer.transfers.lock().await;
        let transfer = transfers
            .get(&transfer_id)
            .ok_or("Transfer not found")?;
        transfer.to_device_id.clone()
    };

    let tcp_client = file_transfer
        .tcp_client_ref()
        .ok_or("TCP client not initialized")?
        .clone();

    let (resolved_address, _) = resolve_reachable_tcp_endpoint(
        &tcp_client,
        discovery.inner(),
        &to_device_id,
        Some(&peer_address),
        None,
    )
    .await?;

    file_transfer
        .resume_transfer(&transfer_id, Some(resolved_address), app_handle)
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
/// On Android the writable app-scoped downloads dir is always returned.
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

    // Android: scoped storage — use app data dir / downloads (always writable)
    #[cfg(target_os = "android")]
    {
        let dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?
            .join("downloads");
        let _ = std::fs::create_dir_all(&dir);
        return Ok(dir.to_string_lossy().to_string());
    }

    // Desktop: fall back to system Downloads directory
    #[cfg(not(target_os = "android"))]
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
/// On Android, content:// URIs cannot be used with std::fs, so the
/// app-scoped downloads directory is always used regardless of the path arg.
#[tauri::command]
pub async fn set_download_dir(
    download_dir: State<'_, DownloadDir>,
    app_handle: AppHandle,
    path: String,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    let path = {
        // Ignore content:// URI — resolve to the writable app downloads dir
        let _ = path;
        let dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?
            .join("downloads");
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create downloads dir: {}", e))?;
        dir.to_string_lossy().to_string()
    };

    #[cfg(not(target_os = "android"))]
    let _ = app_handle;

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
    // Clear FTS5 search indexes
    if let Err(e) = db::search::clear_fts_indexes(messaging.db_pool()).await {
        eprintln!("⚠️  Failed to clear FTS indexes: {}", e);
    }
    println!("✓ All application data cleared via IPC");
    Ok(())
}

// ============================================================================
// Full-Text Search Commands (Feature #18)
// ============================================================================

/// Search across all content types (messages, group messages, file transfers).
///
/// Returns a unified `SearchResponse` with results sorted by FTS5 relevance.
/// Each result carries a `kind` discriminant so the frontend can render the
/// appropriate UI for messages vs files.
///
/// `limit` controls per-category cap (default 20, max 100).
#[tauri::command]
pub async fn search_all(
    messaging: State<'_, MessagingService>,
    query: String,
    limit: Option<u32>,
) -> Result<SearchResponse, String> {
    let pool = messaging.db_pool();
    let limit = limit.unwrap_or(20).min(100);
    db::search::search_all(pool, &query, limit)
        .await
        .map_err(|e| format!("Search failed: {}", e))
}

/// Search only direct messages.
///
/// Optionally scoped to a single conversation via `conversation_key`.
#[tauri::command]
pub async fn search_messages_cmd(
    messaging: State<'_, MessagingService>,
    query: String,
    conversation_key: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<MessageSearchResult>, String> {
    let pool = messaging.db_pool();
    let limit = limit.unwrap_or(30).min(100);
    db::search::search_messages(pool, &query, conversation_key.as_deref(), limit)
        .await
        .map_err(|e| format!("Message search failed: {}", e))
}

/// Search only group messages.
///
/// Optionally scoped to a single group via `group_id`.
#[tauri::command]
pub async fn search_group_messages_cmd(
    messaging: State<'_, MessagingService>,
    query: String,
    group_id: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<GroupMessageSearchResult>, String> {
    let pool = messaging.db_pool();
    let limit = limit.unwrap_or(30).min(100);
    db::search::search_group_messages(pool, &query, group_id.as_deref(), limit)
        .await
        .map_err(|e| format!("Group message search failed: {}", e))
}

/// Search file transfers by filename.
#[tauri::command]
pub async fn search_files_cmd(
    messaging: State<'_, MessagingService>,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<FileSearchResult>, String> {
    let pool = messaging.db_pool();
    let limit = limit.unwrap_or(30).min(100);
    db::search::search_files(pool, &query, limit)
        .await
        .map_err(|e| format!("File search failed: {}", e))
}

/// Rebuild all FTS5 search indexes from scratch.
///
/// This is an expensive but idempotent operation.  Useful if the index
/// somehow gets out of sync (e.g. after a database restore).
#[tauri::command]
pub async fn rebuild_search_index(
    messaging: State<'_, MessagingService>,
) -> Result<(), String> {
    let pool = messaging.db_pool();
    db::search::rebuild_fts_indexes(pool)
        .await
        .map_err(|e| format!("Rebuild failed: {}", e))
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

// ============================================================================
// Secure Handshake / SAS Verification Commands
// ============================================================================

/// Initiate SAS (Short Authentication String) verification with a peer device.
///
/// 1. Ensures a TCP connection exists (ECDH handshake happens automatically).
/// 2. Derives a 6-digit verification code from the session's shared secret.
/// 3. Sends a `SasVerifyRequest` frame to the peer so they also show the code.
/// 4. Emits `verification-code-ready` to the local frontend with the code.
///
/// The user should compare this code with what the peer is displaying and
/// then call `confirm_verification` or `reject_verification`.
#[tauri::command]
pub async fn initiate_verification(
    verification_service: State<'_, VerificationService>,
    tcp_client: State<'_, Arc<TcpClient>>,
    discovery: State<'_, Arc<MdnsDiscoveryService>>,
    _tcp_port: State<'_, TcpPort>,
    device_id: String,
    app_handle: AppHandle,
) -> Result<String, String> {
    // Look up the peer's network address from discovery.
    let devices = discovery.get_devices().await;
    let device = devices
        .iter()
        .find(|d| d.id == device_id)
        .ok_or_else(|| format!("Device {} not found in discovery", device_id))?;

    let address = device
        .addresses
        .first()
        .ok_or_else(|| format!("Device {} has no addresses", device_id))?
        .clone();
    let port = device.port;
    let display_name = device.name.clone();

    // Ensure connection exists (this performs ECDH if needed).
    tcp_client
        .ensure_connected(&device_id, &address, port)
        .await
        .map_err(|e| format!("Failed to connect to {}: {}", device_id, e))?;

    // Get the session's shared secret.
    let shared_secret = tcp_client
        .get_session_shared_secret(&device_id)
        .await
        .ok_or_else(|| format!("No active session with {} — cannot derive verification code", device_id))?;

    // Derive the SAS verification code.
    let pv = verification_service.start_verification(&device_id, &display_name, &shared_secret)?;
    let code = pv.code.formatted();

    // Send SasVerifyRequest to the peer so they also show their code.
    if let Err(e) = tcp_client
        .send_sas_verify_request(&device_id, &address, port)
        .await
    {
        eprintln!("⚠️ Failed to send SAS verify request to {}: {}", device_id, e);
        // Continue anyway — the local user can still see their code.
    }

    // Emit event to local frontend.
    let _ = app_handle.emit(
        "verification-code-ready",
        serde_json::json!({
            "device_id": device_id,
            "display_name": display_name,
            "verification_code": code,
            "initiated_by_us": true,
        }),
    );

    Ok(code)
}

/// Confirm that the SAS verification code matches what the peer is showing.
///
/// If the remote side has already confirmed, the verification transitions to
/// `Verified` and a `handshake-verified` event is emitted. Otherwise it moves
/// to `LocalConfirmed` and waits for the remote `SasConfirm` frame.
///
/// Also sends a `SasConfirm` frame to the peer.
#[tauri::command]
pub async fn confirm_verification(
    verification_service: State<'_, VerificationService>,
    tcp_client: State<'_, Arc<TcpClient>>,
    discovery: State<'_, Arc<MdnsDiscoveryService>>,
    _tcp_port: State<'_, TcpPort>,
    device_id: String,
    app_handle: AppHandle,
) -> Result<String, String> {
    // Get the verification code before confirming.
    let code = verification_service
        .get_verification_code(&device_id)
        .unwrap_or_default();

    // Confirm locally.
    let new_state = verification_service.local_confirm(&device_id)?;

    // Send SasConfirm frame to the peer.
    let devices = discovery.get_devices().await;
    if let Some(device) = devices.iter().find(|d| d.id == device_id) {
        if let Some(address) = device.addresses.first() {
            if let Err(e) = tcp_client
                .send_sas_confirm(&device_id, address, device.port, &code)
                .await
            {
                eprintln!("⚠️ Failed to send SAS confirm to {}: {}", device_id, e);
            }
        }
    }

    // If both sides have now confirmed, emit verified event.
    if new_state.is_verified() {
        let _ = app_handle.emit(
            "handshake-verified",
            serde_json::json!({
                "device_id": device_id,
                "display_name": "",
                "verification_code": code,
            }),
        );
    }

    // Return the serialized state name.
    let state_str = serde_json::to_string(&new_state)
        .unwrap_or_else(|_| "\"unknown\"".to_string());
    Ok(state_str)
}

/// Reject the SAS verification code (it does not match what the peer shows).
///
/// Sends a `SasReject` frame to the peer and emits `handshake-rejected`.
#[tauri::command]
pub async fn reject_verification(
    verification_service: State<'_, VerificationService>,
    tcp_client: State<'_, Arc<TcpClient>>,
    discovery: State<'_, Arc<MdnsDiscoveryService>>,
    _tcp_port: State<'_, TcpPort>,
    device_id: String,
    reason: Option<String>,
    app_handle: AppHandle,
) -> Result<(), String> {
    verification_service.local_reject(&device_id, reason.clone())?;

    // Send SasReject frame to the peer.
    let devices = discovery.get_devices().await;
    if let Some(device) = devices.iter().find(|d| d.id == device_id) {
        if let Some(address) = device.addresses.first() {
            if let Err(e) = tcp_client
                .send_sas_reject(&device_id, address, device.port, reason.clone())
                .await
            {
                eprintln!("⚠️ Failed to send SAS reject to {}: {}", device_id, e);
            }
        }
    }

    let _ = app_handle.emit(
        "handshake-rejected",
        serde_json::json!({
            "device_id": device_id,
            "display_name": "",
            "rejected_by": "local",
            "reason": reason,
        }),
    );

    Ok(())
}

/// Get the current SAS verification status for a specific peer device.
#[tauri::command]
pub fn get_verification_status(
    verification_service: State<'_, VerificationService>,
    device_id: String,
) -> VerificationStatus {
    verification_service.get_status(&device_id)
}

/// Get the list of all device IDs that have been successfully SAS-verified.
#[tauri::command]
pub fn get_verified_devices(
    verification_service: State<'_, VerificationService>,
) -> Vec<String> {
    verification_service.verified_device_ids()
}

/// Revoke SAS verification for a peer device (user no longer trusts them).
#[tauri::command]
pub fn revoke_verification(
    verification_service: State<'_, VerificationService>,
    device_id: String,
) -> Result<(), String> {
    verification_service.revoke(&device_id);
    Ok(())
}

/// Get verification status summaries for all peers (verified + pending).
#[tauri::command]
pub fn get_all_verification_statuses(
    verification_service: State<'_, VerificationService>,
) -> Vec<VerificationStatus> {
    verification_service.get_all_statuses()
}

// ============================================================================
// Screen Share Commands
// ============================================================================

/// Start a screen share session by sending an offer to a remote device.
///
/// The broadcaster captures their screen and streams JPEG frames over UDP.
/// Signaling (offer/answer/stop) is done over the existing encrypted TCP channel.
///
/// Returns the session ID on success.
#[tauri::command]
pub async fn start_screen_share(
    screen_share: State<'_, ScreenShareService>,
    viewer_device_id: String,
    viewer_display_name: String,
    quality: Option<String>,
    display_index: Option<u32>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let quality_preset = match quality.as_deref() {
        Some("low") => StreamQuality::Low,
        Some("high") => StreamQuality::High,
        _ => StreamQuality::Medium,
    };

    screen_share
        .start_offer(
            viewer_device_id,
            viewer_display_name,
            quality_preset,
            display_index.unwrap_or(0),
            app_handle,
        )
        .await
}

/// Accept or reject an incoming screen share offer.
///
/// Called by the viewer in response to a `screen-share-offer` event.
#[tauri::command]
pub async fn answer_screen_share(
    screen_share: State<'_, ScreenShareService>,
    session_id: String,
    accepted: bool,
    app_handle: AppHandle,
) -> Result<(), String> {
    screen_share
        .answer_offer(session_id, accepted, app_handle)
        .await
}

/// Stop an active screen share session.
///
/// Can be called by either the broadcaster or the viewer.
/// Sends a stop signal to the remote peer and cleans up local state.
#[tauri::command]
pub async fn stop_screen_share(
    screen_share: State<'_, ScreenShareService>,
    session_id: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    screen_share.stop_session(session_id, app_handle).await
}

/// Get all active screen share sessions.
#[tauri::command]
pub async fn get_screen_share_sessions(
    screen_share: State<'_, ScreenShareService>,
) -> Result<Vec<ScreenShareSession>, String> {
    Ok(screen_share.get_sessions().await)
}

// ============================================================================
// Mesh Routing Commands
// ============================================================================

/// Get the full mesh routing table.
///
/// Returns all known routes (direct peers + relayed multi-hop destinations).
/// Each route includes the next-hop device ID, hop count, and whether it is
/// a direct connection or a relayed route through intermediate devices.
#[tauri::command]
pub async fn get_mesh_routes(
    mesh: State<'_, MeshRouter>,
) -> Result<Vec<MeshRoute>, String> {
    Ok(mesh.get_routing_table().await)
}

/// Get the route to a specific destination device.
///
/// Returns the next-hop device ID if a route exists, or `null` if the
/// destination is unreachable via the mesh.
#[tauri::command]
pub async fn get_mesh_route_to(
    mesh: State<'_, MeshRouter>,
    device_id: String,
) -> Result<Option<String>, String> {
    Ok(mesh.get_next_hop(&device_id).await)
}

/// Enable or disable mesh routing.
///
/// When disabled, only directly connected peers are reachable.
/// Relayed routes are cleared and topology announcements stop.
#[tauri::command]
pub async fn set_mesh_enabled(
    mesh: State<'_, MeshRouter>,
    enabled: bool,
    app_handle: AppHandle,
) -> Result<(), String> {
    mesh.set_enabled(enabled, &app_handle).await;
    Ok(())
}

/// Check whether mesh routing is currently enabled.
#[tauri::command]
pub async fn get_mesh_enabled(
    mesh: State<'_, MeshRouter>,
) -> Result<bool, String> {
    Ok(mesh.is_enabled().await)
}

/// Get the total number of messages this device has relayed for other peers.
#[tauri::command]
pub async fn get_mesh_relay_count(
    mesh: State<'_, MeshRouter>,
) -> Result<u64, String> {
    Ok(mesh.relay_count().await)
}

// ============================================================================
// AI Commands (Google Gemini Integration)
// ============================================================================

/// Set the Gemini API key. The key is passed from the frontend (which reads
/// it from `tauri-plugin-store`) and stored only in memory on the Rust side.
#[tauri::command]
pub async fn ai_set_api_key(
    ai: State<'_, AiService>,
    api_key: String,
) -> Result<(), String> {
    ai.set_api_key(api_key).await;
    Ok(())
}

/// Clear the stored Gemini API key.
#[tauri::command]
pub async fn ai_clear_api_key(
    ai: State<'_, AiService>,
) -> Result<(), String> {
    ai.clear_api_key().await;
    Ok(())
}

/// Change the Gemini model to use.
#[tauri::command]
pub async fn ai_set_model(
    ai: State<'_, AiService>,
    model: AiModel,
) -> Result<(), String> {
    ai.set_model(model).await;
    Ok(())
}

/// Get the current AI service status (ready, model, token usage, etc.).
#[tauri::command]
pub async fn ai_get_status(
    ai: State<'_, AiService>,
) -> Result<AiStatus, String> {
    Ok(ai.get_status().await)
}

/// Summarize a direct or group conversation using Gemini.
#[tauri::command]
pub async fn ai_summarize_chat(
    ai: State<'_, AiService>,
    identity: State<'_, std::sync::Mutex<IdentityManager>>,
    app_handle: AppHandle,
    conversation_id: String,
    is_group: bool,
    message_limit: Option<u32>,
) -> Result<SummarizeResponse, String> {
    let local_device_id = {
        let mgr = identity.lock().map_err(|e| e.to_string())?;
        mgr.device_id().to_string()
    };

    let req = SummarizeRequest {
        conversation_id,
        is_group,
        message_limit,
    };

    ai.summarize_chat(&req, &local_device_id, Some(&app_handle))
        .await
        .map_err(|e| e.to_string())
}

/// Generate smart reply suggestions for a conversation.
#[tauri::command]
pub async fn ai_smart_reply(
    ai: State<'_, AiService>,
    identity: State<'_, std::sync::Mutex<IdentityManager>>,
    app_handle: AppHandle,
    conversation_id: String,
    is_group: bool,
    count: Option<u32>,
) -> Result<SmartReplyResponse, String> {
    let local_device_id = {
        let mgr = identity.lock().map_err(|e| e.to_string())?;
        mgr.device_id().to_string()
    };

    let req = SmartReplyRequest {
        conversation_id,
        is_group,
        count,
    };

    ai.smart_reply(&req, &local_device_id, Some(&app_handle))
        .await
        .map_err(|e| e.to_string())
}

/// Ask the AI assistant a free-form question, optionally with conversation context.
#[tauri::command]
pub async fn ai_ask(
    ai: State<'_, AiService>,
    identity: State<'_, std::sync::Mutex<IdentityManager>>,
    app_handle: AppHandle,
    prompt: String,
    context_conversation_id: Option<String>,
    context_is_group: Option<bool>,
) -> Result<AskResponse, String> {
    let local_device_id = {
        let mgr = identity.lock().map_err(|e| e.to_string())?;
        mgr.device_id().to_string()
    };

    let req = AskRequest {
        prompt,
        context_conversation_id,
        context_is_group,
    };

    ai.ask(&req, &local_device_id, Some(&app_handle))
        .await
        .map_err(|e| e.to_string())
}

/// Perform an AI-powered semantic search across all messages.
#[tauri::command]
pub async fn ai_smart_search(
    ai: State<'_, AiService>,
    identity: State<'_, std::sync::Mutex<IdentityManager>>,
    app_handle: AppHandle,
    query: String,
    limit: Option<u32>,
) -> Result<SmartSearchResponse, String> {
    let local_device_id = {
        let mgr = identity.lock().map_err(|e| e.to_string())?;
        mgr.device_id().to_string()
    };

    let req = SmartSearchRequest { query, limit };

    ai.smart_search(&req, &local_device_id, Some(&app_handle))
        .await
        .map_err(|e| e.to_string())
}

/// Analyze the tone, topics, and sentiment of a conversation.
#[tauri::command]
pub async fn ai_analyze_chat(
    ai: State<'_, AiService>,
    identity: State<'_, std::sync::Mutex<IdentityManager>>,
    app_handle: AppHandle,
    conversation_id: String,
    is_group: bool,
) -> Result<AnalyzeResponse, String> {
    let local_device_id = {
        let mgr = identity.lock().map_err(|e| e.to_string())?;
        mgr.device_id().to_string()
    };

    let req = AnalyzeRequest {
        conversation_id,
        is_group,
    };

    ai.analyze_chat(&req, &local_device_id, Some(&app_handle))
        .await
        .map_err(|e| e.to_string())
}

/// Get the AI assistant conversation history (in-memory, current session).
#[tauri::command]
pub async fn ai_get_conversation_history(
    ai: State<'_, AiService>,
) -> Result<Vec<AiChatMessage>, String> {
    Ok(ai.get_conversation_history().await)
}

/// Clear the AI assistant conversation history.
#[tauri::command]
pub async fn ai_clear_conversation_history(
    ai: State<'_, AiService>,
) -> Result<(), String> {
    ai.clear_conversation_history().await;
    Ok(())
}
