# Hyper Connect - Implementation Status & Code Guide

## ✅ Completed Modules

### 1. Identity Module ✓

**Status**: Fully implemented in `src-tauri/src/identity/`

**Files Created**:
- ✅ `identity/mod.rs` - Module exports
- ✅ `identity/manager.rs` - Complete device identity management

**Key Features**:
- Persistent UUID generation
- Display name management
- Platform detection
- Config persistence to disk

**Usage**:
```rust
let identity_manager = IdentityManager::new(app_data_dir, "1.0.0".to_string())?;
println!("Device ID: {}", identity_manager.device_id());
identity_manager.update_display_name("My Device".to_string())?;
```

---

### 2. Network Protocol ✓

**Status**: Fully implemented in `src-tauri/src/network/protocol.rs`

**Key Optimizations**:
- Binary frame format (5-byte header)
- FILE_DATA uses compact binary header + raw bytes
- No JSON overhead for file chunks
- Maximum payload size protection (100MB)

**Frame Structure**:
```
[4 bytes] Length (u32, big-endian)
[1 byte]  Message Type
[N bytes] Payload
```

**File Data Header** (for FILE_DATA messages):
```
[1 byte]  Transfer ID length
[N bytes] Transfer ID
[8 bytes] Offset (u64, big-endian)
[4 bytes] Chunk size (u32, big-endian)
[N bytes] Raw file data
```

**Message Types**:
- `0x01` HELLO
- `0x02` TEXT_MESSAGE
- `0x03` FILE_REQUEST
- `0x04` FILE_DATA (binary optimized)
- `0x05` FILE_ACK
- `0x06` FILE_COMPLETE
- `0x07` FILE_CANCEL
- `0x08` FILE_REJECT
- `0x09` HEARTBEAT
- `0x0A` ERROR

---

### 3. TCP Client ✓

**Status**: Fully implemented in `src-tauri/src/network/client.rs`

**Key Features**:
- Connection pooling (HashMap of connections)
- Socket optimization (TCP_NODELAY, 4MB buffers, keepalive)
- Automatic reconnection
- 5-second connection timeout
- 256KB buffered writer per connection

**Socket Optimizations Applied**:
```rust
stream.set_nodelay(true)?;                    // Disable Nagle
stream.set_send_buffer_size(4 * 1024 * 1024)?; // 4MB send buffer
stream.set_recv_buffer_size(4 * 1024 * 1024)?; // 4MB recv buffer
```

**Usage**:
```rust
let client = TcpClient::new();
client.send_text_message(device_id, address, port, payload).await?;
client.send_file_data(device_id, address, port, data).await?;
```

---

### 4. File Transfer Service ✓

**Status**: Fully implemented in `src-tauri/src/network/file_transfer.rs`

**High-Performance Features**:
- ✅ 256KB chunk size (configurable via `CHUNK_SIZE` const)
- ✅ Zero-copy streaming with `tokio::fs::File`
- ✅ SHA-256 checksum calculation
- ✅ Parallel transfer support (max 3 concurrent)
- ✅ Real-time metrics (speed, progress, ETA)
- ✅ Accept/Reject incoming transfers
- ✅ Pause/Resume/Cancel support

**Transfer Flow**:
```
1. create_transfer() → FileTransfer
2. start_transfer() → Spawn async task
3. Loop:
   - Read 256KB chunk from file
   - Create FileDataHeader
   - Combine header + data
   - Send via TCP client
   - Update progress
   - Emit event
4. send_file_complete() → Verify checksum
```

**Metrics Calculated**:
```rust
transfer.speed_bps = (transferred / elapsed_ms) * 1000.0;
transfer.eta_seconds = remaining / speed_bps;
transfer.progress = (transferred / size) * 100.0;
```

---

### 5. TCP Server ✓

**Status**: Fully implemented in `src-tauri/src/network/server.rs`

**Key Features**:
- Async connection handling with Tokio
- Socket optimization (same as client)
- 256KB buffered reader
- Frame decoding and routing
- Connection timeout detection (2 minutes)
- Event emission to frontend

**Handler Methods**:
- `handle_hello()` - HELLO handshake
- `handle_text_message()` - Chat messages
- `handle_file_request()` - File transfer requests
- `handle_file_data()` - File data chunks
- `handle_file_complete()` - Transfer completion
- `handle_file_cancel()` - Cancellation
- `handle_file_reject()` - Rejection
- `handle_heartbeat()` - Keep-alive

---

### 6. Network Module ✓

**Status**: Module structure complete in `src-tauri/src/network/mod.rs`

