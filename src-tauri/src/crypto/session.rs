//! Session Key Management
//!
//! Manages ephemeral session keys for secure peer-to-peer communication.
//! Each TCP connection gets a unique session with derived encryption keys.

use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use ctr::cipher::{KeyIvInit, StreamCipher};
use hkdf::Hkdf;
use rand_core::{OsRng, RngCore};
use sha2::Sha256;
use std::sync::Arc;
use x25519_dalek::{EphemeralSecret, PublicKey};

/// Session represents a secure communication session with a peer
#[derive(Clone)]
pub struct Session {
    /// Shared secret derived from ECDH
    shared_secret: Arc<[u8; 32]>,
    /// Derived key for message encryption (AES-GCM)
    message_key: Arc<[u8; 32]>,
    /// Derived key for file stream encryption (AES-CTR)
    file_key: Arc<[u8; 32]>,
}

/// Keypair holds ephemeral keys for one connection
pub struct Keypair {
    pub secret: EphemeralSecret,
    pub public: PublicKey,
}

impl Keypair {
    /// Generate a new ephemeral X25519 keypair
    pub fn generate() -> Self {
        let secret = EphemeralSecret::random_from_rng(OsRng);
        let public = PublicKey::from(&secret);
        Self { secret, public }
    }

    /// Get the public key as bytes
    pub fn public_bytes(&self) -> [u8; 32] {
        self.public.to_bytes()
    }
}

impl Session {
    /// Create a new session from ECDH key exchange
    ///
    /// # Arguments
    /// * `our_secret` - Our ephemeral secret key
    /// * `peer_public` - Peer's public key bytes
    pub fn from_ecdh(our_secret: EphemeralSecret, peer_public: &[u8; 32]) -> Result<Self, String> {
        // Perform ECDH key exchange
        let peer_public_key = PublicKey::from(*peer_public);
        let shared_secret = our_secret.diffie_hellman(&peer_public_key);

        // Derive session keys using HKDF
        let (message_key, file_key) = Self::derive_keys(shared_secret.as_bytes())?;

        Ok(Self {
            shared_secret: Arc::new(*shared_secret.as_bytes()),
            message_key: Arc::new(message_key),
            file_key: Arc::new(file_key),
        })
    }

    /// Derive separate keys for messages and files using HKDF
    fn derive_keys(shared_secret: &[u8]) -> Result<([u8; 32], [u8; 32]), String> {
        let hkdf = Hkdf::<Sha256>::new(None, shared_secret);

        // Derive message encryption key
        let mut message_key = [0u8; 32];
        hkdf.expand(b"msg-key", &mut message_key)
            .map_err(|_| "Failed to derive message key".to_string())?;

        // Derive file encryption key
        let mut file_key = [0u8; 32];
        hkdf.expand(b"file-key", &mut file_key)
            .map_err(|_| "Failed to derive file key".to_string())?;

        Ok((message_key, file_key))
    }

    /// Encrypt a message using AES-256-GCM
    ///
    /// Returns (ciphertext, nonce, auth_tag)
    pub fn encrypt_message(&self, plaintext: &[u8]) -> Result<EncryptedMessage, String> {
        // Generate random 96-bit nonce
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Create cipher instance
        let cipher = Aes256Gcm::new_from_slice(&*self.message_key)
            .map_err(|_| "Failed to create cipher".to_string())?;

        // Encrypt and authenticate
        let ciphertext = cipher
            .encrypt(nonce, plaintext)
            .map_err(|_| "Encryption failed".to_string())?;

        // Split ciphertext and tag (last 16 bytes)
        if ciphertext.len() < 16 {
            return Err("Invalid ciphertext length".to_string());
        }
        let tag_start = ciphertext.len() - 16;
        let payload = ciphertext[..tag_start].to_vec();
        let tag = ciphertext[tag_start..].try_into().unwrap();

        Ok(EncryptedMessage {
            payload,
            nonce: nonce_bytes,
            tag,
        })
    }

    /// Decrypt a message using AES-256-GCM
    ///
    /// Verifies authentication tag and returns plaintext
    pub fn decrypt_message(&self, encrypted: &EncryptedMessage) -> Result<Vec<u8>, String> {
        let nonce = Nonce::from_slice(&encrypted.nonce);

        // Create cipher instance
        let cipher = Aes256Gcm::new_from_slice(&*self.message_key)
            .map_err(|_| "Failed to create cipher".to_string())?;

        // Reconstruct ciphertext with tag
        let mut ciphertext = encrypted.payload.clone();
        ciphertext.extend_from_slice(&encrypted.tag);

        // Decrypt and verify
        cipher
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|_| "Decryption failed - authentication tag mismatch".to_string())
    }

    /// Create a file stream encryptor (AES-256-CTR)
    ///
    /// Returns (cipher, nonce) - nonce must be sent to receiver
    pub fn create_file_encryptor(&self) -> (FileStreamCipher, [u8; 16]) {
        // Generate random 128-bit IV for CTR mode
        let mut iv = [0u8; 16];
        OsRng.fill_bytes(&mut iv);

        // Create CTR mode cipher
        type Aes256Ctr = ctr::Ctr128BE<aes::Aes256>;
        let cipher = Aes256Ctr::new_from_slices(&*self.file_key, &iv).unwrap();

        (FileStreamCipher { cipher }, iv)
    }

    /// Create a file stream decryptor (AES-256-CTR)
    ///
    /// Must use the same IV as the encryptor
    pub fn create_file_decryptor(&self, iv: &[u8; 16]) -> FileStreamCipher {
        type Aes256Ctr = ctr::Ctr128BE<aes::Aes256>;
        let cipher = Aes256Ctr::new_from_slices(&*self.file_key, iv).unwrap();
        FileStreamCipher { cipher }
    }

    /// Get a reference to the shared secret (for debugging only)
    #[cfg(test)]
    pub fn shared_secret(&self) -> &[u8; 32] {
        &self.shared_secret
    }
}

