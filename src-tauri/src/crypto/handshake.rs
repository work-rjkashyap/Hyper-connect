//! Secure Handshake Protocol
//!
//! Implements the ECDH key exchange handshake for establishing encrypted sessions.
//! Extends the existing HELLO protocol with cryptographic key exchange.

use crate::crypto::session::{Keypair, Session};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

/// Handshake manager maintains keypairs and sessions for active connections
pub struct HandshakeManager {
    /// Ephemeral keypairs for ongoing handshakes (cleared after session established)
    pending_keypairs: Arc<Mutex<HashMap<String, Keypair>>>,
    /// Established sessions keyed by peer device ID
    sessions: Arc<Mutex<HashMap<String, Session>>>,
}

/// Secure HELLO message with public key
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelloSecure {
    pub device_id: String,
    pub display_name: String,
    pub platform: String,
    pub app_version: String,
    #[serde(with = "base64_serde")]
    pub public_key: [u8; 32],
}

/// HELLO_RESPONSE with our public key
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelloResponse {
    pub device_id: String,
    pub display_name: String,
    pub platform: String,
    pub app_version: String,
    #[serde(with = "base64_serde")]
    pub public_key: [u8; 32],
    pub accepted: bool,
}

/// Handshake state
#[derive(Debug, Clone, PartialEq)]
pub enum HandshakeState {
    /// No handshake initiated
    None,
    /// Waiting for HELLO_RESPONSE
    WaitingForResponse,
    /// Handshake complete, session established
    Established,
    /// Handshake failed
    Failed(String),
}

