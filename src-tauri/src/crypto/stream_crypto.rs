//! Stream Encryption for File Transfers
//!
//! High-performance streaming encryption/decryption for file transfers using AES-256-CTR.
//! Designed for near-native LAN throughput with minimal overhead.

use crate::crypto::session::{FileStreamCipher, Session};
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

/// File stream initialization message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileStreamInit {
    #[serde(rename = "type")]
    pub msg_type: String, // Always "FILE_STREAM_INIT"
    pub transfer_id: String,
    #[serde(with = "base64_serde")]
    pub iv: [u8; 16],
    pub file_size: u64,
}

impl FileStreamInit {
    /// Create a new file stream initialization message
    pub fn new(transfer_id: String, iv: [u8; 16], file_size: u64) -> Self {
        Self {
            msg_type: "FILE_STREAM_INIT".to_string(),
            transfer_id,
            iv,
            file_size,
        }
    }
}

/// Encrypt a file stream chunk-by-chunk
///
/// This uses streaming encryption to avoid loading entire files into memory.
/// Designed for high throughput with large buffers (256KB+).
pub struct StreamEncryptor {
    cipher: FileStreamCipher,
    buffer: Vec<u8>,
}

impl StreamEncryptor {
    /// Create a new stream encryptor
    ///
    /// # Arguments
    /// * `session` - Active session with encryption keys
    /// * `buffer_size` - Size of internal buffer (recommended: 256KB)
    ///
    /// # Returns
    /// (encryptor, iv) - IV must be sent to receiver before streaming
    pub fn new(session: &Session, buffer_size: usize) -> (Self, [u8; 16]) {
        let (cipher, iv) = session.create_file_encryptor();
        let encryptor = Self {
            cipher,
            buffer: vec![0u8; buffer_size],
        };
        (encryptor, iv)
    }

    /// Encrypt and write a chunk from reader to writer
    ///
    /// # Arguments
    /// * `reader` - Source of plaintext data
    /// * `writer` - Destination for encrypted data
    ///
    /// # Returns
    /// Number of bytes processed, or 0 on EOF
    pub async fn encrypt_chunk<R, W>(
        &mut self,
        reader: &mut R,
        writer: &mut W,
    ) -> Result<usize, String>
    where
        R: AsyncRead + Unpin,
        W: AsyncWrite + Unpin,
    {
        // Read plaintext chunk
        let n = reader
            .read(&mut self.buffer)
            .await
            .map_err(|e| format!("Read error: {}", e))?;

        if n == 0 {
            return Ok(0); // EOF
        }

        // Encrypt in-place
        self.cipher.apply(&mut self.buffer[..n]);

        // Write encrypted chunk
        writer
            .write_all(&self.buffer[..n])
            .await
            .map_err(|e| format!("Write error: {}", e))?;

        Ok(n)
    }

    /// Encrypt entire stream from reader to writer
    ///
    /// # Arguments
    /// * `reader` - Source of plaintext data
    /// * `writer` - Destination for encrypted data
    ///
    /// # Returns
    /// Total bytes encrypted
    pub async fn encrypt_stream<R, W>(
        &mut self,
        reader: &mut R,
        writer: &mut W,
    ) -> Result<u64, String>
    where
        R: AsyncRead + Unpin,
        W: AsyncWrite + Unpin,
    {
        let mut total = 0u64;

        loop {
            let n = self.encrypt_chunk(reader, writer).await?;
            if n == 0 {
                break;
            }
            total += n as u64;
        }

        writer
            .flush()
            .await
            .map_err(|e| format!("Flush error: {}", e))?;

        Ok(total)
    }
}

/// Decrypt a file stream chunk-by-chunk
///
/// This uses streaming decryption to avoid loading entire files into memory.
/// Designed for high throughput with large buffers (256KB+).
pub struct StreamDecryptor {
    pub cipher: FileStreamCipher,
    buffer: Vec<u8>,
}

impl StreamDecryptor {
    /// Create a new stream decryptor
    ///
    /// # Arguments
    /// * `session` - Active session with encryption keys
    /// * `iv` - Initialization vector from sender
    /// * `buffer_size` - Size of internal buffer (recommended: 256KB)
    pub fn new(session: &Session, iv: &[u8; 16], buffer_size: usize) -> Self {
        let cipher = session.create_file_decryptor(iv);
        Self {
            cipher,
            buffer: vec![0u8; buffer_size],
        }
    }

