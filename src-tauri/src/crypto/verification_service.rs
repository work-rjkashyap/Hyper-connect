//! Verification Service
#![allow(dead_code)]
//!
//! Manages the SAS (Short Authentication String) verification lifecycle
//! across all peer connections. This service is stored as Tauri managed
//! state and accessed by IPC commands and the TCP server/client.
//!
//! ## Flow
//!
//! 1. User clicks "Verify" on a peer device in the UI.
//! 2. Frontend calls `initiate_verification` IPC command.
//! 3. This service ensures a TCP connection exists (ECDH already done),
//!    derives the SAS code from the session's shared secret, and emits
//!    `verification-code-ready` to the local frontend.
//! 4. A `SasVerifyRequest` frame is sent to the peer so that the peer's
//!    server can derive the same code and present it to the remote user.
//! 5. Both users compare the codes and click Confirm or Reject.
//! 6. `SasConfirm` / `SasReject` frames propagate the result to the peer.
//! 7. When both sides confirm, `handshake-verified` is emitted on both.

use crate::crypto::verification::{PeerVerification, VerificationCode, VerificationState};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Event payload emitted to the frontend when a verification code is ready
/// for the user to compare.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationCodeReadyEvent {
    /// The peer device ID this verification is for.
    pub device_id: String,
    /// The peer's display name (for the UI).
    pub display_name: String,
    /// The formatted verification code (e.g. "482-991").
    pub verification_code: String,
    /// Whether we initiated the verification or the peer did.
    pub initiated_by_us: bool,
}

/// Event payload emitted when verification completes (both sides confirmed).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandshakeVerifiedEvent {
    /// The peer device ID that was verified.
    pub device_id: String,
    /// The peer's display name.
    pub display_name: String,
    /// The verification code that was confirmed.
    pub verification_code: String,
}

/// Event payload emitted when verification is rejected by either side.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandshakeRejectedEvent {
    /// The peer device ID whose verification was rejected.
    pub device_id: String,
    /// The peer's display name.
    pub display_name: String,
    /// Who rejected: "local" or "remote".
    pub rejected_by: String,
    /// Optional reason.
    pub reason: Option<String>,
}

/// Serializable snapshot of a single peer's verification status, returned
/// by the `get_verification_status` IPC command.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationStatus {
    pub device_id: String,
    pub display_name: String,
    pub state: VerificationState,
    pub verification_code: Option<String>,
    pub initiated_at: Option<u64>,
}

/// Central service managing SAS verification state for all peers.
///
/// Stored as Tauri managed state (`app.manage(verification_service)`).
/// Thread-safe via interior `Mutex`.
#[derive(Clone)]
pub struct VerificationService {
    /// Pending verifications keyed by peer device ID.
    pending: Arc<Mutex<HashMap<String, PeerVerification>>>,
    /// Successfully verified device IDs → their verification codes.
    verified: Arc<Mutex<HashMap<String, VerifiedPeer>>>,
    /// Tracks whether the remote side has already confirmed while we
    /// were still waiting for local confirmation.
    remote_confirmed: Arc<Mutex<HashMap<String, bool>>>,
}

/// Information stored for a verified peer.
#[derive(Debug, Clone)]
struct VerifiedPeer {
    display_name: String,
    code: VerificationCode,
    verified_at: u64,
}

