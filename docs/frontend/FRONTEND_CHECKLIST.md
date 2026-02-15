# Frontend Implementation Checklist

This checklist guides you through completing the Hyper Connect frontend UI implementation.

---

## ✅ Completed (Backend Integration)

- [x] TypeScript types matching Rust backend
- [x] Zustand store with state management
- [x] React hooks for all services
- [x] Event listeners for real-time updates
- [x] API layer for Tauri commands
- [x] Helper functions for formatting
- [x] Comprehensive documentation

---

## 📋 TODO: UI Implementation

### 1. Main App Setup

**File:** `src/App.tsx`

- [ ] Import and initialize `useApp()` hook
- [ ] Add routing guard for onboarding
- [ ] Implement theme provider integration
- [ ] Add error boundary component
- [ ] Setup toast provider

**Example:**
```typescript
import { useApp } from '@/hooks';
import { Toaster } from '@/components/ui/toaster';

function App() {
  const { identity } = useApp();
  const { isOnboarded } = useAppStore();

  if (!isOnboarded) {
    return <Navigate to="/onboarding" />;
  }

  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
```

---

### 2. Onboarding Page

**File:** `src/pages/Onboarding.tsx`

- [ ] Create display name input form
- [ ] Add validation (min 3 chars, max 32 chars)
- [ ] Show device ID (read-only)
- [ ] Add "Get Started" button
- [ ] Set `isOnboarded` to true on submit
- [ ] Navigate to `/devices` after setup

**Features:**
- Welcome message
- Display name input with validation
- Device ID display (UUID)
- Platform info display
- Continue button

**Note:** `updateDisplayName` backend command needs refactoring. For now, just set `isOnboarded` to true.

---

### 3. Devices Page

**File:** `src/pages/Devices.tsx`

- [ ] Display list of discovered devices
- [ ] Show device card for each device
- [ ] Display connection status indicator
- [ ] Add "Connect" / "Chat" button
- [ ] Add "Send File" button
- [ ] Show empty state when no devices
- [ ] Add refresh button
- [ ] Show loading state during discovery

**Device Card Should Show:**
- Device display name
- Device hostname
- IP address (first from addresses array)
- Platform icon/badge
- Last seen timestamp
- Connection status indicator
- Action buttons (Chat, Send File)

**Example Card:**
```typescript
<div className="device-card">
  <div className="device-info">
    <h3>{device.display_name}</h3>
    <p>{device.hostname}</p>
    <p>{device.addresses[0]}</p>
    <span className="badge">{device.platform}</span>
  </div>
  <div className="device-actions">
    <Button onClick={() => navigate(`/chat/${device.device_id}`)}>
      Chat
    </Button>
    <Button onClick={() => handleSendFile(device.device_id)}>
      Send File
    </Button>
  </div>
</div>
```

---

### 4. Chat Page

**File:** `src/pages/Chat.tsx`

- [ ] Get deviceId from URL params
- [ ] Load message history on mount
- [ ] Display messages in conversation view
- [ ] Implement message input with send button
- [ ] Show message timestamps
- [ ] Distinguish sent vs received messages
- [ ] Auto-scroll to bottom on new message
- [ ] Show typing indicator (optional)
- [ ] Add emoji picker (optional)
- [ ] Mark messages as read when viewed

**Layout:**
- Header: Device name, status
- Message list: Scrollable area
- Message input: Text input + send button

**Message Bubble:**
```typescript
<div className={msg.from_device_id === localDeviceId ? 'sent' : 'received'}>
  <p>{getMessageContent(msg.message_type)}</p>
  <span className="timestamp">
    {new Date(msg.timestamp).toLocaleTimeString()}
  </span>
</div>
```

**Send Handler:**
```typescript
const handleSend = async () => {
  if (!input.trim()) return;
  const device = devices.find(d => d.device_id === deviceId);
  const peerAddress = `${device.addresses[0]}:${device.port}`;
  await sendMessage(deviceId, input, peerAddress);
  setInput('');
};
```

---

### 5. Transfers Page

**File:** `src/pages/Transfers.tsx`

- [ ] Display list of all transfers
- [ ] Show transfer status for each
- [ ] Implement progress bars for active transfers
- [ ] Add accept/reject buttons for incoming
- [ ] Add cancel button for in-progress
- [ ] Show transfer speed and ETA
- [ ] Display file icon based on type
- [ ] Show checksum for completed transfers
- [ ] Show error message for failed transfers
- [ ] Filter by status (optional)

