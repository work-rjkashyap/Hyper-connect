# Hyper Connect 🚀

Seamless local device communication with modern UI and powerful features.

## ✨ Core Features

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

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Rust 1.70+
- Platform-specific dependencies:
  - **macOS**: Xcode Command Line Tools
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

## 🏗️ Architecture

### Frontend Structure
```
src/
├── components/        # React components
│   ├── DeviceList.tsx
│   ├── ChatWindow.tsx
│   ├── FileTransferPanel.tsx
│   ├── Onboarding.tsx
│   └── Header.tsx
├── context/          # React contexts
│   └── ThemeContext.tsx
├── store/            # State management
│   └── index.ts
├── types/            # TypeScript types
│   └── index.ts
└── App.tsx           # Main application
```

### Backend Structure
```
src-tauri/src/
├── discovery.rs      # mDNS device discovery
├── messaging.rs      # Message handling
├── file_transfer.rs  # File transfer logic
└── lib.rs           # Main entry point
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with [Tauri](https://tauri.app/)
- Icons from [Lucide](https://lucide.dev/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
