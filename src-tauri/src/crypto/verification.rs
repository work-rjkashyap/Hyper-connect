//! Short Authentication String (SAS) Verification
#![allow(dead_code)]
//!
//! Generates human-readable verification codes from ECDH shared secrets
//! so that users on both devices can visually confirm they are connected
//! to the correct peer (protection against MITM attacks on the LAN).
//!
//! ## How it works
//!
//! 1. Both devices perform X25519 ECDH and arrive at the same shared secret.
//! 2. The shared secret is fed through HKDF-SHA256 with a fixed info tag
//!    (`"sas-verification"`) to derive a deterministic verification seed.
//! 3. The seed bytes are reduced to a 6-digit numeric code formatted as
//!    `XXX-XXX` for easy verbal/visual comparison.
//!
//! Because both sides derive the code from the same shared secret, the
//! codes will match if and only if the ECDH exchange was not intercepted.

use hkdf::Hkdf;
use sha2::Sha256;
use std::fmt;

/// The info string used for HKDF expansion when deriving SAS bytes.
const SAS_INFO: &[u8] = b"hyper-connect-sas-verification-v1";

/// Number of bytes extracted from HKDF for the verification code.
/// We only need a few bytes to produce a 6-digit number.
const SAS_SEED_LEN: usize = 4;

/// A short authentication string derived from an ECDH shared secret.
///
/// The code is a 6-digit number displayed as `XXX-XXX`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerificationCode {
    /// The raw 6-digit numeric value (0 ..= 999_999).
    digits: u32,
}

impl VerificationCode {
    /// Derive a verification code from a 32-byte ECDH shared secret.
    ///
    /// Both peers calling this function with the same `shared_secret` will
    /// obtain the same `VerificationCode`.
    pub fn from_shared_secret(shared_secret: &[u8; 32]) -> Result<Self, String> {
        let hkdf = Hkdf::<Sha256>::new(None, shared_secret);

        let mut seed = [0u8; SAS_SEED_LEN];
        hkdf.expand(SAS_INFO, &mut seed)
            .map_err(|_| "HKDF expansion failed for SAS seed".to_string())?;

        // Convert the 4 seed bytes to a u32, then reduce modulo 1_000_000
        // to get a 6-digit number (zero-padded when formatted).
        let raw = u32::from_be_bytes(seed);
        let digits = raw % 1_000_000;

        Ok(Self { digits })
    }

    /// Derive a verification code from arbitrary-length key material.
    ///
    /// This is a convenience wrapper for cases where the shared secret
    /// is not exactly 32 bytes (e.g. test fixtures).
    pub fn from_key_material(key_material: &[u8]) -> Result<Self, String> {
        let hkdf = Hkdf::<Sha256>::new(None, key_material);

        let mut seed = [0u8; SAS_SEED_LEN];
        hkdf.expand(SAS_INFO, &mut seed)
            .map_err(|_| "HKDF expansion failed for SAS seed".to_string())?;

        let raw = u32::from_be_bytes(seed);
        let digits = raw % 1_000_000;

        Ok(Self { digits })
    }

    /// Return the code as a formatted string: `"XXX-XXX"`.
    pub fn formatted(&self) -> String {
        let s = format!("{:06}", self.digits);
        format!("{}-{}", &s[..3], &s[3..])
    }

    /// Return the raw 6-digit numeric value.
    pub fn digits(&self) -> u32 {
        self.digits
    }

    /// Check whether two codes match (constant-time comparison is not
    /// required here because the code is already displayed to the user,
    /// but we keep the API explicit).
    pub fn matches(&self, other: &VerificationCode) -> bool {
        self.digits == other.digits
    }

    /// Parse a formatted code string (e.g. `"482-991"`) back into a
    /// `VerificationCode`. Accepts with or without the dash separator.
    pub fn parse(input: &str) -> Result<Self, String> {
        let cleaned: String = input.chars().filter(|c| c.is_ascii_digit()).collect();
        if cleaned.len() != 6 {
            return Err(format!(
                "Verification code must be exactly 6 digits, got {}",
                cleaned.len()
            ));
        }
        let digits: u32 = cleaned
            .parse()
            .map_err(|e| format!("Invalid verification code: {}", e))?;
        Ok(Self { digits })
    }
}