**Exports**:
```rust
pub use client::TcpClient;
pub use file_transfer::{FileTransfer, FileTransferService, TransferStatus};
pub use protocol::{Frame, MessageType, HelloPayload, TextMessagePayload, ...};
pub use server::TcpServer;
```

---

## 🚧 Pending Modules

### 7. Discovery Module (mDNS) ⏳

**Status**: Needs to be created

**File**: `src-tauri/src/discovery/mdns.rs`

**Implementation**:
```rust
// File: src-tauri/src/discovery/mdns.rs

use crate::identity::DeviceIdentity;
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;

const SERVICE_TYPE: &str = "_hyperconnect._tcp.local.";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub hostname: String,
    pub port: u16,
    pub addresses: Vec<String>,
    pub last_seen: i64,
    pub platform: String,
    pub app_version: String,
}

pub struct MdnsDiscoveryService {
    mdns: Arc<ServiceDaemon>,
    devices: Arc<RwLock<HashMap<String, Device>>>,
    local_identity: DeviceIdentity,
}

impl MdnsDiscoveryService {
    pub fn new(local_identity: DeviceIdentity) -> Result<Self, String> {
        let mdns = ServiceDaemon::new()
            .map_err(|e| format!("Failed to create mDNS daemon: {}", e))?;

        Ok(Self {
            mdns: Arc::new(mdns),
            devices: Arc::new(RwLock::new(HashMap::new())),
            local_identity,
        })
    }

    pub fn start_advertising(&self, port: u16) -> Result<(), String> {
        let mut properties = HashMap::new();
        properties.insert("deviceId".to_string(), self.local_identity.device_id.clone());
        properties.insert("displayName".to_string(), self.local_identity.display_name.clone());
        properties.insert("platform".to_string(), self.local_identity.platform.clone());
        properties.insert("appVersion".to_string(), self.local_identity.app_version.clone());

        let addresses: Vec<IpAddr> = if_addrs::get_if_addrs()
            .unwrap_or_default()
            .into_iter()
            .filter(|iface| !iface.is_loopback())
            .map(|iface| iface.addr.ip())
            .collect();

        let hostname = format!(
            "{}.local.",
            self.local_identity.display_name
                .to_lowercase()
                .replace(" ", "-")
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '-')
                .collect::<String>()
        );

        let service_info = ServiceInfo::new(
            SERVICE_TYPE,
            &self.local_identity.display_name,
            &hostname,
            &addresses[..],
            port,
            Some(properties),
        )
        .map_err(|e| format!("Failed to create service info: {}", e))?;

        self.mdns.register(service_info)
            .map_err(|e| format!("Failed to register: {}", e))?;

        println!("✓ Advertising as '{}' on port {}", self.local_identity.display_name, port);
        Ok(())
    }

    pub fn start_discovery(&self, app_handle: AppHandle) -> Result<(), String> {
        let receiver = self.mdns.browse(SERVICE_TYPE)
            .map_err(|e| format!("Failed to browse: {}", e))?;

        let devices = Arc::clone(&self.devices);
        let local_id = self.local_identity.device_id.clone();

        tokio::spawn(async move {
            while let Ok(event) = receiver.recv() {
                match event {
                    ServiceEvent::ServiceResolved(info) => {
                        let id = info.get_property_val_str("deviceId")
                            .unwrap_or_else(|| info.get_fullname())
                            .to_string();

                        if id == local_id {
                            continue; // Skip self
                        }

                        let mut addresses: Vec<String> = info.get_addresses()
                            .iter()
                            .filter(|addr| match addr {
                                IpAddr::V6(ipv6) => {
                                    let segments = ipv6.segments();
                                    !(segments[0] >= 0xfe80 && segments[0] <= 0xfebf)
                                }
                                IpAddr::V4(_) => true,
                            })
                            .map(|addr| addr.to_string())
                            .collect();

                        addresses.sort_by(|a, b| {
                            let a_is_v4 = !a.contains(':');
                            let b_is_v4 = !b.contains(':');
                            b_is_v4.cmp(&a_is_v4)
                        });

                        if addresses.is_empty() {
                            continue;
                        }

                        let device = Device {
                            id: id.clone(),
                            name: info.get_property_val_str("displayName")
                                .unwrap_or_else(|| info.get_fullname())
                                .to_string(),
                            hostname: info.get_hostname().to_string(),
                            port: info.get_port(),
                            addresses: addresses.clone(),
                            last_seen: chrono::Utc::now().timestamp(),
                            platform: info.get_property_val_str("platform")
                                .unwrap_or("unknown")
                                .to_string(),
                            app_version: info.get_property_val_str("appVersion")
                                .unwrap_or("unknown")
                                .to_string(),
                        };

                        println!("✓ Discovered: {} at {}:{}", device.name, addresses[0], device.port);

                        let mut devices_lock = devices.write().await;
                        devices_lock.insert(id.clone(), device.clone());
                        drop(devices_lock);

                        let _ = app_handle.emit("device-discovered", device);
                    }
                    ServiceEvent::ServiceRemoved(_, fullname) => {
                        let mut devices_lock = devices.write().await;
                        if let Some((id, _)) = devices_lock.iter()
                            .find(|(_, d)| d.name == fullname) {
                            let id = id.clone();
                            devices_lock.remove(&id);
                            println!("✓ Device removed: {}", fullname);
                            let _ = app_handle.emit("device-removed", id);
                        }
                    }
                    _ => {}
                }
            }
        });

        println!("✓ Started mDNS discovery");
        Ok(())
    }

    pub async fn get_devices(&self) -> Vec<Device> {
        let devices = self.devices.read().await;
        devices.values().cloned().collect()
    }
}
```

