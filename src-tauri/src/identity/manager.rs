//! Identity Manager
//!
//! Manages device identity including persistent device ID (UUID) and user-configurable display name.
//! The device ID is generated once on first launch and persists across app restarts.
//! This ensures consistent identification across the network.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

/// Device identity configuration stored on disk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceIdentity {
    /// Unique, immutable device identifier (UUID v4)
    pub device_id: String,

    /// User-configurable display name
    pub display_name: String,

    /// Platform information
    pub platform: String,

    /// App version
    pub app_version: String,
}

/// Identity Manager handles device identity persistence
pub struct IdentityManager {
    config_path: PathBuf,
    identity: DeviceIdentity,
}

impl IdentityManager {
    /// Create a new identity manager
    ///
    /// # Arguments
    /// * `app_data_dir` - Application data directory for storing config
    /// * `app_version` - Current application version
    ///
    /// # Returns
    /// * `Result<Self, String>` - Identity manager or error message
    pub fn new(app_data_dir: PathBuf, app_version: String) -> Result<Self, String> {
        // Ensure app data directory exists
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;

        let config_path = app_data_dir.join("device-identity.json");

        // Load existing identity or create new one
        let identity = if config_path.exists() {
            Self::load_identity(&config_path, &app_version)?
        } else {
            Self::create_new_identity(&config_path, app_version)?
        };

        println!("✓ Device Identity loaded - ID: {}, Name: {}",
            identity.device_id, identity.display_name);

        Ok(Self {
            config_path,
            identity,
        })
    }

    /// Load existing identity from disk
    fn load_identity(config_path: &PathBuf, app_version: &str) -> Result<DeviceIdentity, String> {
        let contents = fs::read_to_string(config_path)
            .map_err(|e| format!("Failed to read identity config: {}", e))?;

        let mut identity: DeviceIdentity = serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to parse identity config: {}", e))?;

        // Update app version (this can change between launches)
        identity.app_version = app_version.to_string();

        println!("✓ Loaded existing device identity from disk");
        Ok(identity)
    }

    /// Create a new identity
    fn create_new_identity(config_path: &PathBuf, app_version: String) -> Result<DeviceIdentity, String> {
        let device_id = Uuid::new_v4().to_string();
        let platform = Self::detect_platform();

        // Default display name based on platform
        let display_name = format!("{} Device", platform);

        let identity = DeviceIdentity {
            device_id: device_id.clone(),
            display_name,
            platform,
            app_version,
        };

        // Persist to disk
        Self::save_identity(config_path, &identity)?;

        println!("✓ Generated new device identity - ID: {}", device_id);
        Ok(identity)
    }

    /// Save identity to disk
    fn save_identity(config_path: &PathBuf, identity: &DeviceIdentity) -> Result<(), String> {
        let json = serde_json::to_string_pretty(identity)
            .map_err(|e| format!("Failed to serialize identity: {}", e))?;

        fs::write(config_path, json)
            .map_err(|e| format!("Failed to write identity config: {}", e))?;

        Ok(())
    }

    /// Detect current platform
    fn detect_platform() -> String {
        if cfg!(target_os = "windows") {
            "Windows".to_string()
        } else if cfg!(target_os = "macos") {
            "macOS".to_string()
        } else if cfg!(target_os = "linux") {
            "Linux".to_string()
        } else if cfg!(target_os = "ios") {
            "iOS".to_string()
        } else if cfg!(target_os = "android") {
            "Android".to_string()
        } else {
            "Unknown".to_string()
        }
    }

    /// Get device ID (immutable)
    pub fn device_id(&self) -> &str {
        &self.identity.device_id
    }

    /// Get display name
    pub fn display_name(&self) -> &str {
        &self.identity.display_name
    }

    /// Get platform
    pub fn platform(&self) -> &str {
        &self.identity.platform
    }

    /// Get app version
    pub fn app_version(&self) -> &str {
        &self.identity.app_version
    }

    /// Get full identity
    pub fn identity(&self) -> &DeviceIdentity {
        &self.identity
    }

    /// Update display name (persists to disk)
    ///
    /// # Arguments
    /// * `new_name` - New display name
    ///
    /// # Returns
    /// * `Result<(), String>` - Success or error message
    pub fn update_display_name(&mut self, new_name: String) -> Result<(), String> {
        if new_name.trim().is_empty() {
            return Err("Display name cannot be empty".to_string());
        }

        self.identity.display_name = new_name.trim().to_string();
        Self::save_identity(&self.config_path, &self.identity)?;

        println!("✓ Updated display name to: {}", self.identity.display_name);
        Ok(())
    }

    /// Validate device ID format
    pub fn is_valid_device_id(id: &str) -> bool {
        Uuid::parse_str(id).is_ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_identity_creation() {
        let temp_dir = env::temp_dir().join(format!("hyper-connect-test-{}", Uuid::new_v4()));
        let manager = IdentityManager::new(temp_dir.clone(), "1.0.0".to_string()).unwrap();

        assert!(!manager.device_id().is_empty());
        assert!(IdentityManager::is_valid_device_id(manager.device_id()));
        assert!(!manager.display_name().is_empty());

        // Cleanup
        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_identity_persistence() {
        let temp_dir = env::temp_dir().join(format!("hyper-connect-test-{}", Uuid::new_v4()));

        // Create first manager
        let manager1 = IdentityManager::new(temp_dir.clone(), "1.0.0".to_string()).unwrap();
        let device_id = manager1.device_id().to_string();

        // Create second manager (should load same ID)
        let manager2 = IdentityManager::new(temp_dir.clone(), "1.0.0".to_string()).unwrap();

        assert_eq!(manager2.device_id(), device_id);

        // Cleanup
        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_display_name_update() {
        let temp_dir = env::temp_dir().join(format!("hyper-connect-test-{}", Uuid::new_v4()));
        let mut manager = IdentityManager::new(temp_dir.clone(), "1.0.0".to_string()).unwrap();

        manager.update_display_name("Test Device".to_string()).unwrap();
        assert_eq!(manager.display_name(), "Test Device");

        // Should reject empty names
        assert!(manager.update_display_name("".to_string()).is_err());
        assert!(manager.update_display_name("   ".to_string()).is_err());

        // Cleanup
        let _ = fs::remove_dir_all(temp_dir);
    }
}
