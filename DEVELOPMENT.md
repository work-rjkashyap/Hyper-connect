# Hyper Connect - Development Guide

This guide provides detailed information for developers working on Hyper Connect.

## 📋 Implementation Overview

### ✅ Completed Features

#### 1. Device Discovery (mDNS/Bonjour)
- **Location**: `src-tauri/src/discovery.rs`
- **Key Functions**:
  - `start_advertising()`: Broadcasts device presence on the network
  - `start_discovery()`: Listens for other devices
  - `get_devices()`: Returns list of discovered devices
- **Events Emitted**:
  - `device-discovered`: When a new device is found
  - `device-removed`: When a device leaves the network

#### 2. Real-time Messaging
- **Location**: `src-tauri/src/messaging.rs`
- **Features**:
  - Text messages with emoji support
  - Message threading
  - Reply functionality
  - Unread message tracking
  - Message history
- **Message Types**:
  - `Text`: Plain text messages
  - `Emoji`: Standalone emoji messages
  - `Reply`: Reply to existing messages
  - `File`: File transfer notifications
- **Events Emitted**:
  - `message-sent`: When a message is sent
  - `message-received`: When a message is received

#### 3. File Transfer
- **Location**: `src-tauri/src/file_transfer.rs`
- **Features**:
  - Create transfers from file paths
  - Start/pause/resume/cancel operations
  - Progress tracking (8KB chunks)
  - SHA-256 checksum verification
  - Status management
- **Transfer States**:
  - `Pending`: Transfer created but not started
  - `InProgress`: Currently transferring
  - `Paused`: Transfer paused by user
  - `Completed`: Transfer finished successfully
  - `Failed`: Transfer failed
  - `Cancelled`: Transfer cancelled by user
- **Events Emitted**:
  - `transfer-progress`: Progress updates during transfer
  - `transfer-completed`: When transfer completes
  - `transfer-failed`: When transfer fails
  - `transfer-cancelled`: When transfer is cancelled

#### 4. Auto-Update
- **Location**: `src-tauri/tauri.conf.json` (configuration)
- **Implementation**: Uses Tauri's updater plugin
- **Features**:
  - Background update checking
  - Dialog-based update installation
  - Version management
- **Note**: Requires update server configuration and signing key

#### 5. State Management
- **Location**: `src/store/index.ts`
- **Library**: Zustand
- **Managed State**:
  - Local device information
  - Discovered devices list
  - Messages and threads
  - File transfers
  - Theme preference
  - Onboarding status

#### 6. UI Components

##### DeviceList (`src/components/DeviceList.tsx`)
- Displays discovered devices
- Shows device status indicators
- Handles device selection

##### ChatWindow (`src/components/ChatWindow.tsx`)
- Real-time message display
- Message input with emoji picker
- File attachment support
- Auto-scrolling

##### FileTransferPanel (`src/components/FileTransferPanel.tsx`)
- Drag-and-drop file upload
- Transfer progress visualization
- Pause/resume/cancel controls
- File size formatting

##### Onboarding (`src/components/Onboarding.tsx`)
- Multi-step onboarding flow
- Device name configuration
- Feature introduction
- Progress indicators

##### Header (`src/components/Header.tsx`)
- App branding
- Theme toggle
- Settings access

#### 7. Theme System
- **Location**: `src/context/ThemeContext.tsx`
- **Features**:
  - Light/Dark mode switching
  - Persistent theme preference
  - System-wide theme application
- **CSS Variables**: Defined in `src/App.css` with shadcn/ui integration

## 🔧 Development Workflow

### Running the App

```bash
# Development mode with hot reload
npm run tauri dev

# Build for production
npm run tauri build

# Frontend only (for UI development)
npm run dev
```

### Testing Device Discovery

Since mDNS requires multiple devices:

1. **Option 1**: Run on multiple machines on the same network
2. **Option 2**: Use virtual machines or containers
3. **Option 3**: Mock the discovery service for UI testing

### Debugging

#### Frontend Debugging
- Open DevTools in the Tauri window (Right-click → Inspect)
- Check console for errors
- Use React DevTools extension

#### Backend Debugging
- Rust logs appear in the terminal where you ran `npm run tauri dev`
- Add `println!` or use the `log` crate for debugging
- Check `src-tauri/target/debug` for compiled binaries

### Adding New Features

#### Adding a New Rust Command

1. **Define the command in `lib.rs`**:
```rust
#[tauri::command]
fn my_new_command(param: String) -> Result<String, String> {
    // Implementation
    Ok("Success".to_string())
}
```