/// Encrypted message container
#[derive(Debug, Clone)]
pub struct EncryptedMessage {
    pub payload: Vec<u8>,
    pub nonce: [u8; 12],
    pub tag: [u8; 16],
}

/// File stream cipher for encryption/decryption
pub struct FileStreamCipher {
    cipher: ctr::Ctr128BE<aes::Aes256>,
}

impl FileStreamCipher {
    /// Apply cipher to buffer in-place (works for both encrypt and decrypt)
    ///
    /// This is a streaming operation - can be called multiple times for chunks
    pub fn apply(&mut self, buffer: &mut [u8]) {
        self.cipher.apply_keystream(buffer);
    }

    /// Process a buffer and return the result (convenience wrapper)
    pub fn process(&mut self, input: &[u8]) -> Vec<u8> {
        let mut output = input.to_vec();
        self.apply(&mut output);
        output
    }
}

// Ensure Session is Send + Sync for concurrent use
unsafe impl Send for Session {}
unsafe impl Sync for Session {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keypair_generation() {
        let kp1 = Keypair::generate();
        let kp2 = Keypair::generate();

        // Public keys should be different
        assert_ne!(kp1.public_bytes(), kp2.public_bytes());
    }

    #[test]
    fn test_ecdh_key_exchange() {
        // Alice and Bob generate keypairs
        let alice_kp = Keypair::generate();
        let bob_kp = Keypair::generate();

        // Store public keys before consuming secrets
        let alice_public = alice_kp.public_bytes();
        let bob_public = bob_kp.public_bytes();

        // They exchange public keys and derive sessions
        let alice_session = Session::from_ecdh(alice_kp.secret, &bob_public).unwrap();
        let bob_session = Session::from_ecdh(bob_kp.secret, &alice_public).unwrap();

        // Both should arrive at the same shared secret
        assert_eq!(alice_session.shared_secret(), bob_session.shared_secret());
    }

    #[test]
    fn test_message_encryption_decryption() {
        let kp1 = Keypair::generate();
        let kp2 = Keypair::generate();

        let public1 = kp1.public_bytes();
        let public2 = kp2.public_bytes();

        let session1 = Session::from_ecdh(kp1.secret, &public2).unwrap();
        let session2 = Session::from_ecdh(kp2.secret, &public1).unwrap();

        let plaintext = b"Hello, secure world!";
        let encrypted = session1.encrypt_message(plaintext).unwrap();
        let decrypted = session2.decrypt_message(&encrypted).unwrap();

        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }

    #[test]
    fn test_message_authentication() {
        let kp1 = Keypair::generate();
        let kp2 = Keypair::generate();

        let public1 = kp1.public_bytes();
        let public2 = kp2.public_bytes();

        let session1 = Session::from_ecdh(kp1.secret, &public2).unwrap();
        let session2 = Session::from_ecdh(kp2.secret, &public1).unwrap();

        let plaintext = b"Hello, secure world!";
        let mut encrypted = session1.encrypt_message(plaintext).unwrap();

        // Tamper with ciphertext
        encrypted.payload[0] ^= 0x01;

        // Decryption should fail due to authentication tag mismatch
        let result = session2.decrypt_message(&encrypted);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("authentication tag mismatch"));
    }

    #[test]
    fn test_file_stream_encryption() {
        let kp1 = Keypair::generate();
        let kp2 = Keypair::generate();

        let public1 = kp1.public_bytes();
        let public2 = kp2.public_bytes();

        let session1 = Session::from_ecdh(kp1.secret, &public2).unwrap();
        let session2 = Session::from_ecdh(kp2.secret, &public1).unwrap();

        // Simulate file streaming
        let chunk1 = b"First chunk of file data...";
        let chunk2 = b"Second chunk of file data...";

        // Encrypt
        let (mut encryptor, iv) = session1.create_file_encryptor();
        let encrypted1 = encryptor.process(chunk1);
        let encrypted2 = encryptor.process(chunk2);

        // Decrypt
        let mut decryptor = session2.create_file_decryptor(&iv);
        let decrypted1 = decryptor.process(&encrypted1);
        let decrypted2 = decryptor.process(&encrypted2);

        assert_eq!(chunk1.as_slice(), decrypted1.as_slice());
        assert_eq!(chunk2.as_slice(), decrypted2.as_slice());
    }

    #[test]
    fn test_key_separation() {
        let kp1 = Keypair::generate();
        let kp2 = Keypair::generate();

        let public2 = kp2.public_bytes();
        let session = Session::from_ecdh(kp1.secret, &public2).unwrap();

        // Message and file keys should be different
        assert_ne!(&*session.message_key, &*session.file_key);
    }

    #[test]
    fn test_large_buffer_encryption() {
        let kp1 = Keypair::generate();
        let kp2 = Keypair::generate();

        let public1 = kp1.public_bytes();
        let public2 = kp2.public_bytes();

        let session1 = Session::from_ecdh(kp1.secret, &public2).unwrap();
        let session2 = Session::from_ecdh(kp2.secret, &public1).unwrap();

        // Test with 256KB buffer
        let data = vec![0x42u8; 256 * 1024];

        let (mut encryptor, iv) = session1.create_file_encryptor();
        let mut encrypted = data.clone();
        encryptor.apply(&mut encrypted);

        let mut decryptor = session2.create_file_decryptor(&iv);
        decryptor.apply(&mut encrypted);

        assert_eq!(data, encrypted);
    }
}
