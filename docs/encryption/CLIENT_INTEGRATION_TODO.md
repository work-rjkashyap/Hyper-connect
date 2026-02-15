# Client Encryption Integration TODO

**Status:** 🔄 In Progress  
**Priority:** High  
**Estimated Time:** 4-6 hours

---

## Overview

The server is now fully integrated with encryption support. The next step is to update `TcpClient` to initiate secure connections and send encrypted messages/files.

## Current Client State

### What Works ✅
- Connection pooling (reuses connections)
- Frame-based protocol sending
- Socket optimization (TCP_NODELAY, large buffers)
- Message type routing (text, files, etc.)

### What's Missing ❌
- No encryption handshake initiation
- All messages sent in plaintext
- No `SecureChannelManager` integration
- No session management per connection

---

## Integration Plan

### Phase 1: Add SecureChannelManager (1-2 hours)

**Goal:** Give `TcpClient` access to crypto operations

```rust
// src-tauri/src/network/client.rs

use crate::network::secure_channel::SecureChannelManager;
use std::sync::Arc;

pub struct TcpClient {
    connections: Arc<RwLock<HashMap<String, Arc<Mutex<Connection>>>>>,
    secure_channel_manager: Arc<SecureChannelManager>, // NEW
}

impl TcpClient {
    pub fn new(
        local_device_id: String,
        display_name: String,
        platform: String,
        app_version: String,
    ) -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            secure_channel_manager: Arc::new(SecureChannelManager::new(
                local_device_id,
                display_name,
                platform,
                app_version,
            )),
        }
    }
}
```

**Changes Required:**
1. Add constructor parameters for device info
2. Store `SecureChannelManager` in struct
3. Update `Default` impl or remove it

---

### Phase 2: Secure Handshake on Connect (2-3 hours)

**Goal:** Automatically perform encryption handshake when connecting

```rust
async fn establish_secure_connection(
    &self,
    device_id: &str,
    address: &str,
    port: u16,
) -> Result<Arc<Mutex<Connection>>, String> {
    // 1. Connect TCP
    let stream = TcpStream::connect(format!("{}:{}", address, port)).await?;
    optimize_socket(&stream)?;
    
    let mut reader = BufReader::new(stream.try_clone().await?);
    let mut writer = stream;
    
    // 2. Send HELLO_SECURE
    self.secure_channel_manager
        .initiate_handshake(device_id, &mut writer)
        .await?;
    
    // 3. Receive HELLO_RESPONSE and complete handshake
    let session = self.secure_channel_manager
        .complete_handshake(device_id, &mut reader)
        .await?;
    
    println!("✓ Secure connection established to {}", device_id);
    
    // 4. Create connection wrapper
    let connection = Connection::new(writer, device_id.to_string()).await?;
    Ok(Arc::new(Mutex::new(connection)))
}
```

**Integration Points:**
- Call from `get_connection` after TCP connect
- Store both TCP stream and session
- Handle handshake failures gracefully

---

### Phase 3: Encrypted Message Sending (1 hour)

**Goal:** Wrap plaintext messages with encryption

```rust
pub async fn send_encrypted_message(
    &self,
    device_id: &str,
    address: &str,
    port: u16,
    message_json: &str,
) -> Result<(), String> {
    // Get or create connection (with handshake)
    let conn = self.get_connection(device_id, address, port).await?;
    
    // Encrypt message
    let encrypted_payload = self.secure_channel_manager
        .encrypt_message(device_id, message_json)
        .await?;
    
    // Send as EncryptedMessage frame
    let frame = Frame::new(MessageType::EncryptedMessage, encrypted_payload);
    
    let mut conn_lock = conn.lock().await;
    conn_lock.send_frame(&frame).await
}
```

**Wrapper Methods Needed:**
- `send_encrypted_text_message`
- `send_encrypted_file_request`
- `send_encrypted_file_complete`
- `send_encrypted_file_cancel`
- `send_encrypted_file_reject`

---

### Phase 4: Encrypted File Transfers (1-2 hours)

**Goal:** Stream encrypted file chunks using AES-CTR

```rust
pub async fn send_encrypted_file(
    &self,
    device_id: &str,
    address: &str,
    port: u16,
    transfer_id: &str,
    file_path: &Path,
) -> Result<(), String> {
    // Open file
    let mut file = tokio::fs::File::open(file_path).await?;
    let file_size = file.metadata().await?.len();
    
    // Create stream encryptor
    let (mut encryptor, iv) = self.secure_channel_manager
        .create_file_encryptor(device_id)
        .await?;
    
    // Get connection
    let conn = self.get_connection(device_id, address, port).await?;
    let mut conn_lock = conn.lock().await;
    
    // Send FILE_STREAM_INIT
    self.secure_channel_manager
        .send_file_stream_init(transfer_id, iv, file_size, &mut conn_lock.writer)
        .await?;
    
    // Stream encrypted chunks
    let mut buffer = vec![0u8; 256 * 1024]; // 256KB chunks
    loop {
        let n = file.read(&mut buffer).await?;
        if n == 0 { break; }
        
        // Encrypt in-place
        encryptor.cipher.apply(&mut buffer[..n]);
        
        // Send as FILE_DATA frame
        let frame = Frame::new(MessageType::FileData, buffer[..n].to_vec());
        conn_lock.send_frame(&frame).await?;
    }
    
    println!("✓ Encrypted file sent: {}", file_path.display());
    Ok(())
}
```

