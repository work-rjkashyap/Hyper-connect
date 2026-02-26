//! mDNS Discovery Service
//!
//! Handles device discovery on the local network using Multicast DNS (mDNS).
//! Advertises local device and discovers peers running the same application.

#![allow(dead_code)]

use crate::identity::DeviceIdentity;
use crate::mesh::MeshRouter;
use crate::messaging::GroupService;
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::RwLock;

/// mDNS service type for Hyper Connect
const SERVICE_TYPE: &str = "_hyperconnect._tcp.local.";

/// Discovered device information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    #[serde(rename = "device_id")]
    pub id: String,
    #[serde(rename = "display_name")]
    pub name: String,
    pub hostname: String,
    pub port: u16,
    pub addresses: Vec<String>,
    pub last_seen: i64,
    pub platform: String,
    pub app_version: String,
}

/// mDNS Discovery Service
pub struct MdnsDiscoveryService {
    mdns: Arc<ServiceDaemon>,
    devices: Arc<RwLock<HashMap<String, Device>>>,
    /// Maps mDNS full service name → device_id for correct removal
    fullname_to_id: Arc<RwLock<HashMap<String, String>>>,
    local_identity: DeviceIdentity,
    /// Guards against starting discovery more than once
    started_discovery: Arc<AtomicBool>,
    /// Guards against registering the mDNS service more than once
    started_advertising: Arc<AtomicBool>,
}

impl MdnsDiscoveryService {
    /// Create a new discovery service
    pub fn new(local_identity: DeviceIdentity) -> Result<Self, String> {
        let mdns =
            ServiceDaemon::new().map_err(|e| format!("Failed to create mDNS daemon: {}", e))?;

        Ok(Self {
            mdns: Arc::new(mdns),
            devices: Arc::new(RwLock::new(HashMap::new())),
            fullname_to_id: Arc::new(RwLock::new(HashMap::new())),
            local_identity,
            started_discovery: Arc::new(AtomicBool::new(false)),
            started_advertising: Arc::new(AtomicBool::new(false)),
        })
    }

    /// Start advertising this device on the local network.
    ///
    /// The call is idempotent – duplicate invocations are silently ignored so
    /// that the backend auto-start in `lib.rs` and any subsequent frontend IPC
    /// call do not fight each other or cause a double-registration error.
    pub fn start_advertising(&self, port: u16) -> Result<(), String> {
        // Atomically set the flag; if it was already true another caller got
        // here first – nothing to do.
        if self.started_advertising.swap(true, Ordering::SeqCst) {
            println!("⚠️  Advertising already running – ignoring duplicate start");
            return Ok(());
        }

        let result = self.do_start_advertising(port);

        // If registration failed reset the flag so a later retry can succeed.
        if result.is_err() {
            self.started_advertising.store(false, Ordering::SeqCst);
        }

        result
    }

    /// Inner helper that performs the actual mDNS registration.
    fn do_start_advertising(&self, port: u16) -> Result<(), String> {
        let mut properties = HashMap::new();
        properties.insert(
            "deviceId".to_string(),
            self.local_identity.device_id.clone(),
        );
        properties.insert(
            "displayName".to_string(),
            self.local_identity.display_name.clone(),
        );
        properties.insert("platform".to_string(), self.local_identity.platform.clone());
        // appVersion is intentionally omitted to minimise metadata exposure.

        // Collect non-loopback addresses, IPv4 first.
        let mut addresses: Vec<IpAddr> = if_addrs::get_if_addrs()
            .unwrap_or_default()
            .into_iter()
            .filter(|iface| !iface.is_loopback())
            .map(|iface| iface.addr.ip())
            .collect();

        // Sort IPv4 before IPv6 so the first entry is always the most
        // reachable address on a typical LAN.
        addresses.sort_by(|a, b| {
            let a_v4 = a.is_ipv4();
            let b_v4 = b.is_ipv4();
            b_v4.cmp(&a_v4)
        });

        if addresses.is_empty() {
            return Err("No network interfaces found".to_string());
        }

        // Use the device_id (UUID) as the mDNS *instance* name so that two
        // devices with the same display name do not collide.
        let instance_name = &self.local_identity.device_id;

        // Derive a stable hostname from the device_id.
        let hostname = format!(
            "{}.local.",
            self.local_identity
                .device_id
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '-')
                .collect::<String>()
        );

