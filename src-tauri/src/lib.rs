mod discovery;
mod messaging;
mod file_transfer;
mod protocol;
mod tcp_client;
mod tcp_server;

use discovery::{Device, DiscoveryService};
use messaging::{Message, MessageType, MessagingService, Thread};
use file_transfer::{FileTransfer, FileTransferService};
use tcp_client::TcpClient;
use tcp_server::TcpServer;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};

struct AppState {
    discovery: Mutex<DiscoveryService>,
    messaging: Mutex<MessagingService>,
    file_transfer: Mutex<FileTransferService>,
    tcp_client: Arc<TcpClient>,
    tcp_port: u16,
}

// Discovery commands
#[tauri::command]
fn start_discovery(
    state: State<AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let discovery = state.discovery.lock().unwrap();
    discovery.start_discovery(app_handle)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn start_advertising(
    state: State<AppState>,
    device_name: String,
    port: u16,
    app_handle: AppHandle,
) -> Result<(), String> {
    let discovery = state.discovery.lock().unwrap();
    let app_version = app_handle.package_info().version.to_string();
    discovery.start_advertising(device_name, port, app_version)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_devices(state: State<AppState>) -> Vec<Device> {
    let discovery = state.discovery.lock().unwrap();
    discovery.get_devices()
}

#[tauri::command]
fn get_local_device_id(state: State<AppState>) -> String {
    let discovery = state.discovery.lock().unwrap();
    discovery.get_local_device_id()
}

#[tauri::command]
fn get_tcp_port(state: State<AppState>) -> u16 {
    state.tcp_port
}

// Messaging commands
#[tauri::command]
async fn send_message(
    state: State<'_, AppState>,
    from_device_id: String,
    to_device_id: String,
    message_type: MessageType,
    thread_id: Option<String>,
    peer_address: Option<String>,
    app_handle: AppHandle,
) -> Result<Message, String> {
    let messaging = state.messaging.lock()
        .map_err(|e| format!("Failed to lock messaging service: {}", e))?;

    let result = messaging.send_message(
        from_device_id,
        to_device_id,
        message_type,
        thread_id,
        peer_address,
        app_handle
    );

    result
}

#[tauri::command]
fn get_messages(
    state: State<AppState>,
    device1: String,
    device2: String,
) -> Vec<Message> {
    let messaging = state.messaging.lock().unwrap();
    messaging.get_messages(&device1, &device2)
}

#[tauri::command]
fn get_threads(state: State<AppState>) -> Vec<Thread> {
    let messaging = state.messaging.lock().unwrap();
    messaging.get_threads()
}

#[tauri::command]
fn mark_as_read(
    state: State<AppState>,
    message_id: String,
    conversation_key: String,
) -> Result<(), String> {
    let messaging = state.messaging.lock().unwrap();
    messaging.mark_as_read(&message_id, &conversation_key)
}

#[tauri::command]
fn mark_thread_as_read(
    state: State<AppState>,
    thread_id: String,
) -> Result<(), String> {
    let messaging = state.messaging.lock().unwrap();
    messaging.mark_thread_as_read(&thread_id)
}

// File transfer commands
#[tauri::command]
fn create_file_transfer(
    state: State<AppState>,
    filename: String,
    file_path: String,
    from_device_id: String,
    to_device_id: String,
) -> Result<FileTransfer, String> {
    let file_transfer = state.file_transfer.lock().unwrap();
    file_transfer.create_transfer(filename, file_path, from_device_id, to_device_id)
}

#[tauri::command]
fn start_file_transfer(
    state: State<AppState>,
    transfer_id: String,
    peer_address: Option<String>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let file_transfer = state.file_transfer.lock().unwrap();
    file_transfer.start_transfer(&transfer_id, peer_address, app_handle)
}

#[tauri::command]
fn pause_file_transfer(
    state: State<AppState>,
    transfer_id: String,
) -> Result<(), String> {
    let file_transfer = state.file_transfer.lock().unwrap();
    file_transfer.pause_transfer(&transfer_id)
}

#[tauri::command]
fn resume_file_transfer(
    state: State<AppState>,
    transfer_id: String,
    peer_address: Option<String>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let file_transfer = state.file_transfer.lock().unwrap();
    file_transfer.resume_transfer(&transfer_id, peer_address, app_handle)
}

#[tauri::command]
fn cancel_file_transfer(
    state: State<AppState>,
    transfer_id: String,
) -> Result<(), String> {
    let file_transfer = state.file_transfer.lock().unwrap();
    file_transfer.cancel_transfer(&transfer_id)
}

#[tauri::command]
fn get_file_transfers(state: State<AppState>) -> Vec<FileTransfer> {
    let file_transfer = state.file_transfer.lock().unwrap();
    file_transfer.get_transfers()
}

#[tauri::command]
fn get_file_transfer(
    state: State<AppState>,
    transfer_id: String,
) -> Option<FileTransfer> {
    let file_transfer = state.file_transfer.lock().unwrap();
    file_transfer.get_transfer(&transfer_id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build());

    // Only enable updater on desktop platforms (not on iOS/Android)
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .setup(|app| {
            let app_data_dir = app.path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            let discovery = DiscoveryService::new(app_data_dir.clone())
                .expect("Failed to create discovery service");

            // Create TCP client
            let tcp_client = Arc::new(TcpClient::new());

            // Get TCP port - use 8081 for iOS, 8080 for other platforms
            let tcp_port: u16 =  std::env::var("TAURI_TCP_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or_else(|| {
                    #[cfg(target_os = "ios")]
                    {
                        8081 // iOS uses port 8081 to avoid conflicts with desktop
                    }
                    #[cfg(not(target_os = "ios"))]
                    {
                        8080 // Desktop/other platforms use port 8080
                    }
                });

            println!("Using TCP port: {}", tcp_port);

            // Create messaging service and set TCP client
            let mut messaging = MessagingService::new();
            messaging.set_tcp_client(Arc::clone(&tcp_client));
            messaging.set_tcp_port(tcp_port);

            // Create file transfer service and set TCP client
            let mut file_transfer = FileTransferService::new(app_data_dir);
            file_transfer.set_tcp_client(Arc::clone(&tcp_client));
            file_transfer.set_tcp_port(tcp_port);

            // Create TCP server
            let mut tcp_server = TcpServer::new(
                Arc::new(tokio::sync::Mutex::new(messaging.clone())),
                Arc::new(tokio::sync::Mutex::new(file_transfer.clone())),
            );

            // Start TCP server
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = tcp_server.start(tcp_port, app_handle).await {
                    eprintln!("Failed to start TCP server: {}", e);
                }
            });

            app.manage(AppState {
                discovery: Mutex::new(discovery),
                messaging: Mutex::new(messaging),
                file_transfer: Mutex::new(file_transfer),
                tcp_client,
                tcp_port,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_discovery,
            start_advertising,
            get_devices,
            get_local_device_id,
            get_tcp_port,
            send_message,
            get_messages,
            get_threads,
            mark_as_read,
            mark_thread_as_read,
            create_file_transfer,
            start_file_transfer,
            pause_file_transfer,
            resume_file_transfer,
            cancel_file_transfer,
            get_file_transfers,
            get_file_transfer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