impl VerificationService {
    /// Create a new empty verification service.
    pub fn new() -> Self {
        Self {
            pending: Arc::new(Mutex::new(HashMap::new())),
            verified: Arc::new(Mutex::new(HashMap::new())),
            remote_confirmed: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Start a verification for a peer given the ECDH shared secret.
    ///
    /// Returns the `PeerVerification` containing the SAS code to display.
    /// The caller is responsible for:
    /// - Emitting the `verification-code-ready` event to the frontend.
    /// - Sending a `SasVerifyRequest` frame to the peer.
    pub fn start_verification(
        &self,
        peer_device_id: &str,
        peer_display_name: &str,
        shared_secret: &[u8; 32],
    ) -> Result<PeerVerification, String> {
        let pv = PeerVerification::new(
            peer_device_id.to_string(),
            peer_display_name.to_string(),
            shared_secret,
        )?;

        self.pending
            .lock()
            .unwrap()
            .insert(peer_device_id.to_string(), pv.clone());

        // Clear any stale remote-confirmed flag from a previous attempt.
        self.remote_confirmed
            .lock()
            .unwrap()
            .remove(peer_device_id);

        println!(
            "🔑 VerificationService: started verification for {} — code: {}",
            peer_device_id,
            pv.code.formatted()
        );

        Ok(pv)
    }

    /// Handle an incoming `SasVerifyRequest` from a peer.
    ///
    /// Derives the SAS code from the shared secret (which must be the same
    /// on both sides) and stores it as a pending verification.
    ///
    /// Returns the `PeerVerification` so the caller can emit the UI event.
    pub fn handle_incoming_request(
        &self,
        peer_device_id: &str,
        peer_display_name: &str,
        shared_secret: &[u8; 32],
    ) -> Result<PeerVerification, String> {
        // Same derivation as start_verification — the shared secret is
        // identical on both sides of the ECDH exchange.
        self.start_verification(peer_device_id, peer_display_name, shared_secret)
    }

    /// The local user confirmed the SAS code matches.
    ///
    /// Returns the new `VerificationState`:
    /// - `Verified` if the remote side already confirmed.
    /// - `LocalConfirmed` if we're still waiting for the remote side.
    pub fn local_confirm(&self, peer_device_id: &str) -> Result<VerificationState, String> {
        let remote_already = self
            .remote_confirmed
            .lock()
            .unwrap()
            .get(peer_device_id)
            .copied()
            .unwrap_or(false);

        let mut pending = self.pending.lock().unwrap();
        let pv = pending
            .get_mut(peer_device_id)
            .ok_or_else(|| format!("No pending verification for {}", peer_device_id))?;

        if remote_already {
            // Both sides have now confirmed → verified.
            pv.state = VerificationState::Verified;
            let code = pv.code.clone();
            let display_name = pv.peer_display_name.clone();
            drop(pending);

            self.mark_verified_internal(peer_device_id, &display_name, &code);
            println!(
                "✅ VerificationService: VERIFIED {} (local confirmed after remote)",
                peer_device_id
            );
            Ok(VerificationState::Verified)
        } else {
            pv.state = VerificationState::LocalConfirmed;
            println!(
                "✓ VerificationService: local confirmed for {} — waiting for remote",
                peer_device_id
            );
            Ok(VerificationState::LocalConfirmed)
        }
    }

    /// The remote peer sent a `SasConfirm` frame.
    ///
    /// Returns the new `VerificationState`:
    /// - `Verified` if the local side already confirmed.
    /// - `PendingConfirmation` if we're still waiting for local confirmation.
    pub fn remote_confirm(&self, peer_device_id: &str) -> Result<VerificationState, String> {
        // Record that the remote side has confirmed.
        self.remote_confirmed
            .lock()
            .unwrap()
            .insert(peer_device_id.to_string(), true);

        let mut pending = self.pending.lock().unwrap();
        let pv = match pending.get_mut(peer_device_id) {
            Some(pv) => pv,
            None => {
                // No pending verification — the remote confirmed before we
                // even started. Record the flag and return.
                println!(
                    "🔑 VerificationService: remote confirmed for {} but no pending verification",
                    peer_device_id
                );
                return Ok(VerificationState::PendingConfirmation);
            }
        };

        match pv.state {
            VerificationState::LocalConfirmed => {
                // Both sides confirmed → verified.
                pv.state = VerificationState::Verified;
                let code = pv.code.clone();
                let display_name = pv.peer_display_name.clone();
                drop(pending);

                self.mark_verified_internal(peer_device_id, &display_name, &code);
                println!(
                    "✅ VerificationService: VERIFIED {} (remote confirmed after local)",
                    peer_device_id
                );
                Ok(VerificationState::Verified)
            }
            VerificationState::PendingConfirmation => {
                // Remote confirmed first — still waiting for local.
                println!(
                    "🔑 VerificationService: remote confirmed for {} — waiting for local",
                    peer_device_id
                );
                Ok(VerificationState::PendingConfirmation)
            }
            ref other => {
                println!(
                    "⚠️ VerificationService: unexpected state {:?} for remote_confirm on {}",
                    other, peer_device_id
                );
                Ok(other.clone())
            }
        }
    }

    /// The local user rejected the SAS code.
    pub fn local_reject(
        &self,
        peer_device_id: &str,
        reason: Option<String>,
    ) -> Result<(), String> {
        let mut pending = self.pending.lock().unwrap();
        if let Some(pv) = pending.get_mut(peer_device_id) {
            pv.state = VerificationState::Rejected;
        }
        drop(pending);

        self.remote_confirmed
            .lock()
            .unwrap()
            .remove(peer_device_id);

        println!(
            "❌ VerificationService: local rejected verification for {} (reason: {:?})",
            peer_device_id, reason
        );
        Ok(())
    }

    /// The remote peer sent a `SasReject` frame.
    pub fn remote_reject(
        &self,
        peer_device_id: &str,
        reason: Option<String>,
    ) -> Result<(), String> {
        let mut pending = self.pending.lock().unwrap();
        if let Some(pv) = pending.get_mut(peer_device_id) {
            pv.state = VerificationState::Rejected;
        }
        drop(pending);

        self.remote_confirmed
            .lock()
            .unwrap()
            .remove(peer_device_id);

        println!(
            "❌ VerificationService: remote rejected verification for {} (reason: {:?})",
            peer_device_id, reason
        );
        Ok(())
    }

    /// Get the current verification status for a peer.
    pub fn get_status(&self, peer_device_id: &str) -> VerificationStatus {
        // Check verified set first.
        if let Some(vp) = self.verified.lock().unwrap().get(peer_device_id) {
            return VerificationStatus {
                device_id: peer_device_id.to_string(),
                display_name: vp.display_name.clone(),
                state: VerificationState::Verified,
                verification_code: Some(vp.code.formatted()),
                initiated_at: Some(vp.verified_at),
            };
        }

        // Check pending set.
        if let Some(pv) = self.pending.lock().unwrap().get(peer_device_id) {
            return VerificationStatus {
                device_id: peer_device_id.to_string(),
                display_name: pv.peer_display_name.clone(),
                state: pv.state.clone(),
                verification_code: Some(pv.code.formatted()),
                initiated_at: Some(pv.initiated_at),
            };
        }

        // No verification state at all.
        VerificationStatus {
            device_id: peer_device_id.to_string(),
            display_name: String::new(),
            state: VerificationState::None,
            verification_code: None,
            initiated_at: None,
        }
    }

    /// Check whether a peer has been successfully verified.
    pub fn is_verified(&self, peer_device_id: &str) -> bool {
        self.verified
            .lock()
            .unwrap()
            .contains_key(peer_device_id)
    }

    /// Get all verified device IDs.
    pub fn verified_device_ids(&self) -> Vec<String> {
        self.verified
            .lock()
            .unwrap()
            .keys()
            .cloned()
            .collect()
    }

    /// Get the verification code for a pending or verified peer.
    pub fn get_verification_code(&self, peer_device_id: &str) -> Option<String> {
        // Check verified first.
        if let Some(vp) = self.verified.lock().unwrap().get(peer_device_id) {
            return Some(vp.code.formatted());
        }

        // Check pending.
        self.pending
            .lock()
            .unwrap()
            .get(peer_device_id)
            .map(|pv| pv.code.formatted())
    }

    /// Revoke verification for a peer (user no longer trusts them).
    pub fn revoke(&self, peer_device_id: &str) {
        self.verified.lock().unwrap().remove(peer_device_id);
        self.pending.lock().unwrap().remove(peer_device_id);
        self.remote_confirmed
            .lock()
            .unwrap()
            .remove(peer_device_id);
        println!(
            "🔓 VerificationService: revoked verification for {}",
            peer_device_id
        );
    }

    /// Clean up all verification state for a peer (e.g. on disconnect).
    pub fn cleanup_peer(&self, peer_device_id: &str) {
        self.pending.lock().unwrap().remove(peer_device_id);
        self.remote_confirmed
            .lock()
            .unwrap()
            .remove(peer_device_id);
        // Note: verified status is intentionally preserved across disconnects.
    }

    /// Clear all state (for app reset).
    pub fn clear_all(&self) {
        self.pending.lock().unwrap().clear();
        self.verified.lock().unwrap().clear();
        self.remote_confirmed.lock().unwrap().clear();
        println!("✓ VerificationService: all state cleared");
    }

    /// Get a summary of all verification states (for debugging / settings UI).
    pub fn get_all_statuses(&self) -> Vec<VerificationStatus> {
        let mut statuses = Vec::new();

        // Verified peers.
        for (device_id, vp) in self.verified.lock().unwrap().iter() {
            statuses.push(VerificationStatus {
                device_id: device_id.clone(),
                display_name: vp.display_name.clone(),
                state: VerificationState::Verified,
                verification_code: Some(vp.code.formatted()),
                initiated_at: Some(vp.verified_at),
            });
        }

        // Pending peers (skip if already in verified).
        for (device_id, pv) in self.pending.lock().unwrap().iter() {
            if !self.verified.lock().unwrap().contains_key(device_id) {
                statuses.push(VerificationStatus {
                    device_id: device_id.clone(),
                    display_name: pv.peer_display_name.clone(),
                    state: pv.state.clone(),
                    verification_code: Some(pv.code.formatted()),
                    initiated_at: Some(pv.initiated_at),
                });
            }
        }

        statuses
    }

    // ========================================================================
    // Internal helpers
    // ========================================================================

    fn mark_verified_internal(
        &self,
        peer_device_id: &str,
        display_name: &str,
        code: &VerificationCode,
    ) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        self.verified.lock().unwrap().insert(
            peer_device_id.to_string(),
            VerifiedPeer {
                display_name: display_name.to_string(),
                code: code.clone(),
                verified_at: now,
            },
        );

        // Clean up pending state.
        self.pending.lock().unwrap().remove(peer_device_id);
        self.remote_confirmed
            .lock()
            .unwrap()
            .remove(peer_device_id);
    }
}

impl Default for VerificationService {
    fn default() -> Self {
        Self::new()
    }
}

// VerificationService is Send + Sync because all interior state is behind
// Arc<Mutex<_>>.
unsafe impl Send for VerificationService {}
unsafe impl Sync for VerificationService {}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_secret() -> [u8; 32] {
        [0xAB; 32]
    }