**Module File** (`src-tauri/src/discovery/mod.rs`):
```rust
pub mod mdns;
pub use mdns::{Device, MdnsDiscoveryService};
```

---

### 8. Messaging Service ⏳

**Status**: Needs refactoring

**File**: `src-tauri/src/messaging/service.rs`

**Implementation**:
```rust
// File: src-tauri/src/messaging/service.rs

use crate::network::{TcpClient, TextMessagePayload, serialize_json};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageType {
    Text { content: String },
    Emoji { emoji: String },
    Reply { content: String, reply_to: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub from_device_id: String,
    pub to_device_id: String,
    pub message_type: MessageType,
    pub timestamp: i64,
    pub thread_id: Option<String>,
    pub read: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Thread {
    pub id: String,
    pub participants: Vec<String>,
    pub last_message_timestamp: i64,
    pub unread_count: u32,
}

pub struct MessagingService {
    messages: Arc<RwLock<HashMap<String, Vec<Message>>>>,
    threads: Arc<RwLock<HashMap<String, Thread>>>,
    tcp_client: Option<Arc<TcpClient>>,
    tcp_port: u16,
}

impl MessagingService {
    pub fn new() -> Self {
        Self {
            messages: Arc::new(RwLock::new(HashMap::new())),
            threads: Arc::new(RwLock::new(HashMap::new())),
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

    pub async fn send_message(
        &self,
        from_device_id: String,
        to_device_id: String,
        message_type: MessageType,
        peer_address: String,
        app_handle: AppHandle,
    ) -> Result<Message, String> {
        let message = Message {
            id: Uuid::new_v4().to_string(),
            from_device_id: from_device_id.clone(),
            to_device_id: to_device_id.clone(),
            message_type: message_type.clone(),
            timestamp: chrono::Utc::now().timestamp(),
            thread_id: None,
            read: false,
        };

        // Store locally
        let conversation_key = Self::get_conversation_key(&from_device_id, &to_device_id);
        {
            let mut messages = self.messages.write().await;
            messages.entry(conversation_key.clone())
                .or_insert_with(Vec::new)
                .push(message.clone());
        }

        // Update thread
        {
            let mut threads = self.threads.write().await;
            threads.entry(conversation_key)
                .and_modify(|t| t.last_message_timestamp = message.timestamp)
                .or_insert_with(|| Thread {
                    id: Uuid::new_v4().to_string(),
                    participants: vec![from_device_id.clone(), to_device_id.clone()],
                    last_message_timestamp: message.timestamp,
                    unread_count: 0,
                });
        }

        // Send over network
        if let Some(client) = &self.tcp_client {
            let content = match &message_type {
                MessageType::Text { content } => content.clone(),
                MessageType::Emoji { emoji } => emoji.clone(),
                MessageType::Reply { content, .. } => content.clone(),
            };

            let payload = TextMessagePayload {
                id: message.id.clone(),
                from_device_id: from_device_id.clone(),
                to_device_id: to_device_id.clone(),
                content,
                timestamp: message.timestamp,
                thread_id: None,
            };

            let payload_bytes = serialize_json(&payload)?;
            client.send_text_message(&to_device_id, &peer_address, self.tcp_port, payload_bytes).await?;
        }

        let _ = app_handle.emit("message-sent", &message);
        Ok(message)
    }

    pub async fn receive_message(&self, payload: TextMessagePayload, app_handle: AppHandle) -> Result<(), String> {
        let message = Message {
            id: payload.id,
            from_device_id: payload.from_device_id.clone(),
            to_device_id: payload.to_device_id.clone(),
            message_type: MessageType::Text { content: payload.content },
            timestamp: payload.timestamp,
            thread_id: payload.thread_id,
            read: false,
        };

        let conversation_key = Self::get_conversation_key(&message.from_device_id, &message.to_device_id);
        {
            let mut messages = self.messages.write().await;
            messages.entry(conversation_key.clone())
                .or_insert_with(Vec::new)
                .push(message.clone());
        }

        {
            let mut threads = self.threads.write().await;
            threads.entry(conversation_key)
                .and_modify(|t| {
                    t.last_message_timestamp = message.timestamp;
                    t.unread_count += 1;
                });
        }

        let _ = app_handle.emit("message-received", message);
        Ok(())
    }

    pub async fn get_messages(&self, device1: &str, device2: &str) -> Vec<Message> {
        let key = Self::get_conversation_key(device1, device2);
        let messages = self.messages.read().await;
        messages.get(&key).cloned().unwrap_or_default()
    }

    pub async fn get_threads(&self) -> Vec<Thread> {
        let threads = self.threads.read().await;
        let mut list: Vec<Thread> = threads.values().cloned().collect();
        list.sort_by(|a, b| b.last_message_timestamp.cmp(&a.last_message_timestamp));
        list
    }

    fn get_conversation_key(device1: &str, device2: &str) -> String {
        let mut participants = vec![device1, device2];
        participants.sort();
        participants.join("_")
    }
}

impl Clone for MessagingService {
    fn clone(&self) -> Self {
        Self {
            messages: Arc::clone(&self.messages),
            threads: Arc::clone(&self.threads),
            tcp_client: self.tcp_client.clone(),
            tcp_port: self.tcp_port,
        }
    }
}
```

