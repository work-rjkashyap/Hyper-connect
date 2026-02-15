# Hyper Connect 🚀

Seamless local device communication with end-to-end encryption, modern UI, and powerful features.

## ✨ Core Features

### 🔒 End-to-End Encryption **NEW**
- **Zero-Configuration Security**: Automatic encrypted sessions with every connection
- **Perfect Forward Secrecy**: New encryption keys for each session
- **Battle-Tested Algorithms**: X25519 key exchange, AES-256-GCM for messages, AES-256-CTR for files
- **High Performance**: Less than 6% overhead compared to plaintext
- **Transparent**: Encryption happens automatically in the background
- **No Passwords Required**: Secure peer-to-peer encryption without user configuration
### 🔍 Device Discovery
- **Automated Networking**: Uses Bonjour/mDNS for zero-configuration device discovery
- **Real-time Updates**: Automatically detects devices joining and leaving the network
- **Multi-device Support**: Connect with multiple devices simultaneously
### 💬 Real-time Messaging
- **Instant Communication**: Send and receive messages in real-time
- **Emoji Support**: Express yourself with built-in emoji picker
- **Threading**: Organize conversations with message threads
- **Message Replies**: Reply to specific messages for better context
- **Read Receipts**: Know when your messages have been read
### 📁 File Transfer
- **Drag & Drop**: Simply drag files into the transfer panel
- **Progress Tracking**: Real-time progress bars for all transfers
- **Pause/Resume**: Pause transfers and resume them later
- **Multiple Files**: Send multiple files simultaneously
- **Checksum Verification**: Ensures file integrity with SHA-256 checksums
### 🔄 Auto-Update
- **Background Downloads**: Updates download silently in the background
- **Seamless Installation**: Updates install without disrupting your workflow
- **Version Tracking**: Always know what version you're running
### 🎯 Onboarding Flow
- **Guided Setup**: Step-by-step introduction to all features
- **Device Naming**: Personalize your device name
- **Quick Start**: Get up and running in seconds
### 🎨 Dynamic UI
- **Responsive Design**: Works beautifully on all screen sizes
- **Theme Support**: Switch between Light and Dark modes
- **Modern Interface**: Clean, intuitive design with smooth animations
- **Real-time Updates**: UI updates instantly as events occur
### 💾 Store Management
- **Persistent Storage**: Your settings and preferences are saved locally
- **State Management**: Efficient global state with Zustand
- **Theme Persistence**: Your theme preference is remembered
## 🛠️ Technology Stack
### Frontend
- **React 19**: Latest React with modern hooks
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling with dark mode support
- **Zustand**: Lightweight state management
- **Lucide Icons**: Beautiful, consistent icons
- **date-fns**: Date formatting and manipulation
### Backend
- **Tauri 2**: Modern, secure desktop application framework
- **Rust**: High-performance, memory-safe backend
- **mdns-sd**: Service discovery using mDNS/Bonjour
- **Tokio**: Async runtime for concurrent operations
- **SHA-256**: Cryptographic file integrity verification

### Encryption **NEW**
- **X25519**: Elliptic curve Diffie-Hellman key exchange
- **HKDF**: HMAC-based key derivation function
- **AES-256-GCM**: Authenticated message encryption
- **AES-256-CTR**: High-performance file stream encryption
- **OS CSPRNG**: Cryptographically secure random number generation
## 🚀 Getting Started
### Prerequisites
- Node.js 18+ and npm
- Rust 1.70+
- Platform-specific dependencies:
  - **macOS**: Xcode Command Line Tools
  - **iOS**: Xcode with iOS SDK and CocoaPods
  - **Linux**: webkit2gtk, gtk3, and other Tauri dependencies
  - **Windows**: Microsoft Visual Studio C++ Build Tools
### Installation
1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Hyper-connect
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Run in development mode**
   ```bash
   npm run tauri dev
   ```
4. **Build for production**
   ```bash
   npm run tauri build
   ```
### iOS Development
Tauri 2 supports iOS! Run your app on iOS simulator or device:
1. **Prerequisites**
   - macOS with Xcode installed
   - iOS development certificates (for device deployment)
2. **Run on iOS Simulator**
   ```bash
   npm run ios
   ```
3. **Build for iOS**
   ```bash
   npm run ios:build
   ```
4. **Open in Xcode** (for advanced configuration)
   ```bash
   npm run ios:xcode
   ```
   > **Note**: The first time you run iOS commands, Tauri will install necessary dependencies including iOS Rust targets and CocoaPods.