**Transfer Card:**
```typescript
<div className="transfer-card">
  <div className="transfer-info">
    <h3>{transfer.filename}</h3>
    <p>Size: {formatFileSize(transfer.size)}</p>
    <p>Status: {transfer.status}</p>
  </div>

  {transfer.status === 'InProgress' && (
    <div className="transfer-progress">
      <progress value={transfer.transferred} max={transfer.size} />
      <p>Speed: {formatSpeed(transfer.speed_bps)}</p>
      <p>ETA: {formatETA(transfer.eta_seconds)}</p>
      <Button onClick={() => cancelTransfer(transfer.id)}>Cancel</Button>
    </div>
  )}

  {transfer.status === 'Pending' && transfer.to_device_id === localDeviceId && (
    <div className="transfer-actions">
      <Button onClick={() => acceptTransfer(transfer.id)}>Accept</Button>
      <Button onClick={() => rejectTransfer(transfer.id)}>Reject</Button>
    </div>
  )}
</div>
```

---

### 6. Settings Page

**File:** `src/pages/Settings.tsx`

- [ ] Display current device info
- [ ] Show device ID (copy button)
- [ ] Display name input (when backend supports it)
- [ ] Theme toggle (light/dark)
- [ ] Port configuration (optional)
- [ ] Clear chat history button
- [ ] Clear transfers button
- [ ] About section (app version, platform)

---

### 7. Layout Component

**File:** `src/components/layout/Layout.tsx`

- [ ] Create sidebar with navigation
- [ ] Add header with app title
- [ ] Implement responsive design
- [ ] Add sidebar toggle button
- [ ] Show online device count badge
- [ ] Show unread message count badge

**Sidebar Navigation:**
- Devices
- Messages/Chat
- Transfers
- Settings

---

### 8. Components

#### Device Card (`src/components/DeviceCard.tsx`)
- [ ] Display device information
- [ ] Show connection status
- [ ] Add action buttons
- [ ] Format last seen timestamp

#### Message Bubble (`src/components/MessageBubble.tsx`)
- [ ] Render text messages
- [ ] Render emoji messages
- [ ] Render file messages
- [ ] Show timestamp
- [ ] Show read status

#### Transfer Card (`src/components/TransferCard.tsx`)
- [ ] Display transfer info
- [ ] Show progress bar
- [ ] Display speed and ETA
- [ ] Add action buttons based on status

#### File Picker (`src/components/FilePicker.tsx`)
- [ ] Hidden file input
- [ ] Trigger button
- [ ] Get file path for Tauri
- [ ] Call `createTransfer` with path

**File Picker Example:**
```typescript
<input
  type="file"
  ref={fileInputRef}
  style={{ display: 'none' }}
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (file) {
      const filePath = (file as any).path || file.name;
      createTransfer(deviceId, filePath);
    }
  }}
/>
<Button onClick={() => fileInputRef.current?.click()}>
  Select File
</Button>
```

#### Empty State (`src/components/EmptyState.tsx`)
- [ ] Icon
- [ ] Title
- [ ] Description
- [ ] Optional action button

---

## 🎨 Styling

### Use shadcn/ui Components

- [ ] Button
- [ ] Card
- [ ] Input
- [ ] Badge
- [ ] Progress
- [ ] Dialog
- [ ] Toast
- [ ] Tooltip
- [ ] ScrollArea

### Tailwind Classes

Use utility classes for:
- [ ] Layout (flex, grid)
- [ ] Spacing (p-4, m-2, gap-4)
- [ ] Colors (bg-primary, text-muted-foreground)
- [ ] Typography (text-lg, font-semibold)
- [ ] Responsive (md:flex, lg:grid-cols-3)

---

## 🔧 Technical Tasks

### 1. File Dialog Solution

**Option A: HTML File Input (Recommended for now)**
```typescript
<input type="file" onChange={handleFileSelect} />
```

**Option B: Install Tauri Dialog Plugin**
```bash
npm install @tauri-apps/plugin-dialog
```
Then add to `src-tauri/Cargo.toml`:
```toml
tauri-plugin-dialog = "2.0.0"
```

### 2. Theme Implementation

- [ ] Connect theme toggle to store
- [ ] Apply theme class to root element
- [ ] Persist theme in localStorage (already done in store)

```typescript
useEffect(() => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}, [theme]);
```

### 3. Toast Notifications

Already implemented in hooks! Just ensure:
- [ ] Toaster component is rendered in App.tsx
- [ ] Toast notifications appear for:
  - Incoming messages
  - File transfer requests
  - Transfer completion
  - Errors

---

## 🧪 Testing Checklist

### Two-Device Setup

**Terminal 1:**
```bash
npm run tauri dev
```

**Terminal 2 (different port):**
```bash
PORT=1421 npm run tauri dev
```

### Test Scenarios

#### Discovery
- [ ] Devices appear in list within 2 seconds
- [ ] Device info is displayed correctly
- [ ] Self is not shown in device list
- [ ] Refresh button works

#### Messaging
- [ ] Send message from Device A to Device B
- [ ] Message appears in both devices
- [ ] Toast notification appears on Device B
- [ ] Message history loads correctly
- [ ] Messages are sorted by timestamp
- [ ] Sent messages align right, received left

