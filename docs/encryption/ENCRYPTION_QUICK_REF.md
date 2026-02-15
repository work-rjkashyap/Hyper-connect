# Encryption Quick Reference

Quick reference for using the encryption layer in Hyper Connect.

---

## Setup

```rust
use crate::crypto::{HandshakeManager, Session};

// Initialize once per application
let handshake_manager = Arc::new(HandshakeManager::new());
```

---

## Handshake (Client)

```rust
// 1. Initiate handshake
let hello = handshake_manager.initiate_handshake(
    my_device_id,
    display_name,
    platform,
    app_version,
    peer_device_id,
)?;

// 2. Serialize and send
let hello_json = serde_json::to_vec(&hello)?;
let frame = Frame::new(MessageType::HelloSecure, hello_json);
stream.write_all(&frame.encode()).await?;

// 3. Receive response
let response_frame = read_frame(&mut stream).await?;
let response: HelloResponse = serde_json::from_slice(&response_frame.payload)?;

// 4. Complete handshake
let session = handshake_manager.complete_handshake(response)?;
```

---

## Handshake (Server)

```rust
// 1. Receive HELLO_SECURE
let frame = read_frame(&mut stream).await?;
let hello: HelloSecure = serde_json::from_slice(&frame.payload)?;

// 2. Generate response
let response = handshake_manager.handle_hello_secure(
    hello.clone(),
    my_device_id,
    display_name,
    platform,
    app_version,
)?;

// 3. Send response
let response_json = serde_json::to_vec(&response)?;
let frame = Frame::new(MessageType::HelloResponse, response_json);
stream.write_all(&frame.encode()).await?;

// 4. Finalize handshake
let session = handshake_manager.finalize_handshake(
    &hello.device_id,
    &hello.public_key,
)?;
```

---

## Encrypt Message

```rust
use crate::crypto::message_crypto;

// 1. Serialize message to JSON
let message = Message { /* ... */ };
let message_json = serde_json::to_string(&message)?;

// 2. Encrypt
let encrypted = message_crypto::encrypt_message(&session, &message_json)?;

// 3. Serialize encrypted payload
let encrypted_json = serde_json::to_vec(&encrypted)?;

// 4. Send as ENCRYPTED_MESSAGE
let frame = Frame::new(MessageType::EncryptedMessage, encrypted_json);
stream.write_all(&frame.encode()).await?;
```

---

## Decrypt Message

```rust
use crate::crypto::message_crypto;

// 1. Receive ENCRYPTED_MESSAGE frame
let frame = read_frame(&mut stream).await?;

// 2. Deserialize encrypted payload
let encrypted: EncryptedMessagePayload = serde_json::from_slice(&frame.payload)?;

// 3. Decrypt
let plaintext_json = message_crypto::decrypt_message(&session, &encrypted)?;

// 4. Parse inner message
let message: Message = serde_json::from_str(&plaintext_json)?;
```

---

## Encrypt File Stream

```rust
use crate::crypto::{StreamEncryptor, FileStreamInit, STREAM_BUFFER_SIZE};
use tokio::fs::File;

// 1. Open file
let mut file = File::open(file_path).await?;
let file_size = file.metadata().await?.len();

// 2. Create encryptor
let (mut encryptor, iv) = StreamEncryptor::new(&session, STREAM_BUFFER_SIZE);

// 3. Send FILE_STREAM_INIT
let init = FileStreamInit::new(transfer_id, iv, file_size);
let init_json = serde_json::to_vec(&init)?;
let frame = Frame::new(MessageType::FileStreamInit, init_json);
stream.write_all(&frame.encode()).await?;

// 4. Stream encrypt
let mut buffer = vec![0u8; STREAM_BUFFER_SIZE];
loop {
    let n = file.read(&mut buffer).await?;
    if n == 0 { break; }
    
    // Encrypt in-place
    encryptor.cipher.apply(&mut buffer[..n]);
    
    // Send as FILE_DATA
    let frame = Frame::new(MessageType::FileData, buffer[..n].to_vec());
    stream.write_all(&frame.encode()).await?;
}
```

---

## Decrypt File Stream

```rust
use crate::crypto::{StreamDecryptor, STREAM_BUFFER_SIZE};

// 1. Receive FILE_STREAM_INIT
let frame = read_frame(&mut stream).await?;
let init: FileStreamInit = serde_json::from_slice(&frame.payload)?;

// 2. Create decryptor
let mut decryptor = StreamDecryptor::new(&session, &init.iv, STREAM_BUFFER_SIZE);

// 3. Open output file
let mut file = File::create(output_path).await?;

// 4. Stream decrypt
let mut total = 0u64;
while total < init.file_size {
    // Read FILE_DATA frame
    let frame = read_frame(&mut stream).await?;
    let mut chunk = frame.payload;
    
    // Decrypt in-place
    decryptor.cipher.apply(&mut chunk);
    
    // Write plaintext
    file.write_all(&chunk).await?;
    total += chunk.len() as u64;
}
```

---

## Session Management

```rust
// Get existing session
if let Some(session) = handshake_manager.get_session(peer_device_id) {
    // Use session
}

// Check if session exists
if handshake_manager.has_session(peer_device_id) {
    // Session active
}

// Remove session (on disconnect)
handshake_manager.remove_session(peer_device_id);

// Clear all sessions
handshake_manager.clear_all();

// Get counts
let active = handshake_manager.session_count();
let pending = handshake_manager.pending_count();
```

---

## Error Handling

