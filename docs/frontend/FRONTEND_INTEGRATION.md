# Frontend Integration Guide

This document details the frontend integration with the refactored Tauri + Rust backend for Hyper Connect.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Type System](#type-system)
- [State Management](#state-management)
- [Hooks](#hooks)
- [API Layer](#api-layer)
- [Event Listeners](#event-listeners)
- [Usage Examples](#usage-examples)
- [Testing](#testing)

---

## Overview

The frontend has been updated to integrate with the refactored backend, featuring:

- **Type-safe TypeScript types** matching Rust structs
- **Zustand state management** with persistence
- **Custom React hooks** for each service (identity, discovery, messaging, file transfer)
- **Event listeners** for real-time updates
- **API utilities** for Tauri command invocations
- **Helper functions** for formatting and data transformation

---

## Architecture

```
src/
├── types/
│   └── index.ts                    # TypeScript types matching Rust backend
├── store/
│   └── index.ts                    # Zustand state management
├── hooks/
│   ├── index.ts                    # Hook exports
│   ├── use-app.ts                  # Main app hook (combines all)
│   ├── use-identity.ts             # Device identity management
│   ├── use-lan-peers.ts            # mDNS discovery & device list
│   ├── use-messaging.ts            # Messaging & chat
│   └── use-file-transfer.ts        # File transfer operations
├── lib/
│   └── api.ts                      # Tauri command wrappers
└── pages/
    ├── Onboarding.tsx              # Initial setup & display name
    ├── Devices.tsx                 # Device discovery & list
    ├── Chat.tsx                    # Messaging interface
    └── Transfers.tsx               # File transfer management
```

---

## Type System

### Core Types

All types are defined in `src/types/index.ts` and match the Rust backend exactly:

#### DeviceIdentity
```typescript
interface DeviceIdentity {
  device_id: string;          // UUID v4
  display_name: string;       // User-set name
  platform: string;           // OS platform
  app_version: string;        // App version
}
```

#### Device
```typescript
interface Device {
  device_id: string;          // UUID v4
  display_name: string;       // User-set name
  hostname: string;           // Network hostname
  addresses: string[];        // IP addresses (IPv4 preferred)
  port: number;               // TCP port
  platform: string;           // OS platform
  app_version: string;        // App version
  last_seen: number;          // Timestamp (ms)
}
```

#### MessageType (Rust enum → TypeScript union)
```typescript
type MessageType =
  | { Text: { content: string } }
  | { Emoji: { emoji: string } }
  | { Reply: { content: string; reply_to: string } }
  | { File: { file_id: string; filename: string; size: number } };
```

#### Message
```typescript
interface Message {
  id: string;                 // UUID v4
  from_device_id: string;     // Sender UUID
  to_device_id: string;       // Recipient UUID
  message_type: MessageType;  // Message content
  timestamp: number;          // Timestamp (ms)
  thread_id: string | null;   // Thread ID
  read: boolean;              // Read status
}
```

#### FileTransfer
```typescript
interface FileTransfer {
  id: string;                 // Transfer UUID
  filename: string;           // File name
  file_path: string | null;   // Local file path
  size: number;               // File size (bytes)
  transferred: number;        // Bytes transferred
  status: TransferStatus;     // Current status
  from_device_id: string;     // Sender UUID
  to_device_id: string;       // Recipient UUID
  checksum: string | null;    // SHA-256 checksum
  error: string | null;       // Error message if failed
  created_at: number;         // Timestamp (ms)
  updated_at: number;         // Timestamp (ms)
  speed_bps: number;          // Transfer speed (bytes/sec)
  eta_seconds: number | null; // Estimated time remaining
}
```

### Type Guards & Helpers

```typescript
// Check message types
isTextMessage(msg: MessageType): msg is { Text: { content: string } }
isEmojiMessage(msg: MessageType): msg is { Emoji: { emoji: string } }
isReplyMessage(msg: MessageType): msg is { Reply: {...} }
isFileMessage(msg: MessageType): msg is { File: {...} }

// Extract content
getMessageContent(messageType: MessageType): string

// Formatting helpers
formatFileSize(bytes: number): string        // "1.5 MB"
formatSpeed(bps: number): string             // "2.3 MB/s"
formatETA(seconds: number | null): string    // "2m 30s"
getConversationKey(id1: string, id2: string): string // "id1_id2"
```

---

## State Management

### Zustand Store (`src/store/index.ts`)

Single centralized store with persistence via localStorage:

```typescript
const store = useAppStore();

// Identity state
store.localDeviceId: string | null
store.deviceName: string | null
store.isOnboarded: boolean
store.deviceIdentity: DeviceIdentity | null

// Discovery state
store.devices: Device[]
store.connectedDevices: Set<string>

// Messaging state
store.messages: Record<string, Message[]>  // Keyed by conversation_key
store.threads: Thread[]
store.activeThread: string | null

// File transfer state
store.transfers: FileTransfer[]
store.activeTransfers: Set<string>

// UI state
store.theme: "light" | "dark"
store.sidebarOpen: boolean
```

### Key Actions

```typescript
// Identity
setDeviceIdentity(identity: DeviceIdentity)
setOnboarded(value: boolean)

// Devices
addDevice(device: Device)
removeDevice(deviceId: string)
updateDevice(device: Device)
setDeviceConnected(deviceId: string)
setDeviceDisconnected(deviceId: string)

// Messages
addMessage(conversationKey: string, message: Message)
setMessages(conversationKey: string, messages: Message[])
markMessageAsRead(conversationKey: string, messageId: string)

// Transfers
addTransfer(transfer: FileTransfer)
updateTransfer(transferId: string, updates: Partial<FileTransfer>)
removeTransfer(transferId: string)

// Utility
reset()  // Reset entire state
```

---

## Hooks

### `useApp()` - Main Application Hook

Combines all functionality into a single hook. Use this in your main `App.tsx`:

```typescript
import { useApp } from '@/hooks';

function App() {
  const {
    identity,
    sendMessage,
    createTransfer,
    // ... all other methods
  } = useApp();

  // Hook automatically:
  // - Loads identity
  // - Starts discovery
  // - Sets up event listeners
  // - Manages connection state
}
```

**Returns:**
```typescript
{
  // Identity
  identity: DeviceIdentity | null
  loadIdentity: () => Promise<DeviceIdentity | null>
  updateDisplayName: (name: string) => Promise<boolean>
  getLocalDeviceId: () => Promise<string | null>

  // Discovery
  refreshDevices: () => Promise<void>

  // Messaging
  sendMessage: (toDeviceId: string, content: string, peerAddress: string) => Promise<Message | null>
  loadMessages: (device1: string, device2: string) => Promise<Message[]>
  loadThreads: () => Promise<Thread[]>
  markRead: (messageId: string, conversationKey: string) => Promise<void>
  markThreadRead: (threadId: string) => Promise<void>

  // File Transfer
  createTransfer: (toDeviceId: string) => Promise<FileTransfer | null>
  startTransfer: (transferId: string, peerAddress: string) => Promise<void>
  acceptTransfer: (transferId: string) => Promise<void>
  rejectTransfer: (transferId: string) => Promise<void>
  pauseTransfer: (transferId: string) => Promise<void>
  cancelTransfer: (transferId: string) => Promise<void>
  loadTransfers: () => Promise<FileTransfer[]>
}
```

### `useIdentity()` - Device Identity

```typescript
const { identity, loadIdentity, updateDisplayName } = useIdentity();

// Auto-loads identity on mount
// Sets isOnboarded if display_name is present
```

### `useLanPeers()` - Discovery

```typescript
const { refreshDevices } = useLanPeers();

// Auto-starts discovery & advertising when onboarded
// Listens for device-discovered and device-removed events
// Updates store automatically
```

### `useMessaging()` - Chat & Messages

```typescript
const {
  sendMessage,
  loadMessages,
  loadThreads,
  markRead,
  markThreadRead
} = useMessaging();

// Listens for message-sent and message-received events
// Shows toast notifications for incoming messages
// Updates store automatically
```

### `useFileTransfer()` - File Transfers

```typescript
const {
  createTransfer,
  startTransfer,
  acceptTransfer,
  rejectTransfer,
  pauseTransfer,
  cancelTransfer,
  loadTransfers
} = useFileTransfer();

// Listens for all file transfer events:
// - file-request-received
// - transfer-progress
// - transfer-completed
// - transfer-failed
// - file-cancelled
// - file-rejected
// Shows toast notifications for transfer status
// Updates store automatically
```

---

## API Layer

Type-safe wrappers around Tauri commands (`src/lib/api.ts`):

```typescript
import { api } from '@/lib/api';

// Identity
await api.identity.getDeviceInfo();
await api.identity.updateDisplayName("My Device");
await api.identity.getLocalDeviceId();

// Discovery
await api.discovery.startDiscovery();
await api.discovery.startAdvertising(8080);
await api.discovery.getDevices();
await api.discovery.getTcpPort();

// Messaging
await api.messaging.sendMessage({
  fromDeviceId: "...",
  toDeviceId: "...",
  content: "Hello!",
  peerAddress: "192.168.1.100:8080"
});
await api.messaging.getMessages(device1, device2);
await api.messaging.getThreads();
await api.messaging.markAsRead(messageId, conversationKey);
await api.messaging.markThreadAsRead(threadId);

// File Transfer
await api.fileTransfer.createTransfer({
  filename: "document.pdf",
  filePath: "/path/to/file",
  fromDeviceId: "...",
  toDeviceId: "..."
});
await api.fileTransfer.startTransfer(transferId, peerAddress);
await api.fileTransfer.acceptTransfer(transferId);
await api.fileTransfer.rejectTransfer(transferId);
await api.fileTransfer.pauseTransfer(transferId);
await api.fileTransfer.cancelTransfer(transferId);
await api.fileTransfer.getTransfers();
```

---

## Event Listeners

### Events Emitted by Backend

All events are automatically listened to by the hooks. You can also listen manually:

```typescript
import { listen } from '@tauri-apps/api/event';

// Discovery events
await listen<Device>('device-discovered', (event) => { ... });
await listen<string>('device-removed', (event) => { ... });

// Connection events
await listen<DeviceConnectedEvent>('device-connected', (event) => { ... });
await listen<DeviceDisconnectedEvent>('device-disconnected', (event) => { ... });

// Messaging events
await listen<MessageReceivedEvent>('message-received', (event) => { ... });
await listen<MessageSentEvent>('message-sent', (event) => { ... });

// File transfer events
await listen<FileRequestReceivedEvent>('file-request-received', (event) => { ... });
await listen<TransferProgressEvent>('transfer-progress', (event) => { ... });
await listen<TransferCompletedEvent>('transfer-completed', (event) => { ... });
await listen<TransferFailedEvent>('transfer-failed', (event) => { ... });
await listen<FileCancelledEvent>('file-cancelled', (event) => { ... });
await listen<FileRejectedEvent>('file-rejected', (event) => { ... });

// Security events
await listen<SecurityErrorEvent>('security-error', (event) => { ... });
```

### Event Cleanup Pattern

Always clean up event listeners in `useEffect`:

```typescript
useEffect(() => {
  let unlisten: (() => void) | undefined;

  const setup = async () => {
    unlisten = await listen('event-name', (event) => {
      // Handle event
    });
  };

  setup();

  return () => {
    if (unlisten) unlisten();
  };
}, [dependencies]);
```

---

## Usage Examples

### 1. Onboarding Flow

```typescript
// pages/Onboarding.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { useIdentity } from '@/hooks';

function Onboarding() {
  const [name, setName] = useState('');
  const { setOnboarded } = useAppStore();
  const { updateDisplayName } = useIdentity();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    // Note: updateDisplayName currently returns false (backend needs refactor)
    // For now, just set the name and mark as onboarded
    setOnboarded(true);
    navigate('/devices');
  };

  return (
    <div>
      <h1>Welcome to Hyper Connect</h1>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter your display name"
      />
      <button onClick={handleSubmit}>Get Started</button>
    </div>
  );
}
```

### 2. Device List

```typescript
// pages/Devices.tsx
import { useAppStore } from '@/store';
import { useApp } from '@/hooks';

function Devices() {
  const { devices } = useAppStore();
  const { refreshDevices } = useApp();

  return (
    <div>
      <h1>Discovered Devices ({devices.length})</h1>
      <button onClick={refreshDevices}>Refresh</button>
      
      {devices.map((device) => (
        <div key={device.device_id}>
          <h3>{device.display_name}</h3>
          <p>{device.hostname} ({device.addresses[0]})</p>
          <p>{device.platform} - {device.app_version}</p>
        </div>
      ))}
    </div>
  );
}
```

### 3. Chat Interface

```typescript
// pages/Chat.tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '@/store';
import { useApp } from '@/hooks';
import { getConversationKey, getMessageContent } from '@/types';

function Chat() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const [input, setInput] = useState('');
  const { messages, localDeviceId, devices } = useAppStore();
  const { sendMessage, loadMessages } = useApp();

  const conversationKey = localDeviceId && deviceId
    ? getConversationKey(localDeviceId, deviceId)
    : '';
  const chatMessages = messages[conversationKey] || [];
  
  const device = devices.find(d => d.device_id === deviceId);
  const peerAddress = device ? `${device.addresses[0]}:${device.port}` : '';

  useEffect(() => {
    if (localDeviceId && deviceId) {
      loadMessages(localDeviceId, deviceId);
    }
  }, [localDeviceId, deviceId, loadMessages]);

  const handleSend = async () => {
    if (!input.trim() || !deviceId || !peerAddress) return;

    await sendMessage(deviceId, input, peerAddress);
    setInput('');
  };

  return (
    <div>
      <h1>Chat with {device?.display_name}</h1>
      
      <div className="messages">
        {chatMessages.map((msg) => (
          <div key={msg.id} className={msg.from_device_id === localDeviceId ? 'sent' : 'received'}>
            {getMessageContent(msg.message_type)}
          </div>
        ))}
      </div>

      <div className="input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
```

### 4. File Transfer

```typescript
// pages/Transfers.tsx
import { useAppStore } from '@/store';
import { useApp } from '@/hooks';
import { formatFileSize, formatSpeed, formatETA } from '@/types';

function Transfers() {
  const { transfers, devices } = useAppStore();
  const {
    createTransfer,
    startTransfer,
    acceptTransfer,
    rejectTransfer,
    cancelTransfer
  } = useApp();

  const handleSendFile = async (deviceId: string) => {
    const transfer = await createTransfer(deviceId);
    if (transfer) {
      const device = devices.find(d => d.device_id === deviceId);
      if (device) {
        const peerAddress = `${device.addresses[0]}:${device.port}`;
        await startTransfer(transfer.id, peerAddress);
      }
    }
  };

  return (
    <div>
      <h1>File Transfers</h1>

      {transfers.map((transfer) => (
        <div key={transfer.id}>
          <h3>{transfer.filename}</h3>
          <p>Size: {formatFileSize(transfer.size)}</p>
          <p>Status: {transfer.status}</p>
          
          {transfer.status === 'InProgress' && (
            <>
              <progress value={transfer.transferred} max={transfer.size} />
              <p>Speed: {formatSpeed(transfer.speed_bps)}</p>
              <p>ETA: {formatETA(transfer.eta_seconds)}</p>
              <button onClick={() => cancelTransfer(transfer.id)}>Cancel</button>
            </>
          )}

          {transfer.status === 'Pending' && transfer.to_device_id === localDeviceId && (
            <>
              <button onClick={() => acceptTransfer(transfer.id)}>Accept</button>
              <button onClick={() => rejectTransfer(transfer.id)}>Reject</button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## Testing

### Manual Testing Checklist

#### Identity
- [ ] App loads identity on startup
- [ ] Display name is shown in UI
- [ ] Device ID is unique and persistent

#### Discovery
- [ ] Devices are discovered within 2 seconds
- [ ] Device list updates in real-time
- [ ] Self is not shown in device list
- [ ] IPv4 addresses are preferred

#### Messaging
- [ ] Messages can be sent between devices
- [ ] Messages appear in both sender and receiver
- [ ] Toast notifications appear for received messages
- [ ] Message history is loaded correctly
- [ ] Messages are sorted by timestamp

#### File Transfer
- [ ] File picker opens when creating transfer
- [ ] Transfer appears in both sender and receiver
- [ ] Progress updates in real-time
- [ ] Accept/Reject buttons work
- [ ] Transfer speed and ETA are shown
- [ ] Completed transfers show checksum
- [ ] Failed transfers show error message

### Integration Testing

Run two instances:

```bash
# Terminal 1
npm run tauri dev

# Terminal 2 (different port)
PORT=1421 npm run tauri dev
```

Test all functionality between the two instances.

---

## Troubleshooting

### Events not firing
- Ensure `isOnboarded` is true
- Check console for listener setup messages
- Verify backend is emitting events (check Rust logs)

### State not persisting
- Check localStorage in DevTools
- Verify `partialize` in Zustand config includes the state

### Type errors
- Ensure types match Rust backend exactly
- Check for snake_case vs camelCase mismatches
- Use type guards for MessageType

### Commands failing
- Check command registration in `src-tauri/src/lib.rs`
- Verify parameter names match Rust function signatures
- Use snake_case for parameter names (Tauri convention)

---

## Next Steps

1. **Complete Onboarding UI** - Build the initial setup flow
2. **Device Cards** - Create device list with connect buttons
3. **Chat UI** - Implement full chat interface with shadcn/ui
4. **Transfer UI** - Build file transfer interface with drag & drop
5. **Notifications** - Add system notifications for events
6. **Settings** - Add settings page for display name, theme, etc.

---

## Reference

- **Tauri Commands**: [src-tauri/src/ipc/commands.rs](src-tauri/src/ipc/commands.rs)
- **Backend Events**: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
- **Types**: [src/types/index.ts](src/types/index.ts)
- **Store**: [src/store/index.ts](src/store/index.ts)
- **Hooks**: [src/hooks/](src/hooks/)
- **API**: [src/lib/api.ts](src/lib/api.ts)