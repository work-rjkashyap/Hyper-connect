//! Hyper Connect - Main Application Entry Point
//!
//! High-performance LAN file and message transfer application built with Tauri 2.
//! Implements optimized TCP networking, mDNS discovery, and zero-copy file streaming.

mod crypto;
mod discovery;
mod identity;
mod ipc;
mod messaging;
mod network;

use discovery::MdnsDiscoveryService;
use identity::IdentityManager;
use messaging::MessagingService;
use network::{FileTransferService, TcpClient, TcpServer};
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

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
            println!("🚀 Starting Hyper Connect...");

            // Get app data directory
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            // Get app version
            let app_version = app.package_info().version.to_string();

            // Initialize identity manager
            let identity_manager = IdentityManager::new(app_data_dir.clone(), app_version.clone())
                .expect("Failed to create identity manager");

            println!(
                "✓ Identity: {} ({})",
                identity_manager.display_name(),
                identity_manager.device_id()
            );

            // Initialize discovery service (wrapped in Arc for sharing)
            let discovery_service = Arc::new(
                MdnsDiscoveryService::new(identity_manager.identity().clone())
                    .expect("Failed to create discovery service"),
            );

            // Get TCP port - use 8081 for iOS, 8080 for other platforms
            let tcp_port: u16 = std::env::var("TAURI_TCP_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or_else(|| {
                    #[cfg(target_os = "ios")]
                    {
                        8081 // iOS uses port 8081 to avoid conflicts
                    }
                    #[cfg(not(target_os = "ios"))]
                    {
                        8080 // Desktop/other platforms use port 8080
                    }
                });

            println!("✓ TCP port: {}", tcp_port);

            // Get identity for client initialization
            let identity = identity_manager.identity();

            // Initialize TCP client with encryption support
            let tcp_client = Arc::new(TcpClient::new(
                identity.device_id.clone(),
                identity.display_name.clone(),
                identity.platform.clone(),
                identity.app_version.clone(),
            ));

            // Initialize messaging service
            let mut messaging_service = MessagingService::new();
            messaging_service.set_tcp_client(Arc::clone(&tcp_client));
            messaging_service.set_tcp_port(tcp_port);

            // Initialize file transfer service
            let mut file_transfer_service = FileTransferService::new(app_data_dir);
            file_transfer_service.set_tcp_client(Arc::clone(&tcp_client));
            file_transfer_service.set_tcp_port(tcp_port);

            // Initialize TCP server with encryption support
            let tcp_server = TcpServer::new(
                Arc::new(Mutex::new(file_transfer_service.clone())),
                identity.device_id.clone(),
                identity.display_name.clone(),
                identity.platform.clone(),
                identity.app_version.clone(),
            );

            // Start TCP server
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = tcp_server.start(tcp_port, app_handle).await {
                    eprintln!("Failed to start TCP server: {}", e);
                } else {
                    println!("✓ TCP server started on port {}", tcp_port);
                }
            });

            // Store services in app state
            app.manage(identity_manager);
            app.manage(Arc::clone(&discovery_service));
            app.manage(messaging_service);
            app.manage(file_transfer_service);

            // Auto-start mDNS discovery and advertising
            let discovery_clone = Arc::clone(&discovery_service);
            let app_handle_clone = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Start discovery
                if let Err(e) = discovery_clone.start_discovery(app_handle_clone.clone()) {
                    eprintln!("Failed to start discovery: {}", e);
                } else {
                    println!("✓ mDNS discovery started");
                }

                // Start advertising
                if let Err(e) = discovery_clone.start_advertising(tcp_port) {
                    eprintln!("Failed to start advertising: {}", e);
                } else {
                    println!("✓ mDNS advertising started on port {}", tcp_port);
                }
            });

            println!("✓ Hyper Connect initialized successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Identity commands
            ipc::get_device_info,
            ipc::update_display_name,
            // Discovery commands
            ipc::start_discovery,
            ipc::start_advertising,
            ipc::get_devices,
            ipc::get_local_device_id,
            // Messaging commands
            ipc::send_message,
            ipc::get_messages,
            ipc::get_threads,
            ipc::mark_as_read,
            ipc::mark_thread_as_read,
            // File transfer commands
            ipc::create_transfer,
            ipc::start_transfer,
            ipc::accept_transfer,
            ipc::reject_transfer,
            ipc::pause_transfer,
            ipc::cancel_transfer,
            ipc::get_transfers,
            ipc::get_tcp_port,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
