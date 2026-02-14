use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::net::IpAddr;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

const SERVICE_TYPE: &str = "_hyperconnect._tcp.local.";

#[derive(Debug, Serialize, Deserialize)]
struct DeviceConfig {
    device_id: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub hostname: String,
    pub port: u16,
    pub addresses: Vec<String>,
    pub last_seen: i64,
    pub os: String,
    pub service_name: String,
}
#[derive(Clone)]
pub struct DiscoveryService {
    mdns: Arc<ServiceDaemon>,
    devices: Arc<Mutex<HashMap<String, Device>>>,
    local_device_id: String,
    is_discovering: Arc<Mutex<bool>>,
}
impl DiscoveryService {
    pub fn new(app_data_dir: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        let mdns = ServiceDaemon::new()?;
        let local_device_id = Self::load_or_generate_device_id(&app_data_dir)?;

        println!("Device ID: {}", local_device_id);

        Ok(Self {
            mdns: Arc::new(mdns),
            devices: Arc::new(Mutex::new(HashMap::new())),
            local_device_id,
            is_discovering: Arc::new(Mutex::new(false)),
        })
    }

    /// Load device ID from config file or generate a new one
    /// This ensures the same device always gets the same ID across restarts
    fn load_or_generate_device_id(app_data_dir: &PathBuf) -> Result<String, Box<dyn std::error::Error>> {
        // Ensure app data directory exists
        if let Err(e) = fs::create_dir_all(app_data_dir) {
            eprintln!("Failed to create app data directory: {}", e);
        }

        let config_path = app_data_dir.join("device-config.json");

        // Try to load existing config
        if config_path.exists() {
            match fs::read_to_string(&config_path) {
                Ok(contents) => {
                    match serde_json::from_str::<DeviceConfig>(&contents) {
                        Ok(config) => {
                            println!("Loaded existing device ID from config");
                            return Ok(config.device_id);
                        }
                        Err(e) => {
                            eprintln!("Failed to parse device config: {}", e);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Failed to read device config: {}", e);
                }
            }
        }

        // Generate new device ID
        let device_id = Uuid::new_v4().to_string();
        println!("Generated new device ID: {}", device_id);

        // Save to config file (but don't fail if this doesn't work)
        let config = DeviceConfig {
            device_id: device_id.clone(),
        };

        if let Ok(json) = serde_json::to_string_pretty(&config) {
            if let Err(e) = fs::write(&config_path, json) {
                eprintln!("Failed to save device config: {} (continuing anyway)", e);
            } else {
                println!("Saved device ID to config file");
            }
        }

        Ok(device_id)
    }
    pub fn start_advertising(&self, device_name: String, port: u16, app_version: String) -> Result<(), Box<dyn std::error::Error>> {
        // Prepare TXT properties (matching Electron implementation)
        let mut properties = HashMap::new();
        properties.insert("deviceId".to_string(), self.local_device_id.clone());
        properties.insert("displayName".to_string(), device_name.clone());

        // Detect platform (matching Electron property name)
        let platform = if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "mac"
        } else if cfg!(target_os = "linux") {
            "linux"
        } else {
            "unknown"
        };
        properties.insert("platform".to_string(), platform.to_string());
        properties.insert("appVersion".to_string(), app_version);

        // Get local IP addresses (filter out loopback)
        let addresses: Vec<IpAddr> = if_addrs::get_if_addrs()
            .unwrap_or_else(|_| vec![])
            .into_iter()
            .filter(|iface| !iface.is_loopback())
            .map(|iface| iface.addr.ip())
            .collect();

        // Create hostname from device name (sanitized) with .local. suffix
        let hostname = format!("{}.local.",
            device_name
                .to_lowercase()
                .replace(" ", "-")
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '-')
                .collect::<String>()
        );

        // Use display name as service instance name (not device ID)
        let service_info = ServiceInfo::new(
            SERVICE_TYPE,
            &device_name,  // Use display name as instance name
            &hostname,     // Hostname must end with .local.
            &addresses[..],
            port,
            Some(properties),
        )?;

        self.mdns.register(service_info)
            .map_err(|e| {
                eprintln!("Failed to register mDNS service: {}", e);
                e
            })?;

        println!("✓ Advertising as '{}' on port {} (_hyperconnect._tcp)", device_name, port);
        Ok(())
    }
    pub fn start_discovery(&self, app_handle: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
        let mut is_discovering = self.is_discovering.lock().unwrap();
        if *is_discovering {
            return Ok(());
        }
        *is_discovering = true;
        drop(is_discovering);

        let receiver = self.mdns.browse(SERVICE_TYPE)?;
        let devices = Arc::clone(&self.devices);
        let local_id = self.local_device_id.clone();
        std::thread::spawn(move || {
            while let Ok(event) = receiver.recv() {
                match event {
                    ServiceEvent::ServiceResolved(info) => {
                        // Get deviceId from TXT properties (matching Electron)
                        let id = info.get_property_val_str("deviceId")
                            .unwrap_or_else(|| info.get_fullname())
                            .to_string();

                        println!("Discovered device - ID: {}, Local ID: {}", id, local_id);

                        // Don't add ourselves
                        if id == local_id {
                            println!("✓ Skipping self-discovery (IDs match)");
                            continue;
                        }

                        // Filter and prioritize addresses:
                        // 1. Prefer IPv4 addresses
                        // 2. Filter out IPv6 link-local addresses (fe80::) as they need zone identifiers
                        let mut addresses: Vec<String> = info.get_addresses()
                            .iter()
                            .filter(|addr| {
                                // Filter out IPv6 link-local addresses (fe80::/10)
                                match addr {
                                    IpAddr::V6(ipv6) => {
                                        let segments = ipv6.segments();
                                        // Link-local addresses start with fe80::
                                        !(segments[0] >= 0xfe80 && segments[0] <= 0xfebf)
                                    }
                                    IpAddr::V4(_) => true,
                                }
                            })
                            .map(|addr| addr.to_string())
                            .collect();

                        // Sort to put IPv4 addresses first
                        addresses.sort_by(|a, b| {
                            let a_is_v4 = !a.contains(':');
                            let b_is_v4 = !b.contains(':');
                            b_is_v4.cmp(&a_is_v4)
                        });

                        let device = Device {
                            id: id.clone(),
                            name: info.get_property_val_str("displayName")
                                .unwrap_or_else(|| info.get_fullname())
                                .to_string(),
                            hostname: info.get_hostname().to_string(),
                            port: info.get_port(),
                            addresses,
                            last_seen: chrono::Utc::now().timestamp(),
                            os: info.get_property_val_str("platform")
                                .unwrap_or("unknown")
                                .to_string(),
                            service_name: info.get_fullname().to_string(),
                        };

                        println!("✓ Found peer: {} ({}) at {}:{}", device.name, device.id, device.addresses.first().unwrap_or(&"unknown".to_string()), device.port);

                        let mut devices_lock = devices.lock().unwrap();
                        devices_lock.insert(id.clone(), device.clone());
                        drop(devices_lock);
                        let _ = app_handle.emit("device-discovered", device);
                    }
                    ServiceEvent::ServiceRemoved(_, fullname) => {
                        let mut devices_lock = devices.lock().unwrap();
                        if let Some(id) = devices_lock.values()
                            .find(|d| d.service_name == fullname)
                            .map(|d| d.id.clone()) {
                            println!("✓ Lost peer: {}", fullname);
                            devices_lock.remove(&id);
                            drop(devices_lock);
                            let _ = app_handle.emit("device-removed", id);
                        }
                    }
                    _ => {}
                }
            }
        });
        Ok(())
    }
    pub fn get_devices(&self) -> Vec<Device> {
        let devices = self.devices.lock().unwrap();
        devices.values().cloned().collect()
    }
    pub fn get_local_device_id(&self) -> String {
        self.local_device_id.clone()
    }
}
