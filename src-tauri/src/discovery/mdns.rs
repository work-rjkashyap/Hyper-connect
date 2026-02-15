//! mDNS Discovery Service
//!
//! Handles device discovery on the local network using Multicast DNS (mDNS).
//! Advertises local device and discovers peers running the same application.

use crate::identity::DeviceIdentity;
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;

/// mDNS service type for Hyper Connect
const SERVICE_TYPE: &str = "_hyperconnect._tcp.local.";

/// Discovered device information
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

/// mDNS Discovery Service
pub struct MdnsDiscoveryService {
    mdns: Arc<ServiceDaemon>,
    devices: Arc<RwLock<HashMap<String, Device>>>,
    local_identity: DeviceIdentity,
}

impl MdnsDiscoveryService {
    /// Create a new discovery service
    pub fn new(local_identity: DeviceIdentity) -> Result<Self, String> {
        let mdns = ServiceDaemon::new()
            .map_err(|e| format!("Failed to create mDNS daemon: {}", e))?;

        Ok(Self {
            mdns: Arc::new(mdns),
            devices: Arc::new(RwLock::new(HashMap::new())),
            local_identity,
        })
    }

    /// Start advertising this device
    pub fn start_advertising(&self, port: u16) -> Result<(), String> {
        let mut properties = HashMap::new();
        properties.insert("deviceId".to_string(), self.local_identity.device_id.clone());
        properties.insert("displayName".to_string(), self.local_identity.display_name.clone());
        properties.insert("platform".to_string(), self.local_identity.platform.clone());
        properties.insert("appVersion".to_string(), self.local_identity.app_version.clone());

        // Get local IP addresses
        let addresses: Vec<IpAddr> = if_addrs::get_if_addrs()
            .unwrap_or_default()
            .into_iter()
            .filter(|iface| !iface.is_loopback())
            .map(|iface| iface.addr.ip())
            .collect();

        if addresses.is_empty() {
            return Err("No network interfaces found".to_string());
        }

        // Create hostname
        let hostname = format!(
            "{}.local.",
            self.local_identity
                .display_name
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

        self.mdns
            .register(service_info)
            .map_err(|e| format!("Failed to register: {}", e))?;

        println!(
            "✓ Advertising as '{}' on port {} (mDNS: {})",
            self.local_identity.display_name, port, SERVICE_TYPE
        );

        Ok(())
    }

    /// Start discovering peers
    pub fn start_discovery(&self, app_handle: AppHandle) -> Result<(), String> {
        let receiver = self
            .mdns
            .browse(SERVICE_TYPE)
            .map_err(|e| format!("Failed to start browsing: {}", e))?;

        let devices = Arc::clone(&self.devices);
        let local_id = self.local_identity.device_id.clone();

        tokio::spawn(async move {
            while let Ok(event) = receiver.recv() {
                match event {
                    ServiceEvent::ServiceResolved(info) => {
                        Self::handle_service_resolved(info, &devices, &local_id, &app_handle)
                            .await;
                    }
                    ServiceEvent::ServiceRemoved(_, fullname) => {
                        Self::handle_service_removed(fullname, &devices, &app_handle).await;
                    }
                    _ => {}
                }
            }
        });

        println!("✓ Started mDNS discovery");
        Ok(())
    }

    /// Handle a resolved service
    async fn handle_service_resolved(
        info: ServiceInfo,
        devices: &Arc<RwLock<HashMap<String, Device>>>,
        local_id: &str,
        app_handle: &AppHandle,
    ) {
        // Get device ID from TXT properties
        let id = info
            .get_property_val_str("deviceId")
            .unwrap_or_else(|| info.get_fullname())
            .to_string();

        // Don't discover ourselves
        if id == local_id {
            return;
        }

        // Filter and prioritize IPv4 addresses
        let mut addresses: Vec<String> = info
            .get_addresses()
            .iter()
            .filter(|addr| match addr {
                IpAddr::V6(ipv6) => {
                    let segments = ipv6.segments();
                    // Filter out link-local addresses (fe80::/10)
                    !(segments[0] >= 0xfe80 && segments[0] <= 0xfebf)
                }
                IpAddr::V4(_) => true,
            })
            .map(|addr| addr.to_string())
            .collect();

        // Sort: IPv4 first
        addresses.sort_by(|a, b| {
            let a_is_v4 = !a.contains(':');
            let b_is_v4 = !b.contains(':');
            b_is_v4.cmp(&a_is_v4)
        });

        if addresses.is_empty() {
            eprintln!("No valid addresses for device {}", id);
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
            app_version: info
                .get_property_val_str("appVersion")
                .unwrap_or("unknown")
                .to_string(),
        };

        println!(
            "✓ Discovered device: {} ({}) at {}:{}",
            device.name, device.id, addresses[0], device.port
        );

        let mut devices_lock = devices.write().await;
        devices_lock.insert(id.clone(), device.clone());
        drop(devices_lock);

        let _ = app_handle.emit("device-discovered", device);
    }

    /// Handle a removed service
    async fn handle_service_removed(
        fullname: String,
        devices: &Arc<RwLock<HashMap<String, Device>>>,
        app_handle: &AppHandle,
    ) {
        let mut devices_lock = devices.write().await;

        // Find device by service name
        if let Some((id, _)) = devices_lock
            .iter()
            .find(|(_, device)| device.name == fullname)
        {
            let id = id.clone();
            devices_lock.remove(&id);
            drop(devices_lock);

            println!("✓ Device removed: {}", fullname);
            let _ = app_handle.emit("device-removed", id);
        }
    }

    /// Get all discovered devices
    pub async fn get_devices(&self) -> Vec<Device> {
        let devices = self.devices.read().await;
        devices.values().cloned().collect()
    }

    /// Get local device ID
    pub fn local_device_id(&self) -> &str {
        &self.local_identity.device_id
    }

    /// Get local device identity
    pub fn local_identity(&self) -> &DeviceIdentity {
        &self.local_identity
    }
}
