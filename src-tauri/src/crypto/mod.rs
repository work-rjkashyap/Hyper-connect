//! Cryptography Module
//!
//! End-to-end encryption for Hyper Connect using hybrid cryptography:
//! - X25519 (ECDH) for key exchange
//! - HKDF for key derivation
//! - AES-256-GCM for message encryption (authenticated)
//!
//! ## Security Properties
//!
//! - **Perfect Forward Secrecy**: Ephemeral keys per connection
//! - **Authenticated Encryption**: GCM mode prevents tampering
//! - **Key Separation**: Different keys for messages and files
//! - **No Key Persistence**: All keys destroyed on disconnect
//! - **Secure RNG**: Uses OS cryptographic random number generator
//!
//! ## Usage
//!
//! ```rust,ignore
//! use crate::crypto::{HandshakeManager, session::Session};
//!
//! // Setup
//! let manager = HandshakeManager::new();
//!
//! // Initiate handshake
//! let hello = manager.initiate_handshake(
//!     "my-device-id",
//!     "My Device",
//!     "linux",
//!     "0.1.0",
//!     "peer-device-id"
//! )?;
//!
//! // Send hello to peer, receive response, complete handshake
//! let session = manager.complete_handshake(response)?;
//!
//! // Encrypt message
//! let encrypted = message_crypto::encrypt_message(&session, json_str)?;
//!
//! // Decrypt message
//! let plaintext = message_crypto::decrypt_message(&session, &encrypted)?;
//! ```

pub mod handshake;
pub mod message_crypto;
pub mod session;
pub mod tls;

// Re-export commonly used types
pub use handshake::{HandshakeManager, HelloResponse, HelloSecure};
pub use message_crypto::{decrypt_message, encrypt_message, EncryptedMessagePayload};
pub use session::Session;

#[cfg(test)]
mod integration_tests {
    use super::*;

    #[tokio::test]
    async fn test_full_encryption_workflow() {
        let alice_manager = HandshakeManager::new();
        let bob_manager = HandshakeManager::new();

        // Handshake
        let hello = alice_manager
            .initiate_handshake("alice", "Alice", "macos", "0.1.0", "bob")
            .unwrap();

        let response = bob_manager
            .handle_hello_secure(hello.clone(), "bob", "Bob", "linux", "0.1.0")
            .unwrap();

        let alice_session = alice_manager.complete_handshake(response).unwrap();
        let bob_session = bob_manager
            .finalize_handshake("alice", &hello.public_key, &hello.handshake_id)
            .unwrap();

        // Message encryption roundtrip
        let message = "Hello from Alice!";
        let encrypted = encrypt_message(&alice_session, message).unwrap();
        let decrypted = decrypt_message(&bob_session, &encrypted).unwrap();
        assert_eq!(message, decrypted);
    }
}