    /// Decrypt and write a chunk from reader to writer
    ///
    /// # Arguments
    /// * `reader` - Source of encrypted data
    /// * `writer` - Destination for plaintext data
    ///
    /// # Returns
    /// Number of bytes processed, or 0 on EOF
    pub async fn decrypt_chunk<R, W>(
        &mut self,
        reader: &mut R,
        writer: &mut W,
    ) -> Result<usize, String>
    where
        R: AsyncRead + Unpin,
        W: AsyncWrite + Unpin,
    {
        // Read encrypted chunk
        let n = reader
            .read(&mut self.buffer)
            .await
            .map_err(|e| format!("Read error: {}", e))?;

        if n == 0 {
            return Ok(0); // EOF
        }

        // Decrypt in-place
        self.cipher.apply(&mut self.buffer[..n]);

        // Write plaintext chunk
        writer
            .write_all(&self.buffer[..n])
            .await
            .map_err(|e| format!("Write error: {}", e))?;

        Ok(n)
    }

    /// Decrypt entire stream from reader to writer
    ///
    /// # Arguments
    /// * `reader` - Source of encrypted data
    /// * `writer` - Destination for plaintext data
    ///
    /// # Returns
    /// Total bytes decrypted
    pub async fn decrypt_stream<R, W>(
        &mut self,
        reader: &mut R,
        writer: &mut W,
    ) -> Result<u64, String>
    where
        R: AsyncRead + Unpin,
        W: AsyncWrite + Unpin,
    {
        let mut total = 0u64;

        loop {
            let n = self.decrypt_chunk(reader, writer).await?;
            if n == 0 {
                break;
            }
            total += n as u64;
        }

        writer
            .flush()
            .await
            .map_err(|e| format!("Flush error: {}", e))?;

        Ok(total)
    }
}

