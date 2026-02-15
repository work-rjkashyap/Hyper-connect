//! Message Encryption
//!
//! Handles encryption and decryption of protocol messages using AES-256-GCM.
//! All control messages (TEXT_MESSAGE, FILE_REQUEST, etc.) are encrypted.

use crate::crypto::session::{EncryptedMessage, Session};
use serde::{Deserialize, Serialize};

/// Encrypted message wrapper for transmission
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedMessagePayload {
    #[serde(rename = "type")]
    pub msg_type: String, // Always "ENCRYPTED_MESSAGE"
    #[serde(with = "base64_serde")]
    pub iv: [u8; 12],
    #[serde(with = "base64_serde")]
    pub tag: [u8; 16],
    #[serde(with = "base64_bytes")]
    pub payload: Vec<u8>,
}

impl EncryptedMessagePayload {
    /// Create from encrypted message
    pub fn from_encrypted(encrypted: EncryptedMessage) -> Self {
        Self {
            msg_type: "ENCRYPTED_MESSAGE".to_string(),
            iv: encrypted.nonce,
            tag: encrypted.tag,
            payload: encrypted.payload,
        }
    }

    /// Convert to EncryptedMessage for decryption
    pub fn to_encrypted(&self) -> EncryptedMessage {
        EncryptedMessage {
            payload: self.payload.clone(),
            nonce: self.iv,
            tag: self.tag,
        }
    }
}

/// Encrypt a protocol message
///
/// # Arguments
/// * `session` - Active session with encryption keys
/// * `message_json` - JSON string of the message to encrypt
///
/// # Returns
/// Encrypted message payload ready for transmission
pub fn encrypt_message(
    session: &Session,
    message_json: &str,
) -> Result<EncryptedMessagePayload, String> {
    let plaintext = message_json.as_bytes();
    let encrypted = session.encrypt_message(plaintext)?;
    Ok(EncryptedMessagePayload::from_encrypted(encrypted))
}

/// Decrypt a protocol message
///
/// # Arguments
/// * `session` - Active session with encryption keys
/// * `encrypted_payload` - Encrypted message payload from network
///
/// # Returns
/// Decrypted JSON string
pub fn decrypt_message(
    session: &Session,
    encrypted_payload: &EncryptedMessagePayload,
) -> Result<String, String> {
    let encrypted = encrypted_payload.to_encrypted();
    let plaintext = session.decrypt_message(&encrypted)?;
    String::from_utf8(plaintext).map_err(|_| "Invalid UTF-8 in decrypted message".to_string())
}

/// Serialize and encrypt a message in one step
///
/// # Arguments
/// * `session` - Active session
/// * `message` - Any serializable message type
///
/// # Returns
/// Encrypted payload ready for transmission
pub fn encrypt_json<T: Serialize>(
    session: &Session,
    message: &T,
) -> Result<EncryptedMessagePayload, String> {
    let json = serde_json::to_string(message).map_err(|e| format!("Serialization error: {}", e))?;
    encrypt_message(session, &json)
}

/// Decrypt and deserialize a message in one step
///
/// # Arguments
/// * `session` - Active session
/// * `encrypted_payload` - Encrypted message from network
///
/// # Returns
/// Deserialized message of type T
pub fn decrypt_json<T: for<'de> Deserialize<'de>>(
    session: &Session,
    encrypted_payload: &EncryptedMessagePayload,
) -> Result<T, String> {
    let json = decrypt_message(session, encrypted_payload)?;
    serde_json::from_str(&json).map_err(|e| format!("Deserialization error: {}", e))
}

/// Helper module for base64 serialization of byte arrays
mod base64_serde {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S, const N: usize>(bytes: &[u8; N], serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let encoded = STANDARD.encode(bytes);
        serializer.serialize_str(&encoded)
    }

    pub fn deserialize<'de, D, const N: usize>(deserializer: D) -> Result<[u8; N], D::Error>
    where
        D: Deserializer<'de>,
    {
        let encoded = String::deserialize(deserializer)?;
        let decoded = STANDARD
            .decode(&encoded)
            .map_err(serde::de::Error::custom)?;

        if decoded.len() != N {
            return Err(serde::de::Error::custom(format!(
                "Invalid length: expected {}, got {}",
                N,
                decoded.len()
            )));
        }

        let mut bytes = [0u8; N];
        bytes.copy_from_slice(&decoded);
        Ok(bytes)
    }
}