impl fmt::Display for VerificationCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.formatted())
    }
}

impl serde::Serialize for VerificationCode {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.formatted())
    }
}

impl<'de> serde::Deserialize<'de> for VerificationCode {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        VerificationCode::parse(&s).map_err(serde::de::Error::custom)
    }
}

/// The current state of the verification process for a specific peer.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VerificationState {
    /// No verification has been attempted.
    None,
    /// Verification code has been generated and is awaiting user confirmation.
    PendingConfirmation,
    /// The local user confirmed the code. Waiting for the remote side.
    LocalConfirmed,
    /// Both sides confirmed — the session is verified.
    Verified,
    /// One side rejected — the codes did not match.
    Rejected,
    /// The verification process failed due to a technical error.
    Failed(String),
}

impl VerificationState {
    /// Whether this state represents a successfully verified session.
    pub fn is_verified(&self) -> bool {
        matches!(self, VerificationState::Verified)
    }

    /// Whether verification is still in progress (waiting for confirmation).
    pub fn is_pending(&self) -> bool {
        matches!(
            self,
            VerificationState::PendingConfirmation | VerificationState::LocalConfirmed
        )
    }
}

/// Holds the verification context for a single peer handshake.
#[derive(Debug, Clone)]
pub struct PeerVerification {
    /// The device ID of the peer.
    pub peer_device_id: String,
    /// The display name of the peer (for UI).
    pub peer_display_name: String,
    /// The verification code derived from the shared secret.
    pub code: VerificationCode,
    /// Current state of the verification flow.
    pub state: VerificationState,
    /// Timestamp (epoch millis) when the verification was initiated.
    pub initiated_at: u64,
}

