//! Hyper Connect - Main Application Entry Point
//!
//! High-performance LAN file and message transfer application built with Tauri 2.
//! Implements optimized TCP networking, mDNS discovery, and zero-copy file streaming.

mod crypto;
mod db;
mod discovery;
mod identity;
mod ipc;
mod messaging;
mod network;

use crypto::tls::TlsConfig;
use discovery::MdnsDiscoveryService;
use identity::IdentityManager;
use ipc::{DownloadDir, TcpPort};
use messaging::{GroupService, MessagingService};
use network::{FileTransferService, TcpClient, TcpServer};
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init());

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

            // ── SQLite database ───────────────────────────────────────────────
            // Block on async DB init inside the sync setup closure.
            let db_pool = Arc::new(
                tauri::async_runtime::block_on(db::init_db(&app_data_dir))
                    .expect("Failed to initialise SQLite database"),
            );

            // ── Identity ──────────────────────────────────────────────────────
            let identity_manager = IdentityManager::new(app_data_dir.clone(), app_version.clone())
                .expect("Failed to create identity manager");

            println!(
                "✓ Identity: {} ({})",
                identity_manager.display_name(),
                identity_manager.device_id()
            );

            let identity = identity_manager.identity().clone();

            // ── Discovery ─────────────────────────────────────────────────────
            let discovery_service = Arc::new(
                MdnsDiscoveryService::new(identity.clone())
                    .expect("Failed to create discovery service"),
            );

            // ── TCP port ──────────────────────────────────────────────────────
            let tcp_port: u16 = std::env::var("TAURI_TCP_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or_else(|| {
                    #[cfg(target_os = "ios")]
                    {
                        8081
                    }
                    #[cfg(not(target_os = "ios"))]
                    {
                        8080
                    }
                });

            println!("✓ TCP port: {}", tcp_port);

            // ── TLS ───────────────────────────────────────────────────────────
            let tls_config =
                TlsConfig::new(&app_data_dir).expect("Failed to initialize TLS configuration");
            println!("✓ TLS configuration initialized");

            // ── TCP client ────────────────────────────────────────────────────
            let tcp_client = Arc::new(TcpClient::new(
                identity.device_id.clone(),
                identity.display_name.clone(),
                identity.platform.clone(),
                identity.app_version.clone(),
                tls_config.connector,
            ));

            // ── Services ──────────────────────────────────────────────────────
            let mut messaging_service = MessagingService::new(Arc::clone(&db_pool));
            messaging_service.set_tcp_client(Arc::clone(&tcp_client));
            messaging_service.set_tcp_port(tcp_port);

            let mut file_transfer_service =
                FileTransferService::new(app_data_dir.clone(), Arc::clone(&db_pool));
            file_transfer_service.set_tcp_client(Arc::clone(&tcp_client));
            file_transfer_service.set_tcp_port(tcp_port);

            let mut group_service = GroupService::new(Arc::clone(&db_pool));
            group_service.set_tcp_client(Arc::clone(&tcp_client));
            group_service.set_tcp_port(tcp_port);

            // ── TCP server ────────────────────────────────────────────────────
            let tcp_server = TcpServer::new(
                Arc::new(Mutex::new(file_transfer_service.clone())),
                identity.device_id.clone(),
                identity.display_name.clone(),
                identity.platform.clone(),
                identity.app_version.clone(),
                tls_config.acceptor,
            );

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = tcp_server.start(tcp_port, app_handle).await {
                    eprintln!("Failed to start TCP server: {}", e);
                } else {
                    println!("✓ TCP server started on port {}", tcp_port);
                }
            });

            // Load persisted transfers into the in-memory cache
            let fts_clone = file_transfer_service.clone();
            tauri::async_runtime::spawn(async move {
                fts_clone.load_from_db().await;
            });

            // ── App state ─────────────────────────────────────────────────────
            let identity_manager = std::sync::Mutex::new(identity_manager);

            app.manage(identity_manager);
            app.manage(Arc::clone(&discovery_service));
            app.manage(messaging_service);
            app.manage(file_transfer_service);
            app.manage(group_service);
            app.manage(TcpPort(tcp_port));
            app.manage(DownloadDir(tokio::sync::Mutex::new(None)));

            // ── Auto-start mDNS ───────────────────────────────────────────────
            let discovery_clone = Arc::clone(&discovery_service);
            let app_handle_clone = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = discovery_clone.start_discovery(app_handle_clone.clone()) {
                    eprintln!("Failed to start discovery: {}", e);
                } else {
                    println!("✓ mDNS discovery started");
                }

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
            ipc::mark_conversation_as_read,
            ipc::ping_device,
            // Offline message queue commands
            ipc::flush_message_queue,
            ipc::get_queued_count,
            // File transfer commands
            ipc::create_transfer,
            ipc::start_transfer,
            ipc::accept_transfer,
            ipc::reject_transfer,
            ipc::pause_transfer,
            ipc::cancel_transfer,
            ipc::get_transfers,
            ipc::resume_transfer,
            ipc::get_resumable_transfers,
            ipc::get_tcp_port,
            ipc::get_default_downloads_dir,
            ipc::set_download_dir,
            ipc::open_file_location,
            // App reset commands
            ipc::clear_all_data,
            // Group chat commands
            ipc::create_group,
            ipc::add_group_member,
            ipc::remove_group_member,
            ipc::leave_group,
            ipc::disband_group,
            ipc::send_group_message,
            ipc::get_groups,
            ipc::get_group_messages,
            ipc::get_group_members,
            ipc::rename_group,
            ipc::clear_group_history,
            ipc::get_group_info,
            ipc::get_group_summaries,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