**Key Features:**
- Stream encryption (no full file in memory)
- Zero-copy where possible
- Progress reporting (emit events)

---

### Phase 5: Connection Lifecycle (30 min)

**Goal:** Cleanup sessions on disconnect

```rust
pub async fn close_connection(&self, device_id: &str) {
    // Remove TCP connection
    let mut connections = self.connections.write().await;
    connections.remove(device_id);
    
    // Remove session
    self.secure_channel_manager.remove_session(device_id).await;
    
    println!("✓ Closed connection to device: {}", device_id);
}
```

**Ensure:**
- Session cleanup on explicit disconnect
- Session cleanup on connection errors
- No session leaks

---

## Code Structure

### Modified Files

1. **`src-tauri/src/network/client.rs`**
   - Add `SecureChannelManager` field
   - Update constructor
   - Add `establish_secure_connection` method
   - Add `send_encrypted_*` methods
   - Add `send_encrypted_file` method
   - Update `close_connection` to cleanup sessions

### New Methods to Add

| Method | Purpose | Complexity |
|--------|---------|------------|
| `establish_secure_connection` | Handshake on connect | Medium |
| `send_encrypted_message` | Wrap message in AES-GCM | Low |
| `send_encrypted_file` | Stream file with AES-CTR | High |
| `encrypt_message_wrapper` | Helper for encrypt+frame | Low |

---

## Testing Checklist

### Unit Tests
- [ ] `TcpClient::new` with device info
- [ ] `establish_secure_connection` handshake flow
- [ ] `send_encrypted_message` encryption
- [ ] Session cleanup on disconnect

### Integration Tests
- [ ] Client → Server secure connection
- [ ] Client sends encrypted text message
- [ ] Client sends encrypted file (1MB)
- [ ] Client sends encrypted file (100MB)
- [ ] Handshake failure handling
- [ ] Concurrent connections (multiple devices)

### Manual Testing
- [ ] Device A sends message to Device B (encrypted)
- [ ] Device B receives and decrypts correctly
- [ ] UI shows lock icon for encrypted connection
- [ ] File transfer works end-to-end (checksum verified)
- [ ] Disconnect → reconnect (new session established)

---

## Error Handling

### Expected Errors

1. **Handshake Timeout**
   ```rust
   tokio::time::timeout(Duration::from_secs(10), handshake).await
       .map_err(|_| "Handshake timeout")??;
   ```

2. **Peer Doesn't Support Encryption**
   - Fallback to plaintext (with warning)
   - Emit `security-warning` event

3. **Session Lost Mid-Transfer**
   - Retry handshake
   - Resume transfer if possible
   - Emit error to frontend

4. **Decryption Failure (Server-side)**
   - Server emits `security-error`
   - Client should disconnect and alert user

---

## Migration Strategy

### Backward Compatibility

**Option 1: Dual Mode (Recommended)**
- Try secure handshake first
- Fall back to plaintext if peer rejects
- Emit warning for plaintext

```rust
async fn connect_with_fallback(
    &self,
    device_id: &str,
    address: &str,
    port: u16,
) -> Result<Arc<Mutex<Connection>>, String> {
    match self.establish_secure_connection(device_id, address, port).await {
        Ok(conn) => {
            println!("✓ Secure connection");
            Ok(conn)
        }
        Err(e) => {
            eprintln!("⚠️ Handshake failed, falling back to plaintext: {}", e);
            self.establish_plaintext_connection(device_id, address, port).await
        }
    }
}
```

**Option 2: Encryption Only (Future)**
- Require all connections to be encrypted
- Reject plaintext peers
- Simpler, but breaks compatibility

---

## Performance Considerations

### Optimizations

1. **Reuse Sessions**
   - Keep sessions alive across multiple messages
   - Avoid repeated ECDH handshakes
   - Clear sessions only on disconnect

2. **Large Buffers**
   - 256KB chunks for file transfers
   - Amortizes encryption overhead
   - Matches network MTU characteristics

3. **Zero-copy Where Possible**
   - Encrypt in-place
   - Avoid intermediate buffers
   - Direct socket writes