impl PeerVerification {
    /// Create a new pending verification.
    pub fn new(
        peer_device_id: String,
        peer_display_name: String,
        shared_secret: &[u8; 32],
    ) -> Result<Self, String> {
        let code = VerificationCode::from_shared_secret(shared_secret)?;
        let initiated_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        Ok(Self {
            peer_device_id,
            peer_display_name,
            code,
            state: VerificationState::PendingConfirmation,
            initiated_at,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deterministic_code_generation() {
        let secret = [0x42u8; 32];
        let code1 = VerificationCode::from_shared_secret(&secret).unwrap();
        let code2 = VerificationCode::from_shared_secret(&secret).unwrap();
        assert_eq!(code1, code2);
        assert!(code1.matches(&code2));
    }

    #[test]
    fn test_different_secrets_produce_different_codes() {
        let secret_a = [0x42u8; 32];
        let secret_b = [0x43u8; 32];
        let code_a = VerificationCode::from_shared_secret(&secret_a).unwrap();
        let code_b = VerificationCode::from_shared_secret(&secret_b).unwrap();
        // While not guaranteed, the probability of collision is ~1 in 1M
        assert_ne!(code_a, code_b);
    }

    #[test]
    fn test_code_formatting() {
        let secret = [0x00u8; 32];
        let code = VerificationCode::from_shared_secret(&secret).unwrap();
        let formatted = code.formatted();
        assert_eq!(formatted.len(), 7); // "XXX-XXX"
        assert_eq!(&formatted[3..4], "-");
    }

    #[test]
    fn test_code_display_trait() {
        let secret = [0xFFu8; 32];
        let code = VerificationCode::from_shared_secret(&secret).unwrap();
        let display = format!("{}", code);
        assert_eq!(display, code.formatted());
    }

    #[test]
    fn test_code_parse_with_dash() {
        let code = VerificationCode::parse("482-991").unwrap();
        assert_eq!(code.digits(), 482991);
        assert_eq!(code.formatted(), "482-991");
    }

    #[test]
    fn test_code_parse_without_dash() {
        let code = VerificationCode::parse("123456").unwrap();
        assert_eq!(code.digits(), 123456);
        assert_eq!(code.formatted(), "123-456");
    }

    #[test]
    fn test_code_parse_leading_zeros() {
        let code = VerificationCode::parse("001-002").unwrap();
        assert_eq!(code.digits(), 1002);
        assert_eq!(code.formatted(), "001-002");
    }

    #[test]
    fn test_code_parse_invalid_length() {
        assert!(VerificationCode::parse("12345").is_err());
        assert!(VerificationCode::parse("1234567").is_err());
        assert!(VerificationCode::parse("").is_err());
    }

    #[test]
    fn test_code_parse_non_numeric() {
        assert!(VerificationCode::parse("abc-def").is_err());
    }

    #[test]
    fn test_code_serialization_roundtrip() {
        let code = VerificationCode::parse("482-991").unwrap();
        let json = serde_json::to_string(&code).unwrap();
        assert_eq!(json, "\"482-991\"");
        let deserialized: VerificationCode = serde_json::from_str(&json).unwrap();
        assert_eq!(code, deserialized);
    }

    #[test]
    fn test_verification_state_predicates() {
        assert!(VerificationState::Verified.is_verified());
        assert!(!VerificationState::None.is_verified());
        assert!(!VerificationState::Rejected.is_verified());

        assert!(VerificationState::PendingConfirmation.is_pending());
        assert!(VerificationState::LocalConfirmed.is_pending());
        assert!(!VerificationState::Verified.is_pending());
        assert!(!VerificationState::None.is_pending());
    }

    #[test]
    fn test_peer_verification_creation() {
        let secret = [0xABu8; 32];
        let pv = PeerVerification::new(
            "device-123".to_string(),
            "Raj-PC".to_string(),
            &secret,
        )
        .unwrap();

        assert_eq!(pv.peer_device_id, "device-123");
        assert_eq!(pv.peer_display_name, "Raj-PC");
        assert_eq!(pv.state, VerificationState::PendingConfirmation);
        assert!(pv.initiated_at > 0);
    }

    #[test]
    fn test_ecdh_produces_matching_codes() {
        // Simulate two devices doing ECDH and checking that the SAS matches
        use crate::crypto::session::Keypair;

        let alice_kp = Keypair::generate();
        let bob_kp = Keypair::generate();

        let alice_pub = alice_kp.public_bytes();
        let bob_pub = bob_kp.public_bytes();

        let alice_session =
            crate::crypto::session::Session::from_ecdh(alice_kp.secret, &bob_pub).unwrap();
        let bob_session =
            crate::crypto::session::Session::from_ecdh(bob_kp.secret, &alice_pub).unwrap();

        // Both sessions should have the same shared secret, producing the
        // same verification code. We verify indirectly via encrypt/decrypt
        // (shared_secret() is only available in #[cfg(test)]).
        let alice_code =
            VerificationCode::from_shared_secret(alice_session.shared_secret()).unwrap();
        let bob_code =
            VerificationCode::from_shared_secret(bob_session.shared_secret()).unwrap();

        assert_eq!(alice_code, bob_code);
        assert_eq!(alice_code.formatted(), bob_code.formatted());
    }

    #[test]
    fn test_verification_state_serialization() {
        let state = VerificationState::Verified;
        let json = serde_json::to_string(&state).unwrap();
        assert_eq!(json, "\"verified\"");

        let state = VerificationState::PendingConfirmation;
        let json = serde_json::to_string(&state).unwrap();
        assert_eq!(json, "\"pending_confirmation\"");

        let state = VerificationState::Failed("timeout".to_string());
        let json = serde_json::to_string(&state).unwrap();
        let deserialized: VerificationState = serde_json::from_str(&json).unwrap();
        assert_eq!(state, deserialized);
    }

    #[test]
    fn test_from_key_material() {
        let material = b"some arbitrary key material for testing";
        let code = VerificationCode::from_key_material(material).unwrap();
        let code2 = VerificationCode::from_key_material(material).unwrap();
        assert_eq!(code, code2);

        // Different material → different code
        let code3 = VerificationCode::from_key_material(b"different material").unwrap();
        assert_ne!(code, code3);
    }
}
