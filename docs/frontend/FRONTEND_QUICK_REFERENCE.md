# Frontend Quick Reference Guide

Quick reference for common tasks in Hyper Connect frontend.

---

## Import Statements

```typescript
// Main hook (use this in App.tsx)
import { useApp } from '@/hooks';

// Individual hooks
import { useIdentity } from '@/hooks/use-identity';
import { useLanPeers } from '@/hooks/use-lan-peers';
import { useMessaging } from '@/hooks/use-messaging';
import { useFileTransfer } from '@/hooks/use-file-transfer';

// Store
import { useAppStore } from '@/store';

// API layer
import { api } from '@/lib/api';

// Types
import type { Device, Message, FileTransfer } from '@/types';

// Helpers
import { 
  getConversationKey, 
  getMessageContent,
  formatFileSize, 
  formatSpeed, 
  formatETA 
} from '@/types';
```

---

## Common Tasks

### 1. Initialize App

```typescript
// App.tsx
import { useApp } from '@/hooks';

function App() {
  useApp();  // This is all you need!
  
  return (
    <Router>
      {/* Your routes */}
    </Router>
  );
}
```

### 2. Access State

```typescript
const { 
  devices, 
  messages, 
  transfers, 
  localDeviceId,
  deviceIdentity,
  isOnboarded 
} = useAppStore();
```

### 3. Get Device List

```typescript
// From store (auto-updated)
const { devices } = useAppStore();

// Or refresh manually
const { refreshDevices } = useApp();
await refreshDevices();
```

### 4. Send Message

```typescript
const { sendMessage } = useApp();
const { devices, localDeviceId } = useAppStore();

const device = devices.find(d => d.device_id === targetDeviceId);
const peerAddress = `${device.addresses[0]}:${device.port}`;

await sendMessage(targetDeviceId, "Hello!", peerAddress);
```

### 5. Display Messages

```typescript
import { getConversationKey, getMessageContent } from '@/types';

const { messages, localDeviceId } = useAppStore();
const conversationKey = getConversationKey(localDeviceId, peerDeviceId);
const chatMessages = messages[conversationKey] || [];

return chatMessages.map(msg => (
  <div key={msg.id}>
    {getMessageContent(msg.message_type)}
  </div>
));
```

### 6. Load Message History

```typescript
const { loadMessages } = useApp();
const { localDeviceId } = useAppStore();

useEffect(() => {
  loadMessages(localDeviceId, peerDeviceId);
}, [localDeviceId, peerDeviceId]);
```

### 7. Send File

```typescript
const { createTransfer, startTransfer } = useApp();
const { devices } = useAppStore();

// Get file path from HTML input
const filePath = fileInputRef.current?.files?.[0]?.path;

// Create transfer
const transfer = await createTransfer(targetDeviceId, filePath);

// Start transfer
if (transfer) {
  const device = devices.find(d => d.device_id === targetDeviceId);
  const peerAddress = `${device.addresses[0]}:${device.port}`;
  await startTransfer(transfer.id, peerAddress);
}
```

### 8. Accept/Reject File Transfer

```typescript
const { acceptTransfer, rejectTransfer } = useApp();

// Accept
await acceptTransfer(transferId);

// Reject
await rejectTransfer(transferId);
```

### 9. Display Transfer Progress

```typescript
import { formatFileSize, formatSpeed, formatETA } from '@/types';

const { transfers } = useAppStore();

return transfers.map(transfer => (
  <div key={transfer.id}>
    <h3>{transfer.filename}</h3>
    <p>Size: {formatFileSize(transfer.size)}</p>
    <p>Status: {transfer.status}</p>
    
    {transfer.status === 'InProgress' && (
      <>
        <progress 
          value={transfer.transferred} 
          max={transfer.size} 
        />
        <p>Speed: {formatSpeed(transfer.speed_bps)}</p>
        <p>ETA: {formatETA(transfer.eta_seconds)}</p>
      </>
    )}
  </div>
));
```

### 10. Check If Device Is Connected

```typescript
const { isDeviceConnected } = useAppStore();

const connected = isDeviceConnected(deviceId);
```

### 11. Get Device Info

```typescript
const { devices } = useAppStore();

const device = devices.find(d => d.device_id === targetDeviceId);
const deviceName = device?.display_name || 'Unknown';
const deviceAddress = device?.addresses[0] || '';
const devicePort = device?.port || 8080;
```

### 12. Mark Message as Read