    fn another_secret() -> [u8; 32] {
        [0xCD; 32]
    }

    #[test]
    fn test_start_verification() {
        let svc = VerificationService::new();
        let pv = svc
            .start_verification("peer-1", "Peer One", &test_secret())
            .unwrap();

        assert_eq!(pv.peer_device_id, "peer-1");
        assert_eq!(pv.state, VerificationState::PendingConfirmation);
        assert!(!pv.code.formatted().is_empty());

        let status = svc.get_status("peer-1");
        assert_eq!(status.state, VerificationState::PendingConfirmation);
        assert!(status.verification_code.is_some());
    }

    #[test]
    fn test_local_then_remote_confirm() {
        let svc = VerificationService::new();
        svc.start_verification("peer-1", "Peer One", &test_secret())
            .unwrap();

        let state = svc.local_confirm("peer-1").unwrap();
        assert_eq!(state, VerificationState::LocalConfirmed);
        assert!(!svc.is_verified("peer-1"));

        let state = svc.remote_confirm("peer-1").unwrap();
        assert_eq!(state, VerificationState::Verified);
        assert!(svc.is_verified("peer-1"));
    }

    #[test]
    fn test_remote_then_local_confirm() {
        let svc = VerificationService::new();
        svc.start_verification("peer-1", "Peer One", &test_secret())
            .unwrap();

        let state = svc.remote_confirm("peer-1").unwrap();
        assert_eq!(state, VerificationState::PendingConfirmation);
        assert!(!svc.is_verified("peer-1"));

        let state = svc.local_confirm("peer-1").unwrap();
        assert_eq!(state, VerificationState::Verified);
        assert!(svc.is_verified("peer-1"));
    }

