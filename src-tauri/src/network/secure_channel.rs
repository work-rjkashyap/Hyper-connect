//! Secure Channel
//!
//! Identity holder and handshake-state coordinator shared by the TCP client
//! and server.  The actual ECDH handshake frames are built and parsed
//! directly in `client.rs` (initiator) and `server.rs` (responder), both of
//! which access `handshake_manager` directly.  This struct exists so that the
//! four identity strings and the shared `HandshakeManager` only need to be
//! constructed once and can be `Arc`-cloned across tasks.

use crate::crypto::HandshakeManager;
use std::sync::Arc;

/// Identity strings and ECDH handshake state shared across connections.
pub struct SecureChannelManager {
    /// X25519 handshake manager (tracks ephemeral keypairs per in-flight connection)
    pub handshake_manager: Arc<HandshakeManager>,
    /// Local device identity – read-only after construction
    pub local_device_id: String,
    pub display_name: String,
    pub platform: String,
    pub app_version: String,
}

impl SecureChannelManager {
    /// Create a new manager with the local device's identity.
    pub fn new(
        local_device_id: String,
        display_name: String,
        platform: String,
        app_version: String,
    ) -> Self {
        Self {
            handshake_manager: Arc::new(HandshakeManager::new()),
            local_device_id,
            display_name,
            platform,
            app_version,
        }
    }

    /// Clean up any pending handshake state for a peer on disconnect.
    pub async fn remove_session(&self, peer_device_id: &str) {
        self.handshake_manager.remove_session(peer_device_id);
        println!("🔒 Session destroyed for {}", peer_device_id);
    }
}