        let service_info = ServiceInfo::new(
            SERVICE_TYPE,
            instance_name,
            &hostname,
            &addresses[..],
            port,
            Some(properties),
        )
        .map_err(|e| format!("Failed to create service info: {}", e))?;

        self.mdns
            .register(service_info)
            .map_err(|e| format!("Failed to register mDNS service: {}", e))?;

        println!(
            "✓ Advertising as '{}' (id: {}) on port {} via mDNS",
            self.local_identity.display_name, self.local_identity.device_id, port
        );

        Ok(())
    }

    /// Start browsing for peers.
    ///
    /// The call is idempotent – duplicate invocations are silently ignored.
    ///
    /// The mDNS receiver channel uses a *blocking* `recv()` call, which must
    /// not run directly inside a Tokio async task (it would park a worker
    /// thread).  We therefore spawn a dedicated OS thread for the blocking
    /// loop and use the Tokio runtime handle to dispatch async handlers back
    /// onto the async runtime.
    pub fn start_discovery(&self, app_handle: AppHandle) -> Result<(), String> {
        if self.started_discovery.swap(true, Ordering::SeqCst) {
            println!("⚠️  Discovery already running – ignoring duplicate start");
            return Ok(());
        }

        let receiver = self.mdns.browse(SERVICE_TYPE).map_err(|e| {
            // Reset so a retry is possible.
            self.started_discovery.store(false, Ordering::SeqCst);
            format!("Failed to start mDNS browsing: {}", e)
        })?;

        let devices = Arc::clone(&self.devices);
        let fullname_to_id = Arc::clone(&self.fullname_to_id);
        let local_id = self.local_identity.device_id.clone();

        // Capture the Tokio runtime handle *before* leaving the async context
        // so the blocking OS thread can schedule async work back onto it.
        let rt_handle = tokio::runtime::Handle::current();

        // Spawn a dedicated OS thread for the blocking receiver loop.
        std::thread::Builder::new()
            .name("mdns-discovery".to_string())
            .spawn(move || {
                println!("✓ mDNS discovery thread started");

                while let Ok(event) = receiver.recv() {
                    match event {
                        ServiceEvent::ServiceResolved(info) => {
                            let d = Arc::clone(&devices);
                            let f = Arc::clone(&fullname_to_id);
                            let lid = local_id.clone();
                            let ah = app_handle.clone();
                            rt_handle.spawn(async move {
                                Self::handle_service_resolved(info, &d, &f, &lid, &ah).await;
                            });
                        }
                        ServiceEvent::ServiceRemoved(_, fullname) => {
                            let d = Arc::clone(&devices);
                            let f = Arc::clone(&fullname_to_id);
                            let ah = app_handle.clone();
                            rt_handle.spawn(async move {
                                Self::handle_service_removed(fullname, &d, &f, &ah).await;
                            });
                        }
                        _ => {}
                    }
                }

                println!("mDNS discovery receiver closed – thread exiting");
            })
            .map_err(|e| format!("Failed to spawn mDNS thread: {}", e))?;

        println!("✓ mDNS discovery started (service type: {})", SERVICE_TYPE);
        Ok(())
    }

    /// Handle a resolved service event.
    async fn handle_service_resolved(
        info: ServiceInfo,
        devices: &Arc<RwLock<HashMap<String, Device>>>,
        fullname_to_id: &Arc<RwLock<HashMap<String, String>>>,
        local_id: &str,
        app_handle: &AppHandle,
    ) {
        // Prefer the explicit TXT property; fall back to the full mDNS name.
        let id = info
            .get_property_val_str("deviceId")
            .unwrap_or_else(|| info.get_fullname())
            .to_string();

        // Skip our own advertisement.
        if id == local_id {
            return;
        }

        // Filter and prioritise IPv4 addresses; drop link-local IPv6.
        let mut addresses: Vec<String> = info
            .get_addresses()
            .iter()
            .filter(|addr| match addr {
                IpAddr::V6(ipv6) => {
                    let segments = ipv6.segments();
                    // Reject fe80::/10 link-local addresses.
                    !(segments[0] >= 0xfe80 && segments[0] <= 0xfebf)
                }
                IpAddr::V4(_) => true,
            })
            .map(|addr| addr.to_string())
            .collect();

        // IPv4 first.
        addresses.sort_by(|a, b| {
            let a_v4 = !a.contains(':');
            let b_v4 = !b.contains(':');
            b_v4.cmp(&a_v4)
        });

        if addresses.is_empty() {
            eprintln!(
                "Skipping device {} – no reachable addresses after filtering",
                id
            );
            return;
        }

        let device = Device {
            id: id.clone(),
            name: info
                .get_property_val_str("displayName")
                .unwrap_or_else(|| info.get_fullname())
                .to_string(),
            hostname: info.get_hostname().to_string(),
            port: info.get_port(),
            addresses: addresses.clone(),
            last_seen: chrono::Utc::now().timestamp(),
            platform: info
                .get_property_val_str("platform")
                .unwrap_or("unknown")
                .to_string(),
            app_version: String::new(), // Not broadcast for security reasons.
        };

        println!(
            "✓ Discovered peer: '{}' ({}) at {}:{}",
            device.name, device.id, addresses[0], device.port
        );

        // Store fullname → id so we can remove the device correctly later.
        fullname_to_id
            .write()
            .await
            .insert(info.get_fullname().to_string(), id.clone());

        devices.write().await.insert(id.clone(), device.clone());

        // Notify mesh router about the new direct peer
        if let Some(mesh_router) = app_handle.try_state::<MeshRouter>() {
            mesh_router
                .on_device_discovered(&id, &device.name, app_handle)
                .await;
        }

        let _ = app_handle.emit("device-discovered", device);
    }

    /// Handle a service-removed event.
    ///
    /// We look up the device by its mDNS full name (which is stable) rather
    /// than the display name (which can be identical across devices and does
    /// not match the raw `fullname` string emitted by the daemon).
    async fn handle_service_removed(
        fullname: String,
        devices: &Arc<RwLock<HashMap<String, Device>>>,
        fullname_to_id: &Arc<RwLock<HashMap<String, String>>>,
        app_handle: &AppHandle,
    ) {
        // Remove the fullname → id mapping and grab the id in one step.
        let id = fullname_to_id.write().await.remove(&fullname);

        if let Some(id) = id {
            devices.write().await.remove(&id);
            println!("✓ Peer left: {} ({})", fullname, id);

            // Notify mesh router about the removed peer
            if let Some(mesh_router) = app_handle.try_state::<MeshRouter>() {
                mesh_router.on_device_removed(&id, app_handle).await;
            }

            let _ = app_handle.emit("device-removed", &id);

            // Trigger group host election if the departing device was a host.
            // We need the local device ID from the discovery service managed state.
            if let Some(group_service) = app_handle.try_state::<GroupService>() {
                if let Some(discovery) = app_handle.try_state::<Arc<MdnsDiscoveryService>>() {
                    let local_device_id = discovery.local_device_id().to_string();
                    let offline_id = id.clone();
                    let gs = group_service.inner().clone();
                    let ah = app_handle.clone();
                    tokio::spawn(async move {
                        // Check every group the local device is in
                        if let Ok(groups) = gs.get_groups(&local_device_id).await {
                            for group in groups {
                                if let Err(e) = gs
                                    .check_and_elect_host(
                                        &group.id,
                                        &offline_id,
                                        &local_device_id,
                                        &ah,
                                    )
                                    .await
                                {
                                    eprintln!(
                                        "⚠️  Host election for group {} failed: {}",
                                        group.id, e
                                    );
                                }
                            }
                        }
                    });
                }
            }
        } else {
            // The service might have been removed before it was fully resolved
            // (e.g. the peer quit very quickly).  This is not an error.
            println!("ℹ️  Received remove for unknown service: {}", fullname);
        }
    }

    /// Return a snapshot of all currently known peer devices.
    pub async fn get_devices(&self) -> Vec<Device> {
        self.devices.read().await.values().cloned().collect()
    }

    /// Return the local device's unique identifier.
    pub fn local_device_id(&self) -> &str {
        &self.local_identity.device_id
    }

    /// Return the full local device identity.
    pub fn local_identity(&self) -> &DeviceIdentity {
        &self.local_identity
    }
}