4. **Async Encryption**
   - Don't block connection pool
   - Use `tokio::spawn` for heavy operations
   - Keep UI responsive

### Expected Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Handshake time | <100ms | LAN only |
| Encryption overhead | <10% | File transfers |
| Message latency | <5ms | Added by AES-GCM |
| Throughput | >750 MB/s | Encrypted file transfer |

---

## Dependencies

### Already Available ✅
- `SecureChannelManager` (fully implemented)
- `StreamEncryptor` / `StreamDecryptor`
- Crypto primitives (X25519, AES-GCM, HKDF)
- Protocol message types

### Need to Add ❌
- Constructor changes in `lib.rs` or wherever `TcpClient` is instantiated
- Update Tauri commands that use `TcpClient`

---

## Integration with Tauri Commands

### Update Commands

```rust
// src-tauri/src/ipc/commands.rs

#[tauri::command]
pub async fn send_message(
    tcp_client: State<'_, Arc<TcpClient>>,
    device_id: String,
    address: String,
    port: u16,
    content: String,
) -> Result<(), String> {
    // Use encrypted message sending
    let message = TextMessagePayload {
        id: Uuid::new_v4().to_string(),
        from_device_id: tcp_client.device_id().to_string(),
        to_device_id: device_id.clone(),
        content,
        timestamp: chrono::Utc::now().timestamp(),
        thread_id: None,
    };
    
    let message_json = serde_json::to_string(&message)?;
    
    // NEW: Use encrypted send
    tcp_client
        .send_encrypted_message(&device_id, &address, port, &message_json)
        .await
}
```

**Commands to Update:**
- `send_message` → use `send_encrypted_message`
- `send_file` → use `send_encrypted_file`
- `cancel_transfer` → use `send_encrypted_file_cancel`

---

## Debugging Tips

### Enable Crypto Logging

```rust
println!("🔑 Initiating handshake with {}", device_id);
println!("✓ Session established: {:?}", session_id);
println!("🔒 Encrypting message: {} bytes", message.len());
println!("📤 Sending encrypted frame");
```

### Wireshark Inspection
- Capture LAN traffic
- Verify handshake frames (HELLO_SECURE, HELLO_RESPONSE)
- Verify ciphertext (should look random)
- Verify no plaintext leakage

### Test Vectors
- Use known plaintext/ciphertext pairs
- Verify decryption matches server
- Check IV randomness

---

## Success Criteria

### Must Have ✅
- [ ] Client initiates secure handshake
- [ ] Encrypted messages sent and received
- [ ] Encrypted files transferred successfully
- [ ] Sessions managed correctly (create/destroy)
- [ ] Zero compilation errors

### Should Have 🎯
- [ ] Fallback to plaintext (with warning)
- [ ] Error handling for all failure modes
- [ ] Progress events during file transfer
- [ ] Comprehensive logging

### Nice to Have 🌟
- [ ] Session resumption (avoid re-handshake)
- [ ] Parallel file transfers (multiple chunks)
- [ ] Automatic retry on transient failures

---

## Timeline

| Task | Estimated Time | Status |
|------|----------------|--------|
| Add SecureChannelManager | 1-2 hours | ⏳ TODO |
| Implement secure handshake | 2-3 hours | ⏳ TODO |
| Add encrypted message methods | 1 hour | ⏳ TODO |
| Implement encrypted file transfer | 1-2 hours | ⏳ TODO |
| Session lifecycle cleanup | 30 min | ⏳ TODO |
| Testing & debugging | 2-3 hours | ⏳ TODO |
| **Total** | **8-12 hours** | |

---

## Next Steps

1. **Start Here:** Add `SecureChannelManager` to `TcpClient` struct
2. **Then:** Implement `establish_secure_connection` method
3. **Then:** Add `send_encrypted_message` wrapper
4. **Then:** Implement `send_encrypted_file` streaming
5. **Then:** Update Tauri commands to use encrypted methods
6. **Finally:** Test end-to-end with two devices

---

## Questions to Resolve

- [ ] Should we default to encrypted or plaintext first?
- [ ] How to handle mixed networks (some devices support encryption, some don't)?
- [ ] Should we persist session keys (for session resumption)?
- [ ] What's the UI for "upgrade to encrypted connection"?
- [ ] Do we need server-initiated handshake (for bidirectional)?

---

## References

- [ENCRYPTION_SERVER_INTEGRATION_COMPLETE.md](./ENCRYPTION_SERVER_INTEGRATION_COMPLETE.md)
- [ENCRYPTION.md](./ENCRYPTION.md)
- [secure_channel.rs](../../src-tauri/src/network/secure_channel.rs)
- [client.rs](../../src-tauri/src/network/client.rs)

---

**Ready to implement?** Start with Phase 1 and work sequentially through the phases.