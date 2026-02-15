//! Cryptography Module
//!
//! End-to-end encryption for Hyper Connect using hybrid cryptography:
//! - X25519 (ECDH) for key exchange
//! - HKDF for key derivation
//! - AES-256-GCM for message encryption (authenticated)
//! - AES-256-CTR for file stream encryption (high performance)
//!
//! ## Security Properties
//!
//! - **Perfect Forward Secrecy**: Ephemeral keys per connection
//! - **Authenticated Encryption**: GCM mode prevents tampering
//! - **Key Separation**: Different keys for messages and files
//! - **No Key Persistence**: All keys destroyed on disconnect
//! - **Secure RNG**: Uses OS cryptographic random number generator
//!
//! ## Performance
//!
//! - Stream-based file encryption (no buffering entire files)
//! - Large buffer support (256KB+)
//! - Zero-copy operations where possible
//! - Minimal overhead (<10% throughput loss)
//!
//! ## Usage
//!
//! ```rust
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
//!
//! // Stream encrypt file
//! let (mut encryptor, iv) = stream_crypto::StreamEncryptor::new(&session, 256 * 1024);
//! encryptor.encrypt_stream(&mut file_reader, &mut network_writer).await?;
//! ```

pub mod handshake;
pub mod message_crypto;
pub mod session;
pub mod stream_crypto;

// Re-export commonly used types
pub use handshake::{HandshakeManager, HandshakeState, HelloResponse, HelloSecure};
pub use message_crypto::{
    decrypt_json, decrypt_message, encrypt_json, encrypt_message, EncryptedMessagePayload,
};
pub use session::{EncryptedMessage, FileStreamCipher, Keypair, Session};
pub use stream_crypto::{FileStreamInit, StreamDecryptor, StreamEncryptor};

/// Recommended buffer size for file streaming (256KB)
pub const STREAM_BUFFER_SIZE: usize = 256 * 1024;

/// Maximum message size (1MB - prevents DoS)
pub const MAX_MESSAGE_SIZE: usize = 1024 * 1024;

#[cfg(test)]
mod integration_tests {
    use super::*;

    #[tokio::test]
    async fn test_full_encryption_workflow() {
        // Simulate full handshake and encryption workflow
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
            .finalize_handshake("alice", &hello.public_key)
            .unwrap();

        // Message encryption
        let message = "Hello from Alice!";
        let encrypted = encrypt_message(&alice_session, message).unwrap();
        let decrypted = decrypt_message(&bob_session, &encrypted).unwrap();
        assert_eq!(message, decrypted);

        // Stream encryption
        use std::io::Cursor;
        let data = b"File content goes here...";
        let mut reader = Cursor::new(data.to_vec());
        let mut encrypted_data = Vec::new();

        let (mut encryptor, iv) = StreamEncryptor::new(&alice_session, 1024);
        encryptor
            .encrypt_stream(&mut reader, &mut encrypted_data)
            .await
            .unwrap();

        let mut encrypted_reader = Cursor::new(encrypted_data);
        let mut decrypted_data = Vec::new();
        let mut decryptor = StreamDecryptor::new(&bob_session, &iv, 1024);
        decryptor
            .decrypt_stream(&mut encrypted_reader, &mut decrypted_data)
            .await
            .unwrap();

        assert_eq!(data.as_slice(), decrypted_data.as_slice());
    }
}