**Module File** (`src-tauri/src/messaging/mod.rs`):
```rust
pub mod service;
pub use service::{Message, MessageType, MessagingService, Thread};
```

---

### 9. IPC Commands ⏳

**Status**: Needs to be created

**File**: `src-tauri/src/ipc/commands.rs`

**Implementation**:
```rust
// File: src-tauri/src/ipc/commands.rs

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
    mut identity: State<IdentityManager>,
    name: String,
) -> Result<(), String> {
    identity.update_display_name(name)
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
pub async fn get_devices(discovery: State<'_, MdnsDiscoveryService>) -> Result<Vec<Device>, String> {
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
    messaging.send_message(from_device_id, to_device_id, message_type, peer_address, app_handle).await
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
    file_transfer.create_transfer(filename, file_path, from_device_id, to_device_id).await
}

#[tauri::command]
pub async fn start_transfer(
    file_transfer: State<'_, FileTransferService>,
    transfer_id: String,
    peer_address: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    file_transfer.start_transfer(&transfer_id, Some(peer_address), app_handle).await
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
pub async fn get_transfers(file_transfer: State<'_, FileTransferService>) -> Result<Vec<FileTransfer>, String> {
    Ok(file_transfer.get_transfers().await)
}

#[tauri::command]
pub fn get_tcp_port() -> u16 {
    8080 // Or from config
}
```

**Module File** (`src-tauri/src/ipc/mod.rs`):
```rust
pub mod commands;
pub use commands::*;
```

---

### 10. Main Entry Point (lib.rs) ⏳

**Status**: Needs complete refactoring

**File**: `src-tauri/src/lib.rs`

**Implementation**:
```rust
// File: src-tauri/src/lib.rs

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

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .setup(|app| {
            // Get app data directory
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data directory");

            // Get app version
            let app_version = app.package_info().version.to_string();

            // Initialize identity manager
            let identity_manager = IdentityManager::new(app_data_dir.clone(), app_version.clone())
                .expect("Failed to create identity manager");

            println!("✓ Identity: {} ({})", 
                identity_manager.display_name(), 
                identity_manager.device_id()
            );

            // Initialize discovery service
            let discovery_service = MdnsDiscoveryService::new(identity_manager.identity().clone())
                .expect("Failed to create discovery service");

            // Initialize TCP client
            let tcp_client = Arc::new(TcpClient::new());

            // Initialize messaging service
            let mut messaging_service = MessagingService::new();
            messaging_service.set_tcp_client(Arc::clone(&tcp_client));
            messaging_service.set_tcp_port(8080);

            // Initialize file transfer service
            let mut file_transfer_service = FileTransferService::new(app_data_dir);
            file_transfer_service.set_tcp_client(Arc::clone(&tcp_client));
            file_transfer_service.set_tcp_port(8080);

            // Initialize TCP server
            let tcp_server = TcpServer::new(
                Arc::new(Mutex::new(file_transfer_service.clone())),
                identity_manager.device_id().to_string(),
            );

            // Start TCP server
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = tcp_server.start(8080, app_handle).await {
                    eprintln!("Failed to start TCP server: {}", e);
                }
            });

            // Store services in app state
            app.manage(identity_manager);
            app.manage(discovery_service);
            app.manage(messaging_service);
            app.manage(file_transfer_service);
            app.manage(tcp_client);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Identity
            ipc::get_device_info,
            ipc::update_display_name,
            // Discovery
            ipc::start_discovery,
            ipc::start_advertising,
            ipc::get_devices,
            ipc::get_local_device_id,
            // Messaging
            ipc::send_message,
            ipc::get_messages,
            ipc::get_threads,
            // File Transfer
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
```