```typescript
const { markRead } = useApp();
const { localDeviceId } = useAppStore();

const conversationKey = getConversationKey(localDeviceId, peerDeviceId);
await markRead(messageId, conversationKey);
```

### 13. Get All Threads

```typescript
const { loadThreads } = useApp();
const { threads } = useAppStore();

useEffect(() => {
  loadThreads();
}, []);

return threads.map(thread => (
  <div key={thread.id}>
    Unread: {thread.unread_count}
  </div>
));
```

### 14. Toggle Theme

```typescript
const { theme, toggleTheme } = useAppStore();

<button onClick={toggleTheme}>
  {theme === 'dark' ? '☀️' : '🌙'}
</button>
```

### 15. Reset All State

```typescript
const { reset } = useAppStore();

// Clear everything (logout, reset, etc.)
reset();
```

---

## Type Checking

### Check Message Type

```typescript
import { isTextMessage, isEmojiMessage, isReplyMessage, isFileMessage } from '@/types';

if (isTextMessage(msg.message_type)) {
  console.log(msg.message_type.Text.content);
}

if (isFileMessage(msg.message_type)) {
  console.log(msg.message_type.File.filename);
}
```

### Get Message Content (Any Type)

```typescript
import { getMessageContent } from '@/types';

const content = getMessageContent(msg.message_type);
// Returns text content, emoji, or file name
```

---

## Direct API Calls (Without Hooks)

```typescript
import { api } from '@/lib/api';

// Identity
const identity = await api.identity.getDeviceInfo();
const deviceId = await api.identity.getLocalDeviceId();

// Discovery
await api.discovery.startDiscovery();
await api.discovery.startAdvertising(8080);
const devices = await api.discovery.getDevices();

// Messaging
const message = await api.messaging.sendMessage({
  fromDeviceId: localId,
  toDeviceId: peerId,
  content: "Hello!",
  peerAddress: "192.168.1.100:8080"
});

const messages = await api.messaging.getMessages(device1, device2);
const threads = await api.messaging.getThreads();

// File Transfer
const transfer = await api.fileTransfer.createTransfer({
  filename: "doc.pdf",
  filePath: "/path/to/file",
  fromDeviceId: localId,
  toDeviceId: peerId
});

await api.fileTransfer.startTransfer(transferId, peerAddress);
await api.fileTransfer.acceptTransfer(transferId);
await api.fileTransfer.rejectTransfer(transferId);
```

---

## Event Listeners (Manual)

```typescript
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
  let unlisten: (() => void) | undefined;

  const setup = async () => {
    unlisten = await listen<Device>('device-discovered', (event) => {
      console.log('Device discovered:', event.payload);
    });
  };

  setup();

  return () => {
    if (unlisten) unlisten();
  };
}, []);
```

**Available Events:**
- `device-discovered`
- `device-removed`
- `device-connected`
- `device-disconnected`
- `message-sent`
- `message-received`
- `file-request-received`
- `transfer-progress`
- `transfer-completed`
- `transfer-failed`
- `file-cancelled`
- `file-rejected`
- `security-error`

---

## HTML File Picker

```typescript
// For file transfers (since dialog plugin not included)
<input
  type="file"
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (file) {
      // In Tauri, file.path gives the full path
      const filePath = (file as any).path || file.name;
      createTransfer(deviceId, filePath);
    }
  }}
  style={{ display: 'none' }}
  ref={fileInputRef}
/>

<button onClick={() => fileInputRef.current?.click()}>
  Send File
</button>
```

---

## Toast Notifications

```typescript
import { toast } from '@/hooks/use-toast';

// Success
toast({
  title: "Success",
  description: "File transfer completed",
});

// Error
toast({
  title: "Error",
  description: "Failed to send message",
  variant: "destructive",
});

// With duration
toast({
  title: "Device Connected",
  description: "Connected to John's Device",
  duration: 3000,
});
```

---

## Formatting Helpers

```typescript
import { formatFileSize, formatSpeed, formatETA } from '@/types';

// File size
formatFileSize(1048576);          // "1 MB"
formatFileSize(2048);              // "2 KB"
formatFileSize(1073741824);        // "1 GB"

// Speed
formatSpeed(2097152);              // "2 MB/s"
formatSpeed(1024);                 // "1 KB/s"

// ETA
formatETA(150);                    // "2m 30s"
formatETA(3700);                   // "1h 1m"
formatETA(30);                     // "30s"
formatETA(null);                   // "Calculating..."
```