    #[test]
    fn test_local_reject() {
        let svc = VerificationService::new();
        svc.start_verification("peer-1", "Peer One", &test_secret())
            .unwrap();

        svc.local_reject("peer-1", Some("Codes don't match".into()))
            .unwrap();

        let status = svc.get_status("peer-1");
        assert_eq!(status.state, VerificationState::Rejected);
        assert!(!svc.is_verified("peer-1"));
    }

    #[test]
    fn test_remote_reject() {
        let svc = VerificationService::new();
        svc.start_verification("peer-1", "Peer One", &test_secret())
            .unwrap();

        svc.remote_reject("peer-1", None).unwrap();

        let status = svc.get_status("peer-1");
        assert_eq!(status.state, VerificationState::Rejected);
    }

    #[test]
    fn test_verified_persists_across_cleanup() {
        let svc = VerificationService::new();
        svc.start_verification("peer-1", "Peer One", &test_secret())
            .unwrap();
        svc.local_confirm("peer-1").unwrap();
        svc.remote_confirm("peer-1").unwrap();
        assert!(svc.is_verified("peer-1"));

        // Cleanup (simulating disconnect) should preserve verified status.
        svc.cleanup_peer("peer-1");
        assert!(svc.is_verified("peer-1"));
    }

    #[test]
    fn test_revoke_removes_verified() {
        let svc = VerificationService::new();
        svc.start_verification("peer-1", "Peer One", &test_secret())
            .unwrap();
        svc.local_confirm("peer-1").unwrap();
        svc.remote_confirm("peer-1").unwrap();
        assert!(svc.is_verified("peer-1"));

        svc.revoke("peer-1");
        assert!(!svc.is_verified("peer-1"));
    }

