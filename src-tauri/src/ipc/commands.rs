//! IPC Commands
//!
//! Tauri command handlers for frontend-backend communication.

use crate::discovery::{Device, MdnsDiscoveryService};
use crate::identity::{DeviceIdentity, IdentityManager};
use crate::messaging::{Message, MessageType, MessagingService, Thread};
use crate::network::{FileTransfer, FileTransferService};
use tauri::{AppHandle, State};

// ============================================================================
// Identity Commands
// ============================================================================

#[tauri::command]
pub fn get_device_info(identity: State<IdentityManager>) -> DeviceIdentity {
    identity.identity().clone()
}

#[tauri::command]
pub fn update_display_name(
    identity: State<IdentityManager>,
    name: String,
) -> Result<(), String> {
    // Note: IdentityManager needs to be wrapped in Arc<Mutex<>> for interior mutability
    // For now, returning an error - this needs refactoring in the state management
    Err("Display name update requires mutable state - to be implemented".to_string())
}

// ============================================================================
// Discovery Commands
// ============================================================================

#[tauri::command]
pub fn start_discovery(
    discovery: State<MdnsDiscoveryService>,
    app_handle: AppHandle,
) -> Result<(), String> {
    discovery.start_discovery(app_handle)
}

#[tauri::command]
pub fn start_advertising(
    discovery: State<MdnsDiscoveryService>,
    port: u16,
) -> Result<(), String> {
    discovery.start_advertising(port)
}

#[tauri::command]
pub async fn get_devices(
    discovery: State<'_, MdnsDiscoveryService>,
) -> Result<Vec<Device>, String> {
    Ok(discovery.get_devices().await)
}

#[tauri::command]
pub fn get_local_device_id(discovery: State<MdnsDiscoveryService>) -> String {
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
    app_handle: AppHandle,
) -> Result<Message, String> {
    let message_type = MessageType::Text { content };
    messaging
        .send_message(
            from_device_id,
            to_device_id,
            message_type,
            peer_address,
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
pub async fn get_threads(
    messaging: State<'_, MessagingService>,
) -> Result<Vec<Thread>, String> {
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
    transfer_id: String,
) -> Result<(), String> {
    file_transfer.accept_transfer(&transfer_id).await
}

#[tauri::command]
pub async fn reject_transfer(
    file_transfer: State<'_, FileTransferService>,
    transfer_id: String,
) -> Result<(), String> {
    file_transfer.reject_transfer(&transfer_id).await
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
pub fn get_tcp_port() -> u16 {
    8080
}