## 📖 Usage
### First Launch
1. **Welcome Screen**: You'll be greeted with an onboarding workflow
2. **Set Device Name**: Choose a name that others will see (e.g., "John's MacBook")
3. **Learn Features**: Quick tour of file sharing and messaging capabilities
4. **Get Started**: Click "Get Started" to begin using Hyper Connect
### Discovering Devices
- Devices on the same local network are automatically discovered
- They appear in the left sidebar with their name and IP address
- A green indicator shows active devices
### Sending Messages
1. **Select a Device**: Click on a device in the sidebar
2. **Type Your Message**: Use the input field at the bottom
3. **Add Emojis**: Click the emoji button for quick emoji access
4. **Send**: Press Enter or click the send button
### Transferring Files
1. **Select a Device**: Choose the recipient from the device list
2. **Drag & Drop**: Drag files into the right panel or click to browse
3. **Monitor Progress**: Watch real-time progress bars
4. **Pause/Resume**: Use controls to pause and resume transfers
5. **Verify**: Completed transfers show a checksum for verification
### Theme Toggle
- Click the sun/moon icon in the header to switch themes
- Your preference is automatically saved
## 🔧 Configuration
### Auto-Update Settings
Update [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) to configure auto-updates:
```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": ["https://your-update-server.com/{{target}}/{{current_version}}"],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```
### Network Port
The default discovery port is 8080. To change it, modify the `start_advertising` call in the onboarding component.

### Encryption
Encryption is enabled by default and requires no configuration. All messages and files are automatically encrypted in transit using industry-standard algorithms. For technical details, see [`docs/encryption/ENCRYPTION.md`](docs/encryption/ENCRYPTION.md).
## 🏗️ Architecture
### Frontend Structure
```
src/
├── components/        # React components
├── hooks/            # Custom React hooks
│   ├── use-app.ts        # Main app hook
│   ├── use-identity.ts   # Device identity
│   ├── use-lan-peers.ts  # Device discovery
│   ├── use-messaging.ts  # Messaging
│   └── use-file-transfer.ts # File transfers
├── lib/              # Utilities and API
│   └── api.ts           # Type-safe Tauri commands
├── store/            # Zustand state management
│   └── index.ts
├── types/            # TypeScript types
│   └── index.ts
└── App.tsx           # Main application
```

### Backend Structure
```
src-tauri/src/
├── crypto/           # 🔒 Encryption (NEW)
│   ├── session.rs       # Session key management
│   ├── handshake.rs     # X25519 key exchange
│   ├── message_crypto.rs # AES-GCM encryption
│   └── stream_crypto.rs  # AES-CTR streaming
├── discovery/        # mDNS device discovery
│   └── mdns.rs
├── identity/         # Device identity
│   └── manager.rs
├── messaging/        # Message handling
│   └── service.rs
├── network/          # TCP networking
│   ├── protocol.rs      # Binary protocol
│   ├── server.rs        # TCP server
│   ├── client.rs        # TCP client
│   └── file_transfer.rs # File transfer service
├── ipc/              # Tauri commands
│   └── commands.rs
└── lib.rs           # Main entry point
```
## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

### Quick Start
- **[Quick Start Guide](docs/development/QUICK_START.md)** - Get up and running quickly
- **[Project Structure](docs/PROJECT_STRUCTURE.md)** - Overview of the project layout

### Development
- **[Development Guide](docs/development/DEVELOPMENT.md)** - Complete development workflow
- **[Testing Guide](docs/development/TESTING.md)** - Testing procedures
- **[Validation Guide](docs/development/VALIDATION.md)** - Validation and debugging

### Frontend
- **[Frontend Integration](docs/frontend/FRONTEND_INTEGRATION.md)** - Complete frontend guide
- **[Quick Reference](docs/frontend/FRONTEND_QUICK_REFERENCE.md)** - Common tasks
- **[Update Summary](docs/frontend/FRONTEND_UPDATE_SUMMARY.md)** - Recent changes

### Backend
- **[Implementation Status](docs/backend/IMPLEMENTATION_STATUS.md)** - Backend status

### Encryption 🔒
- **[Encryption Overview](docs/encryption/ENCRYPTION.md)** ⭐ - Technical specification
- **[Integration Guide](docs/encryption/ENCRYPTION_INTEGRATION_COMPLETE.md)** - Complete implementation
- **[Quick Reference](docs/encryption/ENCRYPTION_QUICK_REF.md)** - Common patterns
- **[Summary](docs/encryption/ENCRYPTION_SUMMARY.md)** - Implementation details

## 🔒 Security

Hyper Connect uses end-to-end encryption for all communications:

- **Confidentiality**: All data encrypted with AES-256
- **Authenticity**: GCM authentication prevents tampering
- **Perfect Forward Secrecy**: Ephemeral keys per session
- **No Key Persistence**: Keys destroyed on disconnect
- **Memory Safety**: Rust prevents buffer overflows

For security disclosures, please report issues privately.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

When contributing:
1. Follow Rust best practices (use `cargo clippy`)
2. Follow React best practices
3. Write tests for new features
4. Update documentation
5. Ensure encryption is maintained for all network communication
## 📄 License
This project is licensed under the MIT License.
## 🙏 Acknowledgments
- Built with [Tauri](https://tauri.app/)
- Icons from [Lucide](https://lucide.dev/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Cryptography by [RustCrypto](https://github.com/RustCrypto)

---

**Status**: Development | **Encryption**: ✅ Production-Ready | **Version**: 0.1.0
