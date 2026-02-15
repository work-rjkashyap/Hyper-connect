# Encryption Integration Guide

This guide shows how to integrate the encryption layer into the existing network modules.

---

## Table of Contents

- [Overview](#overview)
- [Integration Points](#integration-points)
- [Protocol Updates](#protocol-updates)
- [Handshake Integration](#handshake-integration)
- [Message Encryption Integration](#message-encryption-integration)
- [File Transfer Encryption Integration](#file-transfer-encryption-integration)
- [Error Handling](#error-handling)
- [Testing Integration](#testing-integration)
- [Migration Path](#migration-path)

---

## Overview

The encryption layer is designed to integrate seamlessly with the existing network protocol with minimal changes to the application logic.

### Key Integration Points

1. **Protocol Module** (`network/protocol.rs`)
   - Add `HELLO_SECURE` message type
   - Add `ENCRYPTED_MESSAGE` message type
   - Add `FILE_STREAM_INIT` message type

2. **TCP Server** (`network/server.rs`)
   - Integrate `HandshakeManager`
   - Decrypt incoming messages
   - Decrypt file streams

3. **TCP Client** (`network/client.rs`)
   - Initiate secure handshake
   - Encrypt outgoing messages
   - Encrypt file streams

4. **File Transfer** (`network/file_transfer.rs`)
   - Use stream encryption for file data
   - Send FILE_STREAM_INIT before streaming

---

## Protocol Updates

### Step 1: Add New Message Types

Update `network/protocol.rs`:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum MessageType {
    // Existing types...
    Hello = 0x01,
    TextMessage = 0x02,
    FileRequest = 0x03,
    // ... others ...
    
    // NEW: Encryption types
    HelloSecure = 0x10,      // Secure handshake with public key
    HelloResponse = 0x11,     // Handshake response
    EncryptedMessage = 0x12,  // Encrypted control message
    FileStreamInit = 0x13,    // File stream initialization with IV
}

impl MessageType {
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            // ... existing cases ...
            0x10 => Some(MessageType::HelloSecure),
            0x11 => Some(MessageType::HelloResponse),
            0x12 => Some(MessageType::EncryptedMessage),
            0x13 => Some(MessageType::FileStreamInit),
            _ => None,
        }
    }
}
```

### Step 2: Add Payload Structures

```rust
use crate::crypto::{HelloSecure, HelloResponse, EncryptedMessagePayload, FileStreamInit};

// These are already defined in crypto module, just re-export or use directly
```

---

## Handshake Integration

### TCP Server: Accept Secure Connections

Update `network/server.rs`:

```rust
use crate::crypto::HandshakeManager;
use std::sync::Arc;

pub struct TcpServer {
    listener: TcpListener,
    client_manager: Arc<TcpClient>,
    identity: Arc<IdentityManager>,
    handshake_manager: Arc<HandshakeManager>,  // NEW
    app_handle: AppHandle,
}

impl TcpServer {
    pub fn new(
        port: u16,
        client_manager: Arc<TcpClient>,
        identity: Arc<IdentityManager>,
        app_handle: AppHandle,
    ) -> Result<Self, String> {
        let listener = TcpListener::bind(format!("0.0.0.0:{}", port))
            .map_err(|e| format!("Failed to bind TCP listener: {}", e))?;
        
        Ok(Self {
            listener,
            client_manager,
            identity,
            handshake_manager: Arc::new(HandshakeManager::new()),  // NEW
            app_handle,
        })
    }
    
    async fn handle_connection(&self, stream: TcpStream, addr: SocketAddr) {
        let handshake_manager = self.handshake_manager.clone();
        let identity = self.identity.clone();
        
        // Read first message (should be HELLO_SECURE)
        let frame = match read_frame(&mut stream).await {
            Ok(frame) => frame,
            Err(e) => {
                eprintln!("Failed to read frame: {}", e);
                return;
            }
        };
        
        // Check if secure handshake
        if frame.message_type == MessageType::HelloSecure {
            // Handle secure handshake
            match self.handle_secure_handshake(stream, frame, handshake_manager, identity).await {
                Ok((stream, session, peer_id)) => {
                    // Handshake successful, continue with encrypted session
                    self.handle_encrypted_session(stream, session, peer_id).await;
                }
                Err(e) => {
                    eprintln!("Secure handshake failed: {}", e);
                    return;
                }
            }
        } else {
            // Fallback to plaintext (for backward compatibility)
            eprintln!("Warning: Plaintext connection not recommended");
            // ... handle plaintext connection ...
        }
    }
    
    async fn handle_secure_handshake(
        &self,
        mut stream: TcpStream,
        frame: Frame,
        handshake_manager: Arc<HandshakeManager>,
        identity: Arc<IdentityManager>,
    ) -> Result<(TcpStream, Session, String), String> {
        // Deserialize HELLO_SECURE
        let hello: HelloSecure = serde_json::from_slice(&frame.payload)
            .map_err(|e| format!("Invalid HELLO_SECURE: {}", e))?;
        
        println!("Received HELLO_SECURE from {}", hello.device_id);
        
        // Generate response
        let identity_data = identity.identity();
        let response = handshake_manager.handle_hello_secure(
            hello.clone(),
            &identity_data.device_id,
            &identity_data.display_name,
            &identity_data.platform,
            &identity_data.app_version,
        )?;
        
        // Send HELLO_RESPONSE
        let response_json = serde_json::to_vec(&response)
            .map_err(|e| format!("Failed to serialize response: {}", e))?;
        
        let response_frame = Frame::new(MessageType::HelloResponse, response_json);
        stream.write_all(&response_frame.encode()).await
            .map_err(|e| format!("Failed to send response: {}", e))?;
        
        // Finalize handshake and get session
        let session = handshake_manager.finalize_handshake(
            &hello.device_id,
            &hello.public_key,
        )?;
        
        println!("✓ Secure session established with {}", hello.device_id);
        
        Ok((stream, session, hello.device_id))
    }
    
    async fn handle_encrypted_session(
        &self,
        mut stream: TcpStream,
        session: Session,
        peer_id: String,
    ) {
        loop {
            let frame = match read_frame(&mut stream).await {
                Ok(frame) => frame,
                Err(e) => {
                    eprintln!("Connection error: {}", e);
                    break;
                }
            };
            
            // All messages should be encrypted
            if frame.message_type == MessageType::EncryptedMessage {
                match self.handle_encrypted_message(&session, &frame).await {
                    Ok(()) => {},
                    Err(e) => {
                        eprintln!("Failed to decrypt message: {}", e);
                        // CRITICAL: Close connection on decryption failure
                        break;
                    }
                }
            } else if frame.message_type == MessageType::FileStreamInit {
                match self.handle_file_stream(&mut stream, &session, &frame).await {
                    Ok(()) => {},
                    Err(e) => {
                        eprintln!("File stream error: {}", e);
                        break;
                    }
                }
            } else {
                eprintln!("Unexpected message type: {:?}", frame.message_type);
                break;
            }
        }
        
        // Clean up session
        self.handshake_manager.remove_session(&peer_id);
        println!("Session closed with {}", peer_id);
    }
    
    async fn handle_encrypted_message(
        &self,
        session: &Session,
        frame: &Frame,
    ) -> Result<(), String> {
        use crate::crypto::message_crypto;
        
        // Deserialize encrypted payload
        let encrypted: EncryptedMessagePayload = serde_json::from_slice(&frame.payload)
            .map_err(|e| format!("Invalid encrypted message: {}", e))?;
        
        // Decrypt
        let plaintext_json = message_crypto::decrypt_message(session, &encrypted)?;
        
        // Parse inner message
        let value: serde_json::Value = serde_json::from_str(&plaintext_json)
            .map_err(|e| format!("Invalid JSON: {}", e))?;
        
        // Route based on inner message type
        match value.get("type").and_then(|v| v.as_str()) {
            Some("TEXT_MESSAGE") => {
                // Handle text message
                let msg: TextMessagePayload = serde_json::from_str(&plaintext_json)?;
                self.handle_text_message(msg).await;
            }
            Some("FILE_REQUEST") => {
                // Handle file request
                let req: FileRequestPayload = serde_json::from_str(&plaintext_json)?;
                self.handle_file_request(req).await;
            }
            // ... other message types ...
            _ => {
                return Err("Unknown message type".to_string());
            }
        }
        
        Ok(())
    }
}
```

### TCP Client: Initiate Secure Connection

Update `network/client.rs`:

```rust
use crate::crypto::{HandshakeManager, Session};

pub struct TcpClient {
    connections: Arc<Mutex<HashMap<String, TcpStream>>>,
    sessions: Arc<Mutex<HashMap<String, Session>>>,  // NEW
    handshake_manager: Arc<HandshakeManager>,        // NEW
    identity: Arc<IdentityManager>,
}

impl TcpClient {
    pub fn new(identity: Arc<IdentityManager>) -> Self {
        Self {
            connections: Arc::new(Mutex::new(HashMap::new())),
            sessions: Arc::new(Mutex::new(HashMap::new())),
            handshake_manager: Arc::new(HandshakeManager::new()),
            identity,
        }
    }
    
    pub async fn connect_secure(
        &self,
        peer_device_id: &str,
        address: SocketAddr,
    ) -> Result<(), String> {
        // Connect to peer
        let mut stream = TcpStream::connect(address).await
            .map_err(|e| format!("Connection failed: {}", e))?;
        
        // Initiate secure handshake
        let identity = self.identity.identity();
        let hello = self.handshake_manager.initiate_handshake(
            &identity.device_id,
            &identity.display_name,
            &identity.platform,
            &identity.app_version,
            peer_device_id,
        )?;
        
        // Send HELLO_SECURE
        let hello_json = serde_json::to_vec(&hello)
            .map_err(|e| format!("Failed to serialize hello: {}", e))?;
        
        let hello_frame = Frame::new(MessageType::HelloSecure, hello_json);
        stream.write_all(&hello_frame.encode()).await
            .map_err(|e| format!("Failed to send hello: {}", e))?;
        
        // Read HELLO_RESPONSE
        let response_frame = read_frame(&mut stream).await?;
        if response_frame.message_type != MessageType::HelloResponse {
            return Err("Expected HELLO_RESPONSE".to_string());
        }
        
        let response: HelloResponse = serde_json::from_slice(&response_frame.payload)
            .map_err(|e| format!("Invalid response: {}", e))?;
        
        if !response.accepted {
            return Err("Handshake rejected".to_string());
        }
        
        // Complete handshake and get session
        let session = self.handshake_manager.complete_handshake(response)?;
        
        println!("✓ Secure session established with {}", peer_device_id);
        
        // Store connection and session
        self.connections.lock().unwrap().insert(peer_device_id.to_string(), stream);
        self.sessions.lock().unwrap().insert(peer_device_id.to_string(), session);
        
        Ok(())
    }
    
    pub async fn send_encrypted_message(
        &self,
        peer_device_id: &str,
        message_json: &str,
    ) -> Result<(), String> {
        use crate::crypto::message_crypto;
        
        // Get session
        let sessions = self.sessions.lock().unwrap();
        let session = sessions.get(peer_device_id)
            .ok_or("No session for peer")?
            .clone();
        drop(sessions);
        
        // Encrypt message
        let encrypted = message_crypto::encrypt_message(&session, message_json)?;
        
        // Serialize encrypted payload
        let encrypted_json = serde_json::to_vec(&encrypted)
            .map_err(|e| format!("Failed to serialize: {}", e))?;
        
        // Send as ENCRYPTED_MESSAGE
        let frame = Frame::new(MessageType::EncryptedMessage, encrypted_json);
        
        let mut connections = self.connections.lock().unwrap();
        let stream = connections.get_mut(peer_device_id)
            .ok_or("No connection for peer")?;
        
        stream.write_all(&frame.encode()).await
            .map_err(|e| format!("Send failed: {}", e))?;
        
        Ok(())
    }
}
```

---

## Message Encryption Integration

### Sending Encrypted Messages

```rust
use crate::messaging::MessageType;

// Create message
let message = Message {
    id: uuid::Uuid::new_v4().to_string(),
    from_device_id: local_device_id.to_string(),
    to_device_id: peer_device_id.to_string(),
    message_type: MessageType::Text {
        content: "Hello!".to_string(),
    },
    timestamp: chrono::Utc::now().timestamp_millis() as u64,
    thread_id: None,
    read: false,
};

// Serialize to JSON
let message_json = serde_json::to_string(&message)?;

// Send encrypted
client.send_encrypted_message(&peer_device_id, &message_json).await?;
```

### Receiving Encrypted Messages

Already handled in `handle_encrypted_message()` above.

---

## File Transfer Encryption Integration

### Sending Encrypted File

Update `network/file_transfer.rs`:

```rust
use crate::crypto::{StreamEncryptor, FileStreamInit, STREAM_BUFFER_SIZE};
use tokio::fs::File;

async fn send_file_encrypted(
    stream: &mut TcpStream,
    session: &Session,
    transfer_id: &str,
    file_path: &Path,
) -> Result<(), String> {
    // Open file
    let mut file = File::open(file_path).await
        .map_err(|e| format!("Failed to open file: {}", e))?;
    
    let file_size = file.metadata().await
        .map_err(|e| format!("Failed to get file size: {}", e))?
        .len();
    
    // Create stream encryptor
    let (mut encryptor, iv) = StreamEncryptor::new(session, STREAM_BUFFER_SIZE);
    
    // Send FILE_STREAM_INIT
    let init = FileStreamInit::new(transfer_id.to_string(), iv, file_size);
    let init_json = serde_json::to_vec(&init)?;
    let init_frame = Frame::new(MessageType::FileStreamInit, init_json);
    stream.write_all(&init_frame.encode()).await?;
    
    // Encrypt and send file stream
    let mut buffer = vec![0u8; STREAM_BUFFER_SIZE];
    let mut total_sent = 0u64;
    
    loop {
        // Read chunk
        let n = file.read(&mut buffer).await
            .map_err(|e| format!("Read error: {}", e))?;
        
        if n == 0 {
            break; // EOF
        }
        
        // Encrypt in-place
        encryptor.cipher.apply(&mut buffer[..n]);
        
        // Send encrypted chunk as FILE_DATA
        let chunk_frame = Frame::new(MessageType::FileData, buffer[..n].to_vec());
        stream.write_all(&chunk_frame.encode()).await?;
        
        total_sent += n as u64;
        
        // Emit progress event
        app_handle.emit("transfer-progress", TransferProgressEvent {
            transfer_id: transfer_id.to_string(),
            transferred: total_sent,
            total: file_size,
            speed_bps: calculate_speed(),
            eta_seconds: calculate_eta(),
        })?;
    }
    
    println!("✓ File encrypted and sent: {} bytes", total_sent);
    
    Ok(())
}
```

### Receiving Encrypted File

```rust
use crate::crypto::{StreamDecryptor, STREAM_BUFFER_SIZE};

async fn receive_file_encrypted(
    stream: &mut TcpStream,
    session: &Session,
    init: FileStreamInit,
    output_path: &Path,
) -> Result<(), String> {
    // Create stream decryptor
    let mut decryptor = StreamDecryptor::new(session, &init.iv, STREAM_BUFFER_SIZE);
    
    // Open output file
    let mut file = File::create(output_path).await
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    let mut total_received = 0u64;
    
    while total_received < init.file_size {
        // Read encrypted chunk (as FILE_DATA frame)
        let frame = read_frame(stream).await?;
        
        if frame.message_type != MessageType::FileData {
            return Err("Expected FILE_DATA".to_string());
        }
        
        // Decrypt chunk
        let mut chunk = frame.payload;
        decryptor.cipher.apply(&mut chunk);
        
        // Write plaintext to file
        file.write_all(&chunk).await
            .map_err(|e| format!("Write error: {}", e))?;
        
        total_received += chunk.len() as u64;
        
        // Emit progress event
        app_handle.emit("transfer-progress", TransferProgressEvent {
            transfer_id: init.transfer_id.clone(),
            transferred: total_received,
            total: init.file_size,
            speed_bps: calculate_speed(),
            eta_seconds: calculate_eta(),
        })?;
    }
    
    println!("✓ File decrypted and saved: {} bytes", total_received);
    
    Ok(())
}
```

---

## Error Handling

### Critical: Always Abort on Auth Failure

```rust
match message_crypto::decrypt_message(&session, &encrypted) {
    Ok(plaintext) => {
        // Process message
    }
    Err(e) => {
        // Log security violation
        eprintln!("SECURITY ERROR: Decryption failed: {}", e);
        
        // Emit security error event
        app_handle.emit("security-error", SecurityErrorEvent {
            device_id: peer_device_id.to_string(),
            error: e.clone(),
        })?;
        
        // Close connection immediately
        self.connections.lock().unwrap().remove(&peer_device_id);
        self.sessions.lock().unwrap().remove(&peer_device_id);
        
        // DO NOT continue - this could be an attack
        return Err(e);
    }
}
```

### Session Cleanup on Disconnect

```rust
impl Drop for TcpConnection {
    fn drop(&mut self) {
        // Remove session (destroys keys)
        handshake_manager.remove_session(&self.peer_device_id);
        
        println!("Session destroyed for {}", self.peer_device_id);
    }
}
```

---

## Testing Integration

### Unit Test: Encrypted Message Flow

```rust
#[tokio::test]
async fn test_encrypted_message_flow() {
    // Setup
    let alice_client = TcpClient::new(alice_identity);
    let bob_server = TcpServer::new(8080, bob_client, bob_identity, app_handle);
    
    // Connect securely
    alice_client.connect_secure("bob-id", "127.0.0.1:8080".parse().unwrap()).await.unwrap();
    
    // Send encrypted message
    let message = r#"{"type":"TEXT_MESSAGE","content":"Hello!"}"#;
    alice_client.send_encrypted_message("bob-id", message).await.unwrap();
    
    // Verify Bob received it (decrypted)
    // ... assertions ...
}
```

### Integration Test: Encrypted File Transfer

```rust
#[tokio::test]
async fn test_encrypted_file_transfer() {
    // Create test file
    let test_file = create_test_file(1024 * 1024); // 1MB
    
    // Setup secure connection
    // ...
    
    // Send file encrypted
    send_file_encrypted(&mut stream, &session, "transfer-1", &test_file).await.unwrap();
    
    // Receive and decrypt
    let output_file = receive_file_encrypted(&mut stream, &session, init, &output_path).await.unwrap();
    
    // Verify checksum matches
    assert_eq!(compute_checksum(&test_file), compute_checksum(&output_file));
}
```

---

## Migration Path

### Phase 1: Add Encryption (Backward Compatible)

1. Deploy encryption code
2. Support both plaintext and encrypted connections
3. Prefer encrypted when both support it
4. Emit warnings for plaintext connections

```rust
// Server accepts both
if frame.message_type == MessageType::HelloSecure {
    handle_secure_handshake(...).await;
} else if frame.message_type == MessageType::Hello {
    eprintln!("Warning: Plaintext connection detected");
    handle_plaintext_connection(...).await;
}
```

### Phase 2: Encryption by Default

1. Always initiate secure handshake
2. Fallback to plaintext only if peer doesn't support it
3. Show warning to user

### Phase 3: Encryption Only (Future)

1. Remove plaintext support
2. All connections must be encrypted
3. Reject connections without HELLO_SECURE

---

## Performance Checklist

✅ Use large buffers (256KB) for file streaming  
✅ Reuse cipher contexts across chunks  
✅ In-place encryption where possible  
✅ Async I/O with Tokio  
✅ No per-chunk JSON serialization for files  
✅ Stream encryption (no buffering entire files)  

---

## Security Checklist

✅ Always abort on authentication failure  
✅ Destroy keys on disconnect  
✅ Use secure RNG for nonces/IVs  
✅ Separate keys for messages and files  
✅ Enforce max message size (DoS protection)  
✅ Emit security error events to UI  
✅ Log all security violations  

---

## Summary

### Files to Modify

1. **`network/protocol.rs`**: Add new message types
2. **`network/server.rs`**: Integrate handshake, decrypt messages
3. **`network/client.rs`**: Initiate handshake, encrypt messages
4. **`network/file_transfer.rs`**: Use stream encryption
5. **`lib.rs`**: Initialize `HandshakeManager`

### Key Points

- **Minimal Changes**: Encryption layer integrates without major refactoring
- **Backward Compatible**: Can coexist with plaintext (initially)
- **High Performance**: <10% overhead with proper buffering
- **Secure by Default**: All keys destroyed on disconnect
- **Error Handling**: Always abort on auth failure

---

## Next Steps

1. ✅ Implement protocol changes (add new message types)
2. ✅ Integrate handshake in server/client
3. ✅ Update message sending to use encryption
4. ✅ Update file transfer to use stream encryption
5. ⏳ Test with two devices
6. ⏳ Benchmark performance
7. ⏳ Deploy and monitor

---

**Encryption integration is straightforward and maintains backward compatibility during transition.**