---

## Conversation Key

```typescript
import { getConversationKey } from '@/types';

// Always use this to get the conversation key
// It ensures consistent ordering (sorts IDs alphabetically)
const key = getConversationKey(deviceId1, deviceId2);

// Use it to access messages
const messages = store.messages[key] || [];
```

---

## Conditional Rendering

```typescript
const { isOnboarded, devices, localDeviceId } = useAppStore();

// Show onboarding if not setup
if (!isOnboarded) {
  return <Onboarding />;
}

// Show empty state if no devices
if (devices.length === 0) {
  return <EmptyState />;
}

// Check if we have identity
if (!localDeviceId) {
  return <Loading />;
}
```

---

## Router Setup

```typescript
import { createHashRouter } from 'react-router-dom';

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/devices" /> },
      { path: 'devices', element: <Devices /> },
      { path: 'chat/:deviceId', element: <Chat /> },
      { path: 'transfers', element: <Transfers /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
]);
```

**Note:** Use `createHashRouter` not `createBrowserRouter` (Tauri requirement)

---

## Common Patterns

### Device Card Click Handler

```typescript
const navigate = useNavigate();
const { devices } = useAppStore();

const handleDeviceClick = (deviceId: string) => {
  navigate(`/chat/${deviceId}`);
};

return devices.map(device => (
  <div 
    key={device.device_id} 
    onClick={() => handleDeviceClick(device.device_id)}
  >
    {device.display_name}
  </div>
));
```

### Chat Input Handler

```typescript
const [input, setInput] = useState('');
const { sendMessage } = useApp();

const handleSend = async () => {
  if (!input.trim()) return;
  
  await sendMessage(deviceId, input, peerAddress);
  setInput('');
};

return (
  <input
    value={input}
    onChange={(e) => setInput(e.target.value)}
    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
  />
);
```

### Transfer Action Buttons

```typescript
const { acceptTransfer, rejectTransfer, cancelTransfer } = useApp();
const { transfers, localDeviceId } = useAppStore();

return transfers.map(transfer => (
  <div key={transfer.id}>
    {/* Pending incoming transfer */}
    {transfer.status === 'Pending' && 
     transfer.to_device_id === localDeviceId && (
      <>
        <button onClick={() => acceptTransfer(transfer.id)}>
          Accept
        </button>
        <button onClick={() => rejectTransfer(transfer.id)}>
          Reject
        </button>
      </>
    )}
    
    {/* In progress transfer */}
    {transfer.status === 'InProgress' && (
      <button onClick={() => cancelTransfer(transfer.id)}>
        Cancel
      </button>
    )}
  </div>
));
```

---

## Debug Helpers

```typescript
// Log all store state
const store = useAppStore.getState();
console.log('Store:', store);

// Log specific slice
const { devices } = useAppStore();
console.log('Devices:', devices);

// Log identity
const { identity } = useApp();
console.log('Identity:', identity);

// Check if hooks are running
useEffect(() => {
  console.log('Component mounted');
  return () => console.log('Component unmounted');
}, []);
```

---

## Performance Tips

1. **Use selectors** - Only subscribe to what you need:
   ```typescript
   const devices = useAppStore(state => state.devices);
   ```

2. **Memoize expensive operations**:
   ```typescript
   const sortedDevices = useMemo(
     () => devices.sort((a, b) => a.display_name.localeCompare(b.display_name)),
     [devices]
   );
   ```

3. **Debounce rapid updates**:
   ```typescript
   const debouncedSearch = useMemo(
     () => debounce((value) => setSearchTerm(value), 300),
     []
   );
   ```

---

## Troubleshooting

**State not updating?**
- Check if `isOnboarded` is true
- Check console for errors
- Verify event listeners are setup

**Commands failing?**
- Check parameter names (should be snake_case)
- Verify command is registered in Rust
- Check Rust logs for errors

**Events not firing?**
- Check `isOnboarded` is true
- Verify event name matches backend
- Check for unlisten cleanup

**Type errors?**
- Ensure types match Rust backend
- Use type guards for MessageType
- Check for snake_case vs camelCase

---

## Quick Links

- [Full Integration Guide](./FRONTEND_INTEGRATION.md)
- [Update Summary](./FRONTEND_UPDATE_SUMMARY.md)
- [Types](./src/types/index.ts)
- [Store](./src/store/index.ts)
- [Hooks](./src/hooks/)
- [API](./src/lib/api.ts)