/// Helper module for base64 serialization of Vec<u8>
mod base64_bytes {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(bytes: &Vec<u8>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let encoded = STANDARD.encode(bytes);
        serializer.serialize_str(&encoded)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let encoded = String::deserialize(deserializer)?;
        STANDARD.decode(&encoded).map_err(serde::de::Error::custom)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::session::{Keypair, Session};

    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    struct TestMessage {
        text: String,
        timestamp: u64,
    }

    fn create_test_session() -> (Session, Session) {
        let kp1 = Keypair::generate();
        let kp2 = Keypair::generate();
        let public1 = kp1.public_bytes();
        let public2 = kp2.public_bytes();
        let session1 = Session::from_ecdh(kp1.secret, &public2).unwrap();
        let session2 = Session::from_ecdh(kp2.secret, &public1).unwrap();
        (session1, session2)
    }

    #[test]
    fn test_encrypt_decrypt_message() {
        let (session1, session2) = create_test_session();

        let message = r#"{"type":"TEXT_MESSAGE","content":"Hello!"}"#;
        let encrypted = encrypt_message(&session1, message).unwrap();

        assert_eq!(encrypted.msg_type, "ENCRYPTED_MESSAGE");
        assert_eq!(encrypted.iv.len(), 12);
        assert_eq!(encrypted.tag.len(), 16);

        let decrypted = decrypt_message(&session2, &encrypted).unwrap();
        assert_eq!(message, decrypted);
    }

    #[test]
    fn test_encrypt_decrypt_json() {
        let (session1, session2) = create_test_session();

        let message = TestMessage {
            text: "Hello, world!".to_string(),
            timestamp: 1234567890,
        };

        let encrypted = encrypt_json(&session1, &message).unwrap();
        let decrypted: TestMessage = decrypt_json(&session2, &encrypted).unwrap();

        assert_eq!(message, decrypted);
    }

    #[test]
    fn test_tampering_detection() {
        let (session1, session2) = create_test_session();

        let message = "Secret message";
        let mut encrypted = encrypt_message(&session1, message).unwrap();

        // Tamper with payload
        if !encrypted.payload.is_empty() {
            encrypted.payload[0] ^= 0x01;
        }

        // Decryption should fail
        let result = decrypt_message(&session2, &encrypted);
        assert!(result.is_err());
    }

    #[test]
    fn test_payload_serialization() {
        let (session1, _) = create_test_session();

        let message = "Test message";
        let encrypted = encrypt_message(&session1, message).unwrap();

        // Serialize to JSON
        let json = serde_json::to_string(&encrypted).unwrap();

        // Deserialize back
        let deserialized: EncryptedMessagePayload = serde_json::from_str(&json).unwrap();

        assert_eq!(encrypted.msg_type, deserialized.msg_type);
        assert_eq!(encrypted.iv, deserialized.iv);
        assert_eq!(encrypted.tag, deserialized.tag);
        assert_eq!(encrypted.payload, deserialized.payload);
    }

    #[test]
    fn test_large_message_encryption() {
        let (session1, session2) = create_test_session();

        // Create large message (1MB)
        let large_data = "x".repeat(1024 * 1024);
        let message = TestMessage {
            text: large_data,
            timestamp: 1234567890,
        };

        let encrypted = encrypt_json(&session1, &message).unwrap();
        let decrypted: TestMessage = decrypt_json(&session2, &encrypted).unwrap();

        assert_eq!(message, decrypted);
    }

    #[test]
    fn test_empty_message() {
        let (session1, session2) = create_test_session();

        let message = "";
        let encrypted = encrypt_message(&session1, message).unwrap();
        let decrypted = decrypt_message(&session2, &encrypted).unwrap();

        assert_eq!(message, decrypted);
    }

    #[test]
    fn test_unicode_message() {
        let (session1, session2) = create_test_session();

        let message = "Hello 世界 🌍 مرحبا";
        let encrypted = encrypt_message(&session1, message).unwrap();
        let decrypted = decrypt_message(&session2, &encrypted).unwrap();

        assert_eq!(message, decrypted);
    }
}