```rust
// CRITICAL: Always abort on authentication failure
match message_crypto::decrypt_message(&session, &encrypted) {
    Ok(plaintext) => {
        // Process message
    }
    Err(e) => {
        eprintln!("SECURITY ERROR: {}", e);
        
        // Emit security error event
        app_handle.emit("security-error", SecurityErrorEvent {
            device_id: peer_device_id.to_string(),
            error: e.clone(),
        })?;
        
        // Close connection immediately
        handshake_manager.remove_session(peer_device_id);
        
        // DO NOT continue
        return Err(e);
    }
}
```

---

## Constants

```rust
use crate::crypto::{STREAM_BUFFER_SIZE, MAX_MESSAGE_SIZE};

// Recommended buffer size (256KB)
let buffer = vec![0u8; STREAM_BUFFER_SIZE];

// Maximum message size (1MB)
if payload.len() > MAX_MESSAGE_SIZE {
    return Err("Message too large".to_string());
}
```

---

## Protocol Message Types

```rust
#[repr(u8)]
pub enum MessageType {
    // Existing types...
    Hello = 0x01,
    TextMessage = 0x02,
    FileRequest = 0x03,
    FileData = 0x04,
    // ... others ...
    
    // NEW: Encryption types
    HelloSecure = 0x10,         // Secure handshake with public key
    HelloResponse = 0x11,       // Handshake response
    EncryptedMessage = 0x12,    // Encrypted control message
    FileStreamInit = 0x13,      // File stream initialization with IV
}
```

---

## Wire Formats

### HELLO_SECURE
```json
{
  "type": "HELLO_SECURE",
  "device_id": "uuid",
  "display_name": "Device Name",
  "platform": "macos",
  "app_version": "0.1.0",
  "public_key": "base64-32-bytes"
}
```

### HELLO_RESPONSE
```json
{
  "type": "HELLO_RESPONSE",
  "device_id": "uuid",
  "display_name": "Device Name",
  "platform": "linux",
  "app_version": "0.1.0",
  "public_key": "base64-32-bytes",
  "accepted": true
}
```

### ENCRYPTED_MESSAGE
```json
{
  "type": "ENCRYPTED_MESSAGE",
  "iv": "base64-12-bytes",
  "tag": "base64-16-bytes",
  "payload": "base64-ciphertext"
}
```

### FILE_STREAM_INIT
```json
{
  "type": "FILE_STREAM_INIT",
  "transfer_id": "uuid",
  "iv": "base64-16-bytes",
  "file_size": 104857600
}
```

---

## Common Patterns

### Store Session in Connection State

```rust
struct Connection {
    stream: TcpStream,
    peer_device_id: String,
    session: Option<Session>,
}

impl Connection {
    async fn establish_secure(&mut self, handshake_manager: &HandshakeManager) -> Result<(), String> {
        // Perform handshake...
        let session = handshake_manager.complete_handshake(response)?;
        self.session = Some(session);
        Ok(())
    }
    
    async fn send_encrypted(&mut self, message_json: &str) -> Result<(), String> {
        let session = self.session.as_ref().ok_or("No session")?;
        let encrypted = message_crypto::encrypt_message(session, message_json)?;
        // Send...
        Ok(())
    }
}

impl Drop for Connection {
    fn drop(&mut self) {
        // Session automatically destroyed when dropped
        println!("Session destroyed for {}", self.peer_device_id);
    }
}
```

---

## Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::{HandshakeManager, Keypair, Session};
    
    #[tokio::test]
    async fn test_encrypted_message_flow() {
        // Setup
        let alice_manager = HandshakeManager::new();
        let bob_manager = HandshakeManager::new();
        
        // Handshake
        let hello = alice_manager.initiate_handshake(
            "alice", "Alice", "macos", "0.1.0", "bob"
        ).unwrap();
        
        let response = bob_manager.handle_hello_secure(
            hello.clone(), "bob", "Bob", "linux", "0.1.0"
        ).unwrap();
        
        let alice_session = alice_manager.complete_handshake(response).unwrap();
        let bob_session = bob_manager.finalize_handshake(
            "alice", &hello.public_key
        ).unwrap();
        
        // Test message encryption
        let message = "Hello!";
        let encrypted = encrypt_message(&alice_session, message).unwrap();
        let decrypted = decrypt_message(&bob_session, &encrypted).unwrap();
        assert_eq!(message, decrypted);
    }
}
```

---

## Performance Tips

1. ✅ Use 256KB buffers for file streaming
2. ✅ Reuse cipher contexts across chunks
3. ✅ Encrypt in-place where possible
4. ✅ Use async I/O with Tokio
5. ✅ Don't serialize file chunks to JSON
6. ✅ Stream encryption (no buffering entire files)

---

## Security Checklist

- ✅ Always abort on authentication failure
- ✅ Destroy keys on disconnect
- ✅ Use secure RNG for nonces/IVs
- ✅ Separate keys for messages and files
- ✅ Enforce max message size (DoS protection)
- ✅ Emit security error events to UI
- ✅ Log all security violations
- ✅ Never fallback to plaintext after error

---

## Documentation

- **ENCRYPTION.md** - Complete technical documentation
- **ENCRYPTION_INTEGRATION.md** - Integration guide
- **ENCRYPTION_SUMMARY.md** - Implementation summary
- **This file** - Quick reference

---

## Dependencies

```toml
[dependencies]
x25519-dalek = { version = "2.0", features = ["static_secrets"] }
hkdf = "0.12"
aes-gcm = "0.10"
ctr = "0.9"
aes = "0.8"
rand_core = { version = "0.6", features = ["getrandom"] }
```

---

## Run Tests

```bash
cd src-tauri
cargo test crypto::
```

---

**Encryption is production-ready and awaiting integration.**