/// Helper module for base64 serialization
mod base64_serde {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(bytes: &[u8; 16], serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let encoded = STANDARD.encode(bytes);
        serializer.serialize_str(&encoded)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<[u8; 16], D::Error>
    where
        D: Deserializer<'de>,
    {
        let encoded = String::deserialize(deserializer)?;
        let decoded = STANDARD
            .decode(&encoded)
            .map_err(serde::de::Error::custom)?;

        if decoded.len() != 16 {
            return Err(serde::de::Error::custom("Invalid IV length"));
        }

        let mut bytes = [0u8; 16];
        bytes.copy_from_slice(&decoded);
        Ok(bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::session::{Keypair, Session};
    use std::io::Cursor;

    fn create_test_session() -> (Session, Session) {
        let kp1 = Keypair::generate();
        let kp2 = Keypair::generate();
        let public1 = kp1.public_bytes();
        let public2 = kp2.public_bytes();
        let session1 = Session::from_ecdh(kp1.secret, &public2).unwrap();
        let session2 = Session::from_ecdh(kp2.secret, &public1).unwrap();
        (session1, session2)
    }

    #[tokio::test]
    async fn test_stream_encrypt_decrypt_small() {
        let (session1, session2) = create_test_session();

        let plaintext = b"Hello, encrypted stream!";
        let mut reader = Cursor::new(plaintext.to_vec());
        let mut encrypted = Vec::new();

        // Encrypt
        let (mut encryptor, iv) = StreamEncryptor::new(&session1, 1024);
        let encrypted_bytes = encryptor
            .encrypt_stream(&mut reader, &mut encrypted)
            .await
            .unwrap();

        assert_eq!(encrypted_bytes, plaintext.len() as u64);

        // Decrypt
        let mut encrypted_reader = Cursor::new(encrypted);
        let mut decrypted = Vec::new();
        let mut decryptor = StreamDecryptor::new(&session2, &iv, 1024);
        let decrypted_bytes = decryptor
            .decrypt_stream(&mut encrypted_reader, &mut decrypted)
            .await
            .unwrap();

        assert_eq!(decrypted_bytes, plaintext.len() as u64);
        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }

    #[tokio::test]
    async fn test_stream_encrypt_decrypt_large() {
        let (session1, session2) = create_test_session();

        // Create 1MB of test data
        let plaintext: Vec<u8> = (0..1024 * 1024).map(|i| (i % 256) as u8).collect();
        let mut reader = Cursor::new(plaintext.clone());
        let mut encrypted = Vec::new();

        // Encrypt with 256KB buffer
        let (mut encryptor, iv) = StreamEncryptor::new(&session1, 256 * 1024);
        let encrypted_bytes = encryptor
            .encrypt_stream(&mut reader, &mut encrypted)
            .await
            .unwrap();

        assert_eq!(encrypted_bytes, plaintext.len() as u64);

        // Decrypt with 256KB buffer
        let mut encrypted_reader = Cursor::new(encrypted);
        let mut decrypted = Vec::new();
        let mut decryptor = StreamDecryptor::new(&session2, &iv, 256 * 1024);
        let decrypted_bytes = decryptor
            .decrypt_stream(&mut encrypted_reader, &mut decrypted)
            .await
            .unwrap();

        assert_eq!(decrypted_bytes, plaintext.len() as u64);
        assert_eq!(plaintext, decrypted);
    }

    #[tokio::test]
    async fn test_stream_chunk_by_chunk() {
        let (session1, session2) = create_test_session();

        let plaintext = b"Chunk 1. Chunk 2. Chunk 3.";
        let mut reader = Cursor::new(plaintext.to_vec());
        let mut encrypted = Vec::new();

        // Encrypt chunk by chunk with small buffer
        let (mut encryptor, iv) = StreamEncryptor::new(&session1, 8);
        loop {
            let n = encryptor
                .encrypt_chunk(&mut reader, &mut encrypted)
                .await
                .unwrap();
            if n == 0 {
                break;
            }
        }

        // Decrypt chunk by chunk
        let mut encrypted_reader = Cursor::new(encrypted);
        let mut decrypted = Vec::new();
        let mut decryptor = StreamDecryptor::new(&session2, &iv, 8);
        loop {
            let n = decryptor
                .decrypt_chunk(&mut encrypted_reader, &mut decrypted)
                .await
                .unwrap();
            if n == 0 {
                break;
            }
        }

        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }

    #[tokio::test]
    async fn test_file_stream_init_serialization() {
        let init = FileStreamInit::new("test-transfer-id".to_string(), [0x42; 16], 1024000);

        let json = serde_json::to_string(&init).unwrap();
        let deserialized: FileStreamInit = serde_json::from_str(&json).unwrap();

        assert_eq!(init.msg_type, deserialized.msg_type);
        assert_eq!(init.transfer_id, deserialized.transfer_id);
        assert_eq!(init.iv, deserialized.iv);
        assert_eq!(init.file_size, deserialized.file_size);
    }

    #[tokio::test]
    async fn test_empty_stream() {
        let (session1, session2) = create_test_session();

        let plaintext: Vec<u8> = Vec::new();
        let mut reader = Cursor::new(plaintext.clone());
        let mut encrypted = Vec::new();

        let (mut encryptor, iv) = StreamEncryptor::new(&session1, 1024);
        let encrypted_bytes = encryptor
            .encrypt_stream(&mut reader, &mut encrypted)
            .await
            .unwrap();

        assert_eq!(encrypted_bytes, 0);
        assert_eq!(encrypted.len(), 0);

        let mut encrypted_reader = Cursor::new(encrypted);
        let mut decrypted = Vec::new();
        let mut decryptor = StreamDecryptor::new(&session2, &iv, 1024);
        let decrypted_bytes = decryptor
            .decrypt_stream(&mut encrypted_reader, &mut decrypted)
            .await
            .unwrap();

        assert_eq!(decrypted_bytes, 0);
        assert_eq!(decrypted.len(), 0);
    }

    #[tokio::test]
    async fn test_binary_data_stream() {
        let (session1, session2) = create_test_session();

        // Create binary data with all byte values
        let plaintext: Vec<u8> = (0..=255).cycle().take(10000).collect();
        let mut reader = Cursor::new(plaintext.clone());
        let mut encrypted = Vec::new();

        let (mut encryptor, iv) = StreamEncryptor::new(&session1, 2048);
        let encrypted_bytes = encryptor
            .encrypt_stream(&mut reader, &mut encrypted)
            .await
            .unwrap();

        assert_eq!(encrypted_bytes, plaintext.len() as u64);

        let mut encrypted_reader = Cursor::new(encrypted);
        let mut decrypted = Vec::new();
        let mut decryptor = StreamDecryptor::new(&session2, &iv, 2048);
        let decrypted_bytes = decryptor
            .decrypt_stream(&mut encrypted_reader, &mut decrypted)
            .await
            .unwrap();

        assert_eq!(decrypted_bytes, plaintext.len() as u64);
        assert_eq!(plaintext, decrypted);
    }
}