#### File Transfer
- [ ] File picker opens and selects file
- [ ] Transfer appears in sender's list
- [ ] Transfer request appears in receiver's list
- [ ] Accept button starts transfer
- [ ] Progress updates in real-time
- [ ] Speed and ETA are shown
- [ ] Transfer completes successfully
- [ ] Checksum is displayed
- [ ] Reject button works
- [ ] Cancel button works

#### Edge Cases
- [ ] Empty states display correctly
- [ ] Error messages are clear
- [ ] Long file names are truncated
- [ ] Large file transfers work (>100MB)
- [ ] Multiple concurrent transfers work
- [ ] App works on both light and dark themes
- [ ] Responsive design works on different screen sizes

---

## 📱 Responsive Design

### Breakpoints

- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Responsive Patterns

```typescript
// Hide sidebar on mobile
<aside className="hidden md:block">

// Stack on mobile, grid on desktop
<div className="flex flex-col md:grid md:grid-cols-2">

// Full width on mobile, fixed width on desktop
<div className="w-full md:w-96">
```

---

## 🚀 Deployment

### Build for Production

```bash
npm run tauri build
```

### Platform-Specific

**macOS:**
- [ ] Test .dmg installer
- [ ] Verify app signature
- [ ] Test on different macOS versions

**Windows:**
- [ ] Test .msi installer
- [ ] Verify app runs on different Windows versions

**Linux:**
- [ ] Test .AppImage
- [ ] Test .deb package
- [ ] Test .rpm package (if applicable)

---

## 📚 Documentation Tasks

- [ ] Update README with screenshots
- [ ] Add usage instructions
- [ ] Document keyboard shortcuts
- [ ] Create troubleshooting guide
- [ ] Add contribution guidelines

---

## 🐛 Known Issues to Address

### 1. Display Name Update
**Issue:** Backend command returns error
**Solution:** Refactor `IdentityManager` to use `Arc<Mutex<>>`

```rust
// In src-tauri/src/lib.rs
let identity = Arc::new(Mutex::new(IdentityManager::new(...)));

// In src-tauri/src/ipc/commands.rs
#[tauri::command]
pub fn update_display_name(
    identity: State<Arc<Mutex<IdentityManager>>>,
    name: String,
) -> Result<(), String> {
    let mut identity = identity.lock().unwrap();
    identity.set_display_name(name);
    Ok(())
}
```

### 2. Compiler Warnings
**Issue:** Unused code warnings in Rust backend
**Solution:** Remove or use the flagged code

```bash
# Check warnings
cargo clippy --all-targets --all-features
```

---

## ✨ Optional Enhancements

### Nice-to-Have Features

- [ ] System tray integration
- [ ] Keyboard shortcuts
- [ ] Drag & drop file sending
- [ ] Copy/paste file sending
- [ ] Message reactions
- [ ] Message search
- [ ] Transfer history
- [ ] Contact favorites
- [ ] Custom themes
- [ ] Sound notifications
- [ ] Desktop notifications (native)
- [ ] QR code for device pairing
- [ ] Network stats dashboard

---

## 📊 Progress Tracking

**Backend Integration:** ✅ 100% Complete
**Type System:** ✅ 100% Complete
**State Management:** ✅ 100% Complete
**Hooks:** ✅ 100% Complete
**API Layer:** ✅ 100% Complete
**Documentation:** ✅ 100% Complete

**UI Components:** ⏳ 0% Complete
**Pages:** ⏳ 0% Complete
**Styling:** ⏳ 0% Complete
**Testing:** ⏳ 0% Complete

---

## 🎯 Next Steps

1. **Start with Layout & Routing**
   - Create main layout with sidebar
   - Setup routes for all pages
   - Add navigation

2. **Implement Onboarding**
   - Simple form for display name
   - Mark as onboarded and redirect

3. **Build Devices Page**
   - Show discovered devices
   - Add connect buttons
   - Implement empty state

4. **Create Chat Interface**
   - Message list
   - Send input
   - Basic styling

5. **Add File Transfer UI**
   - Transfer list
   - Progress bars
   - Accept/reject buttons

6. **Polish & Test**
   - Responsive design
   - Theme support
   - Two-device testing

---

## 📞 Support & Resources

- **Integration Guide:** [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)
- **Quick Reference:** [FRONTEND_QUICK_REFERENCE.md](./FRONTEND_QUICK_REFERENCE.md)
- **Update Summary:** [FRONTEND_UPDATE_SUMMARY.md](./FRONTEND_UPDATE_SUMMARY.md)
- **Backend Commands:** [src-tauri/src/ipc/commands.rs](./src-tauri/src/ipc/commands.rs)
- **Types:** [src/types/index.ts](./src/types/index.ts)
- **Hooks:** [src/hooks/](./src/hooks/)

---

**Good luck with the implementation! 🚀**

The backend integration is complete and ready. Focus on building the UI components and pages, and everything will just work thanks to the hooks and state management already in place.