---

## 📋 Implementation Checklist

### Backend (Rust)

- [x] Identity module (manager.rs) - DONE
- [x] Network protocol (protocol.rs) - DONE
- [x] TCP client (client.rs) - DONE
- [x] File transfer service (file_transfer.rs) - DONE
- [x] TCP server (server.rs) - DONE
- [x] Network module exports (mod.rs) - DONE
- [ ] Discovery module (mdns.rs) - **CREATE FILE**
- [ ] Discovery module exports (discovery/mod.rs) - **CREATE FILE**
- [ ] Messaging service (service.rs) - **CREATE FILE**
- [ ] Messaging module exports (messaging/mod.rs) - **CREATE FILE**
- [ ] IPC commands (commands.rs) - **CREATE FILE**
- [ ] IPC module exports (ipc/mod.rs) - **CREATE FILE**
- [ ] Refactor lib.rs - **UPDATE FILE**
- [ ] Remove old files (discovery.rs, tcp_client.rs, etc.) - **DELETE**

### Frontend (TypeScript/React)

- [ ] Update types (types/index.ts) - **UPDATE**
- [ ] Create use-discovery.ts hook - **CREATE**
- [ ] Create use-messaging.ts hook - **CREATE**
- [ ] Create use-transfers.ts hook - **CREATE**
- [ ] Update OnboardingPage.tsx - **UPDATE**
- [ ] Update ChatPage.tsx - **UPDATE**
- [ ] Create TransfersPage.tsx - **CREATE**
- [ ] Update routes.tsx - **UPDATE**

---

## 🔨 Quick Start Commands

### 1. Create Missing Files

```bash
cd src-tauri/src

# Create discovery module files
touch discovery/mdns.rs discovery/mod.rs

# Create messaging module files
touch messaging/service.rs messaging/mod.rs

# Create IPC module files
touch ipc/commands.rs ipc/mod.rs
```

### 2. Copy Implementation Code

Copy the code from the sections above into each respective file.

### 3. Update lib.rs

Replace `src-tauri/src/lib.rs` with the implementation provided in section 10.

### 4. Build and Test

```bash
cd src-tauri
cargo build --release
cargo test
```

### 5. Run Application

```bash
npm run tauri dev
```

---

## 🎯 Next Steps

1. **Create Discovery Module**: Copy code from section 7
2. **Create Messaging Service**: Copy code from section 8
3. **Create IPC Commands**: Copy code from section 9
4. **Update lib.rs**: Copy code from section 10
5. **Delete Old Files**: Remove deprecated modules
6. **Test**: Build and run application
7. **Frontend Integration**: Update React components to use new commands

---

## 📊 Performance Targets

- **LAN Speed**: 100+ MB/s on gigabit Ethernet
- **CPU Usage**: < 10% during transfers
- **Memory**: < 100MB total
- **Latency**: < 50ms message delivery
- **Discovery**: < 2 seconds to find peers

---

## 🔍 Testing Checklist

- [ ] Identity persists across restarts
- [ ] mDNS discovers devices on same network
- [ ] Messages send/receive correctly
- [ ] File transfers complete with correct checksums
- [ ] Multiple concurrent transfers work
- [ ] Cancel/pause/resume work correctly
- [ ] Socket optimizations applied (check with netstat)
- [ ] No memory leaks during long transfers

---

## 📝 Notes

- All socket buffers set to 4MB
- TCP_NODELAY enabled on all connections
- File chunks are 256KB
- Max 3 concurrent transfers
- SHA-256 checksums for verification
- Connection pooling for efficiency
- Binary protocol for file data (not JSON)