2. **Register in the handler**:
```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    my_new_command,
])
```

3. **Call from frontend**:
```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke<string>('my_new_command', { param: 'value' });
```

#### Adding a New UI Component

1. Create component in `src/components/`
2. Import and use in `App.tsx` or other components
3. Update `src/components/index.ts` for exports
4. Style with Tailwind CSS classes

## 🏗️ Architecture Decisions

### Why Zustand?
- Lightweight (1KB)
- Simple API
- No boilerplate
- Perfect for small to medium apps
- TypeScript-first

### Why mDNS?
- Zero-configuration networking
- Automatic device discovery
- No central server required
- Native OS support (Bonjour on macOS, Avahi on Linux, Bonjour for Windows)

### Why Tauri?
- Smaller bundle size than Electron
- Better security model
- Native performance
- Cross-platform (macOS, Windows, Linux)
- Rust backend for reliability

### File Transfer Design
- Chunk-based (8KB) for progress tracking
- Pause/resume support via file seeking
- SHA-256 checksums for integrity
- Threaded operations to prevent UI blocking

## 🐛 Common Issues

### mDNS Not Working
- **Firewall**: Ensure mDNS port (5353) is not blocked
- **Network**: Devices must be on same subnet
- **Permissions**: Some systems require special permissions for mDNS

### File Transfer Fails
- **Permissions**: Check file read/write permissions
- **Disk Space**: Ensure sufficient space on receiving device
- **Path Issues**: Use absolute paths for file operations

### Theme Not Persisting
- **Storage**: Ensure Tauri store plugin is properly configured
- **Permissions**: Check store permissions in capabilities

### Build Errors
- **Rust**: Run `cargo clean` in `src-tauri/`
- **Node**: Delete `node_modules/` and run `npm install`
- **Dependencies**: Ensure all system dependencies are installed

## 📦 Dependencies

### Frontend Dependencies
```json
{
  "zustand": "State management",
  "emoji-picker-react": "Emoji selector (not currently integrated but available)",
  "react-dropzone": "Drag-and-drop file handling",
  "date-fns": "Date formatting",
  "lucide-react": "Icon library",
  "tailwindcss": "Styling"
}
```

### Backend Dependencies
```toml
[dependencies]
mdns-sd = "0.11"           # Service discovery
tokio = "1"                # Async runtime
uuid = "1"                 # Unique identifiers
chrono = "0.4"             # Date/time handling
sha2 = "0.10"              # Checksums
base64 = "0.22"            # Encoding
tauri-plugin-store = "2"   # Local storage
tauri-plugin-updater = "2" # Auto-updates
```

## 🚀 Future Enhancements

### Potential Features
- [ ] End-to-end encryption for messages
- [ ] Group chat support
- [ ] Voice/video calling
- [ ] Screen sharing
- [ ] Cloud sync for message history
- [ ] Custom themes
- [ ] Plugin system
- [ ] Network statistics dashboard
- [ ] QR code device pairing
- [ ] Mobile companion app

### Performance Optimizations
- [ ] Message pagination
- [ ] Virtual scrolling for large lists
- [ ] WebWorker for file processing
- [ ] Lazy loading of components
- [ ] Message caching strategy

### Security Improvements
- [ ] Device authentication
- [ ] Message encryption
- [ ] File encryption for transfers
- [ ] Certificate pinning
- [ ] Permission system for actions

## 📚 Additional Resources

- [Tauri Documentation](https://tauri.app/v2/)
- [React Documentation](https://react.dev/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [mdns-sd Crate](https://docs.rs/mdns-sd/)
- [Tailwind CSS](https://tailwindcss.com/)

## 🤝 Contributing Guidelines

1. **Code Style**:
   - Frontend: Follow React best practices
   - Backend: Follow Rust conventions (`cargo fmt`)
   - Use meaningful variable names
   - Add comments for complex logic

2. **Commit Messages**:
   - Use conventional commits format
   - Example: `feat: add group chat support`
   - Example: `fix: resolve file transfer pause issue`

3. **Testing**:
   - Test on multiple OSes when possible
   - Verify device discovery works across network
   - Test file transfers with various file sizes
   - Check theme transitions

4. **Documentation**:
   - Update README for user-facing changes
   - Update this guide for developer changes
   - Add inline comments for complex code
   - Document new Tauri commands

## 📝 Notes

- The app uses port 8080 by default for mDNS advertising
- File transfers are stored in the app's data directory
- Theme preference is stored using Tauri's store plugin
- All Tauri commands are async and return Results
- Events are broadcast using Tauri's event system