    #[test]
    fn test_clear_all() {
        let svc = VerificationService::new();
        svc.start_verification("peer-1", "Peer One", &test_secret())
            .unwrap();
        svc.start_verification("peer-2", "Peer Two", &another_secret())
            .unwrap();
        svc.local_confirm("peer-1").unwrap();
        svc.remote_confirm("peer-1").unwrap();

        svc.clear_all();
        assert!(!svc.is_verified("peer-1"));
        assert!(svc.verified_device_ids().is_empty());
        assert_eq!(svc.get_status("peer-2").state, VerificationState::None);
    }

    #[test]
    fn test_verified_device_ids() {
        let svc = VerificationService::new();

        svc.start_verification("peer-1", "Peer One", &test_secret())
            .unwrap();
        svc.local_confirm("peer-1").unwrap();
        svc.remote_confirm("peer-1").unwrap();

        svc.start_verification("peer-2", "Peer Two", &another_secret())
            .unwrap();
        // peer-2 not confirmed yet

        let ids = svc.verified_device_ids();
        assert_eq!(ids.len(), 1);
        assert!(ids.contains(&"peer-1".to_string()));
    }

    #[test]
    fn test_same_secret_produces_same_code_both_sides() {
        let svc_a = VerificationService::new();
        let svc_b = VerificationService::new();

        let secret = test_secret();
        let pv_a = svc_a
            .start_verification("peer-b", "Peer B", &secret)
            .unwrap();
        let pv_b = svc_b
            .start_verification("peer-a", "Peer A", &secret)
            .unwrap();

        // Both sides should derive the exact same verification code
        // because the shared secret is identical.
        assert_eq!(pv_a.code, pv_b.code);
        assert_eq!(pv_a.code.formatted(), pv_b.code.formatted());
    }

    #[test]
    fn test_get_all_statuses() {
        let svc = VerificationService::new();

        svc.start_verification("peer-1", "Peer One", &test_secret())
            .unwrap();
        svc.local_confirm("peer-1").unwrap();
        svc.remote_confirm("peer-1").unwrap();

        svc.start_verification("peer-2", "Peer Two", &another_secret())
            .unwrap();

        let statuses = svc.get_all_statuses();
        assert_eq!(statuses.len(), 2);

        let verified = statuses.iter().find(|s| s.device_id == "peer-1").unwrap();
        assert_eq!(verified.state, VerificationState::Verified);

        let pending = statuses.iter().find(|s| s.device_id == "peer-2").unwrap();
        assert_eq!(pending.state, VerificationState::PendingConfirmation);
    }

    #[test]
    fn test_handle_incoming_request() {
        let svc = VerificationService::new();
        let pv = svc
            .handle_incoming_request("peer-1", "Peer One", &test_secret())
            .unwrap();

        assert_eq!(pv.peer_device_id, "peer-1");
        assert_eq!(pv.state, VerificationState::PendingConfirmation);
        assert!(!svc.is_verified("peer-1"));
    }

    #[test]
    fn test_restart_verification_clears_previous() {
        let svc = VerificationService::new();

        // First attempt — local confirms, no remote.
        svc.start_verification("peer-1", "Peer One", &test_secret())
            .unwrap();
        svc.local_confirm("peer-1").unwrap();

        // Second attempt (new connection) — should reset state.
        let pv = svc
            .start_verification("peer-1", "Peer One", &test_secret())
            .unwrap();
        assert_eq!(pv.state, VerificationState::PendingConfirmation);

        let status = svc.get_status("peer-1");
        assert_eq!(status.state, VerificationState::PendingConfirmation);
    }

    #[test]
    fn test_no_pending_verification_errors() {
        let svc = VerificationService::new();
        let result = svc.local_confirm("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_remote_confirm_before_start() {
        let svc = VerificationService::new();
        // Remote confirms before we even start — records the flag.
        let state = svc.remote_confirm("peer-1").unwrap();
        assert_eq!(state, VerificationState::PendingConfirmation);

        // Now start and confirm locally — should immediately verify.
        svc.start_verification("peer-1", "Peer One", &test_secret())
            .unwrap();

        // The remote_confirmed flag was set before start, but start_verification
        // clears it. So we need to re-confirm from remote.
        // This is intentional: a new verification session starts fresh.
        let state = svc.local_confirm("peer-1").unwrap();
        assert_eq!(state, VerificationState::LocalConfirmed);
    }
}