impl HandshakeManager {
    /// Create a new handshake manager
    pub fn new() -> Self {
        Self {
            pending_keypairs: Arc::new(Mutex::new(HashMap::new())),
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Initiate a handshake with a peer (as client)
    ///
    /// Returns HelloSecure message to send to peer
    pub fn initiate_handshake(
        &self,
        our_device_id: &str,
        display_name: &str,
        platform: &str,
        app_version: &str,
        peer_device_id: &str,
    ) -> Result<HelloSecure, String> {
        // Generate ephemeral keypair
        let keypair = Keypair::generate();
        let public_key = keypair.public_bytes();

        // Store keypair for later session establishment
        self.pending_keypairs
            .lock()
            .unwrap()
            .insert(peer_device_id.to_string(), keypair);

        Ok(HelloSecure {
            device_id: our_device_id.to_string(),
            display_name: display_name.to_string(),
            platform: platform.to_string(),
            app_version: app_version.to_string(),
            public_key,
        })
    }

    /// Handle incoming HELLO_SECURE (as server)
    ///
    /// Returns HelloResponse to send back
    pub fn handle_hello_secure(
        &self,
        hello: HelloSecure,
        our_device_id: &str,
        display_name: &str,
        platform: &str,
        app_version: &str,
    ) -> Result<HelloResponse, String> {
        // Generate ephemeral keypair
        let keypair = Keypair::generate();
        let public_key = keypair.public_bytes();

        // Store keypair for session establishment
        self.pending_keypairs
            .lock()
            .unwrap()
            .insert(hello.device_id.clone(), keypair);

        Ok(HelloResponse {
            device_id: our_device_id.to_string(),
            display_name: display_name.to_string(),
            platform: platform.to_string(),
            app_version: app_version.to_string(),
            public_key,
            accepted: true,
        })
    }

    /// Complete handshake after receiving HELLO_RESPONSE (as client)
    ///
    /// Derives session key and stores session
    pub fn complete_handshake(&self, response: HelloResponse) -> Result<Session, String> {
        // Retrieve our keypair
        let mut pending = self.pending_keypairs.lock().unwrap();
        let keypair = pending
            .remove(&response.device_id)
            .ok_or("No pending handshake for this peer")?;

        // Perform ECDH and derive session
        let session = Session::from_ecdh(keypair.secret, &response.public_key)?;

        // Store session
        self.sessions
            .lock()
            .unwrap()
            .insert(response.device_id.clone(), session.clone());

        Ok(session)
    }

    /// Finalize handshake after sending HELLO_RESPONSE (as server)
    ///
    /// Called after response is sent to complete the handshake
    pub fn finalize_handshake(
        &self,
        peer_device_id: &str,
        peer_public_key: &[u8; 32],
    ) -> Result<Session, String> {
        // Retrieve our keypair
        let mut pending = self.pending_keypairs.lock().unwrap();
        let keypair = pending
            .remove(peer_device_id)
            .ok_or("No pending handshake for this peer")?;

        // Perform ECDH and derive session
        let session = Session::from_ecdh(keypair.secret, peer_public_key)?;

        // Store session
        self.sessions
            .lock()
            .unwrap()
            .insert(peer_device_id.to_string(), session.clone());

        Ok(session)
    }

    /// Get an established session for a peer
    pub fn get_session(&self, peer_device_id: &str) -> Option<Session> {
        self.sessions.lock().unwrap().get(peer_device_id).cloned()
    }

    /// Check if a session exists for a peer
    pub fn has_session(&self, peer_device_id: &str) -> bool {
        self.sessions.lock().unwrap().contains_key(peer_device_id)
    }

    /// Remove a session (on disconnect)
    pub fn remove_session(&self, peer_device_id: &str) {
        self.sessions.lock().unwrap().remove(peer_device_id);
        self.pending_keypairs.lock().unwrap().remove(peer_device_id);
    }

    /// Clear all sessions and pending handshakes
    pub fn clear_all(&self) {
        self.sessions.lock().unwrap().clear();
        self.pending_keypairs.lock().unwrap().clear();
    }

    /// Get count of active sessions
    pub fn session_count(&self) -> usize {
        self.sessions.lock().unwrap().len()
    }

    /// Get count of pending handshakes
    pub fn pending_count(&self) -> usize {
        self.pending_keypairs.lock().unwrap().len()
    }
}

impl Default for HandshakeManager {
    fn default() -> Self {
        Self::new()
    }
}

// Ensure HandshakeManager is Send + Sync
unsafe impl Send for HandshakeManager {}
unsafe impl Sync for HandshakeManager {}

/// Helper module for base64 serialization of byte arrays
mod base64_serde {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(bytes: &[u8; 32], serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let encoded = STANDARD.encode(bytes);
        serializer.serialize_str(&encoded)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<[u8; 32], D::Error>
    where
        D: Deserializer<'de>,
    {
        let encoded = String::deserialize(deserializer)?;
        let decoded = STANDARD
            .decode(&encoded)
            .map_err(serde::de::Error::custom)?;

        if decoded.len() != 32 {
            return Err(serde::de::Error::custom("Invalid key length"));
        }

        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(&decoded);
        Ok(bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_handshake_manager_creation() {
        let manager = HandshakeManager::new();
        assert_eq!(manager.session_count(), 0);
        assert_eq!(manager.pending_count(), 0);
    }

    #[test]
    fn test_full_handshake_flow() {
        // Simulate Alice and Bob
        let alice_manager = HandshakeManager::new();
        let bob_manager = HandshakeManager::new();

        let alice_id = "alice-uuid";
        let bob_id = "bob-uuid";

        // Alice initiates handshake
        let hello = alice_manager
            .initiate_handshake(alice_id, "Alice", "macos", "0.1.0", bob_id)
            .unwrap();

        assert_eq!(hello.device_id, alice_id);
        assert_eq!(alice_manager.pending_count(), 1);

        // Bob receives HELLO_SECURE and responds
        let response = bob_manager
            .handle_hello_secure(hello.clone(), bob_id, "Bob", "linux", "0.1.0")
            .unwrap();

        assert_eq!(response.device_id, bob_id);
        assert!(response.accepted);
        assert_eq!(bob_manager.pending_count(), 1);

        // Bob finalizes his side
        let bob_session = bob_manager
            .finalize_handshake(alice_id, &hello.public_key)
            .unwrap();

        assert_eq!(bob_manager.session_count(), 1);
        assert_eq!(bob_manager.pending_count(), 0);
        assert!(bob_manager.has_session(alice_id));

        // Alice receives HELLO_RESPONSE and completes handshake
        let alice_session = alice_manager.complete_handshake(response).unwrap();

        assert_eq!(alice_manager.session_count(), 1);
        assert_eq!(alice_manager.pending_count(), 0);
        assert!(alice_manager.has_session(bob_id));

        // Both should have valid sessions
        assert!(alice_manager.get_session(bob_id).is_some());
        assert!(bob_manager.get_session(alice_id).is_some());
    }

    #[test]
    fn test_session_removal() {
        let manager = HandshakeManager::new();
        let peer_id = "peer-uuid";

        // Create a dummy handshake
        let _ = manager
            .initiate_handshake("me", "Me", "linux", "0.1.0", peer_id)
            .unwrap();

        assert_eq!(manager.pending_count(), 1);

        // Remove session
        manager.remove_session(peer_id);

        assert_eq!(manager.pending_count(), 0);
        assert_eq!(manager.session_count(), 0);
    }

    #[test]
    fn test_clear_all() {
        let manager = HandshakeManager::new();

        // Create multiple pending handshakes
        let _ = manager
            .initiate_handshake("me", "Me", "linux", "0.1.0", "peer1")
            .unwrap();
        let _ = manager
            .initiate_handshake("me", "Me", "linux", "0.1.0", "peer2")
            .unwrap();

        assert_eq!(manager.pending_count(), 2);

        manager.clear_all();

        assert_eq!(manager.pending_count(), 0);
        assert_eq!(manager.session_count(), 0);
    }

    #[test]
    fn test_hello_secure_serialization() {
        let hello = HelloSecure {
            device_id: "test-uuid".to_string(),
            display_name: "Test Device".to_string(),
            platform: "linux".to_string(),
            app_version: "0.1.0".to_string(),
            public_key: [0x42; 32],
        };

        let json = serde_json::to_string(&hello).unwrap();
        let deserialized: HelloSecure = serde_json::from_str(&json).unwrap();

        assert_eq!(hello.device_id, deserialized.device_id);
        assert_eq!(hello.public_key, deserialized.public_key);
    }
}
