//! Secure Channel
//!
//! High-level wrapper for encrypted peer-to-peer communication.
//! Provides a simple API for establishing secure connections and encrypting/decrypting data.

use crate::crypto::{
    decrypt_message, encrypt_message, EncryptedMessagePayload, FileStreamInit, HandshakeManager,
    HelloResponse, HelloSecure, Session, StreamDecryptor, StreamEncryptor, STREAM_BUFFER_SIZE,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::sync::RwLock;

/// Secure channel manager for encrypted communications
pub struct SecureChannelManager {
    /// Handshake manager for key exchange
    pub handshake_manager: Arc<HandshakeManager>,
    /// Active sessions keyed by device ID
    pub sessions: Arc<RwLock<HashMap<String, Session>>>,
    /// Local device identity
    pub local_device_id: String,
    pub display_name: String,
    pub platform: String,
    pub app_version: String,
}

impl SecureChannelManager {
    /// Create a new secure channel manager
    pub fn new(
        local_device_id: String,
        display_name: String,
        platform: String,
        app_version: String,
    ) -> Self {
        Self {
            handshake_manager: Arc::new(HandshakeManager::new()),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            local_device_id,
            display_name,
            platform,
            app_version,
        }
    }

    /// Initiate secure handshake (as client)
    /// Returns Ok(()) - session will be established when complete_handshake is called
    pub async fn initiate_handshake<W>(
        &self,
        peer_device_id: &str,
        writer: &mut W,
    ) -> Result<(), String>
    where
        W: AsyncWrite + Unpin,
    {
        // Generate HELLO_SECURE
        let hello = self.handshake_manager.initiate_handshake(
            &self.local_device_id,
            &self.display_name,
            &self.platform,
            &self.app_version,
            peer_device_id,
        )?;

        // Send HELLO_SECURE
        let hello_json = serde_json::to_vec(&hello)
            .map_err(|e| format!("Failed to serialize HELLO_SECURE: {}", e))?;

        writer
            .write_all(&hello_json)
            .await
            .map_err(|e| format!("Failed to send HELLO_SECURE: {}", e))?;

        writer
            .flush()
            .await
            .map_err(|e| format!("Failed to flush: {}", e))?;

        println!("🔑 Sent HELLO_SECURE to {}", peer_device_id);
        Ok(())
    }

    /// Complete handshake after receiving response (as client)
    pub async fn complete_handshake<R>(
        &self,
        peer_device_id: &str,
        reader: &mut R,
    ) -> Result<Session, String>
    where
        R: AsyncRead + Unpin,
    {
        // Read HELLO_RESPONSE
        let mut buffer = vec![0u8; 4096];
        let n = reader
            .read(&mut buffer)
            .await
            .map_err(|e| format!("Failed to read HELLO_RESPONSE: {}", e))?;

        if n == 0 {
            return Err("Connection closed before receiving HELLO_RESPONSE".to_string());
        }

        let response: HelloResponse = serde_json::from_slice(&buffer[..n])
            .map_err(|e| format!("Failed to deserialize HELLO_RESPONSE: {}", e))?;

        if !response.accepted {
            return Err("Handshake rejected by peer".to_string());
        }

        // Complete handshake
        let session = self.handshake_manager.complete_handshake(response)?;

        // Store session
        self.sessions
            .write()
            .await
            .insert(peer_device_id.to_string(), session.clone());

        println!("✓ Secure session established with {}", peer_device_id);

        Ok(session)
    }

    /// Handle incoming HELLO_SECURE (as server)
    pub async fn handle_hello_secure<R, W>(
        &self,
        reader: &mut R,
        writer: &mut W,
    ) -> Result<(Session, String), String>
    where
        R: AsyncRead + Unpin,
        W: AsyncWrite + Unpin,
    {
        // Read HELLO_SECURE
        let mut buffer = vec![0u8; 4096];
        let n = reader
            .read(&mut buffer)
            .await
            .map_err(|e| format!("Failed to read HELLO_SECURE: {}", e))?;

        if n == 0 {
            return Err("Connection closed before receiving HELLO_SECURE".to_string());
        }

        let hello: HelloSecure = serde_json::from_slice(&buffer[..n])
            .map_err(|e| format!("Failed to deserialize HELLO_SECURE: {}", e))?;

        let peer_device_id = hello.device_id.clone();
        println!("🔑 Received HELLO_SECURE from {}", peer_device_id);

        // Generate response
        let response = self.handshake_manager.handle_hello_secure(
            hello.clone(),
            &self.local_device_id,
            &self.display_name,
            &self.platform,
            &self.app_version,
        )?;

        // Send response
        let response_json = serde_json::to_vec(&response)
            .map_err(|e| format!("Failed to serialize HELLO_RESPONSE: {}", e))?;

        writer
            .write_all(&response_json)
            .await
            .map_err(|e| format!("Failed to send HELLO_RESPONSE: {}", e))?;

        writer
            .flush()
            .await
            .map_err(|e| format!("Failed to flush: {}", e))?;

        // Finalize handshake
        let session = self
            .handshake_manager
            .finalize_handshake(&peer_device_id, &hello.public_key)?;

        // Store session
        self.sessions
            .write()
            .await
            .insert(peer_device_id.clone(), session.clone());

        println!("✓ Secure session established with {}", peer_device_id);

        Ok((session, peer_device_id))
    }

    /// Encrypt and send a message
    pub async fn send_encrypted_message<W>(
        &self,
        peer_device_id: &str,
        message_json: &str,
        writer: &mut W,
    ) -> Result<(), String>
    where
        W: AsyncWrite + Unpin,
    {
        // Get session
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(peer_device_id)
            .ok_or("No session for peer")?
            .clone();
        drop(sessions);

        // Encrypt message
        let encrypted = encrypt_message(&session, message_json)?;

        // Serialize encrypted payload
        let encrypted_json = serde_json::to_vec(&encrypted)
            .map_err(|e| format!("Failed to serialize encrypted message: {}", e))?;

        // Send
        writer
            .write_all(&encrypted_json)
            .await
            .map_err(|e| format!("Failed to send encrypted message: {}", e))?;

        writer
            .flush()
            .await
            .map_err(|e| format!("Failed to flush: {}", e))?;

        println!("🔒 Encrypted message sent to {}", peer_device_id);
        Ok(())
    }

    /// Receive and decrypt a message
    pub async fn receive_encrypted_message<R>(
        &self,
        peer_device_id: &str,
        reader: &mut R,
    ) -> Result<String, String>
    where
        R: AsyncRead + Unpin,
    {
        // Get session
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(peer_device_id)
            .ok_or("No session for peer")?
            .clone();
        drop(sessions);

        // Read encrypted message
        let mut buffer = vec![0u8; 1024 * 1024]; // 1MB max
        let n = reader
            .read(&mut buffer)
            .await
            .map_err(|e| format!("Failed to read message: {}", e))?;

        if n == 0 {
            return Err("Connection closed".to_string());
        }

        // Deserialize encrypted payload
        let encrypted: EncryptedMessagePayload = serde_json::from_slice(&buffer[..n])
            .map_err(|e| format!("Failed to deserialize encrypted message: {}", e))?;

        // Decrypt
        let plaintext = decrypt_message(&session, &encrypted).map_err(|e| {
            eprintln!(
                "🔒 SECURITY ERROR: Decryption failed from {}: {}",
                peer_device_id, e
            );
            format!("Decryption failed: {}", e)
        })?;

        println!("🔓 Decrypted message from {}", peer_device_id);
        Ok(plaintext)
    }

    /// Create file stream encryptor
    pub async fn create_file_encryptor(
        &self,
        peer_device_id: &str,
    ) -> Result<(StreamEncryptor, [u8; 16]), String> {
        let sessions = self.sessions.read().await;
        let session = sessions.get(peer_device_id).ok_or("No session for peer")?;

        Ok(StreamEncryptor::new(session, STREAM_BUFFER_SIZE))
    }

    /// Create file stream decryptor
    pub async fn create_file_decryptor(
        &self,
        peer_device_id: &str,
        iv: &[u8; 16],
    ) -> Result<StreamDecryptor, String> {
        let sessions = self.sessions.read().await;
        let session = sessions.get(peer_device_id).ok_or("No session for peer")?;

        Ok(StreamDecryptor::new(session, iv, STREAM_BUFFER_SIZE))
    }

    /// Send file stream initialization
    pub async fn send_file_stream_init<W>(
        &self,
        transfer_id: &str,
        iv: [u8; 16],
        file_size: u64,
        writer: &mut W,
    ) -> Result<(), String>
    where
        W: AsyncWrite + Unpin,
    {
        let init = FileStreamInit::new(transfer_id.to_string(), iv, file_size);
        let init_json =
            serde_json::to_vec(&init).map_err(|e| format!("Failed to serialize init: {}", e))?;

        writer
            .write_all(&init_json)
            .await
            .map_err(|e| format!("Failed to send init: {}", e))?;

        writer
            .flush()
            .await
            .map_err(|e| format!("Failed to flush: {}", e))?;

        Ok(())
    }

    /// Receive file stream initialization
    pub async fn receive_file_stream_init<R>(
        &self,
        reader: &mut R,
    ) -> Result<FileStreamInit, String>
    where
        R: AsyncRead + Unpin,
    {
        let mut buffer = vec![0u8; 4096];
        let n = reader
            .read(&mut buffer)
            .await
            .map_err(|e| format!("Failed to read init: {}", e))?;

        if n == 0 {
            return Err("Connection closed".to_string());
        }

        serde_json::from_slice(&buffer[..n])
            .map_err(|e| format!("Failed to deserialize init: {}", e))
    }

    /// Get session for a peer
    pub async fn get_session(&self, peer_device_id: &str) -> Option<Session> {
        self.sessions.read().await.get(peer_device_id).cloned()
    }

    /// Check if session exists
    pub async fn has_session(&self, peer_device_id: &str) -> bool {
        self.sessions.read().await.contains_key(peer_device_id)
    }

    /// Remove session (on disconnect)
    pub async fn remove_session(&self, peer_device_id: &str) {
        self.sessions.write().await.remove(peer_device_id);
        self.handshake_manager.remove_session(peer_device_id);
        println!("🔒 Session destroyed for {}", peer_device_id);
    }

    /// Get session count
    pub async fn session_count(&self) -> usize {
        self.sessions.read().await.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[tokio::test]
    async fn test_secure_channel_creation() {
        let manager = SecureChannelManager::new(
            "test-device".to_string(),
            "Test Device".to_string(),
            "linux".to_string(),
            "0.1.0".to_string(),
        );

        assert_eq!(manager.session_count().await, 0);
    }

    #[tokio::test]
    async fn test_message_encryption_roundtrip() {
        // Create two managers (simulating two devices)
        let alice = SecureChannelManager::new(
            "alice".to_string(),
            "Alice".to_string(),
            "macos".to_string(),
            "0.1.0".to_string(),
        );

        let bob = SecureChannelManager::new(
            "bob".to_string(),
            "Bob".to_string(),
            "linux".to_string(),
            "0.1.0".to_string(),
        );

        // Simulate handshake
        let mut hello_buffer = Cursor::new(Vec::new());
        alice
            .initiate_handshake("bob", &mut hello_buffer)
            .await
            .unwrap();

        let mut response_buffer = Cursor::new(Vec::new());
        let mut hello_reader = Cursor::new(hello_buffer.into_inner());
        let (_bob_session, _) = bob
            .handle_hello_secure(&mut hello_reader, &mut response_buffer)
            .await
            .unwrap();

        let mut response_reader = Cursor::new(response_buffer.into_inner());
        let _alice_session = alice
            .complete_handshake("bob", &mut response_reader)
            .await
            .unwrap();

        // Test message encryption
        let message = r#"{"type":"TEXT_MESSAGE","content":"Hello!"}"#;

        let mut encrypted_buffer = Cursor::new(Vec::new());
        alice
            .send_encrypted_message("bob", message, &mut encrypted_buffer)
            .await
            .unwrap();

        let mut encrypted_reader = Cursor::new(encrypted_buffer.into_inner());
        let decrypted = bob
            .receive_encrypted_message("alice", &mut encrypted_reader)
            .await
            .unwrap();

        assert_eq!(message, decrypted);
    }

    #[tokio::test]
    async fn test_session_management() {
        let manager = SecureChannelManager::new(
            "test".to_string(),
            "Test".to_string(),
            "linux".to_string(),
            "0.1.0".to_string(),
        );

        assert_eq!(manager.session_count().await, 0);
        assert!(!manager.has_session("peer1").await);

        // Sessions would be added through handshake in real use
        // This just tests the management API
        manager.remove_session("nonexistent").await;
        assert_eq!(manager.session_count().await, 0);
    }
}
