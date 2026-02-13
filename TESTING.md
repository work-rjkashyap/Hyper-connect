# Quick Start & Testing Guide

This guide will help you get Hyper Connect up and running quickly for testing and development.

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Dependencies
```bash
cd Hyper-connect
npm install
```

### Step 2: Run Development Server
```bash
npm run tauri dev
```

The application will launch in a new window!

## 🧪 Testing Features

### Testing Device Discovery

#### Single Device Mode (UI Testing)
If you're testing alone and want to see the UI:

1. Launch the app
2. Complete the onboarding flow
3. The app will show "0 devices found" - this is normal if you're the only device

#### Multi-Device Testing
To properly test device discovery, you need at least 2 devices:

**Option A: Two Physical Devices**
1. Install and run Hyper Connect on both devices
2. Ensure both are on the same WiFi network
3. Complete onboarding on both
4. They should discover each other within a few seconds

**Option B: Virtual Machine**
1. Set up a VM (VMware, VirtualBox, Parallels)
2. Configure VM network to "Bridged" mode
3. Install and run Hyper Connect in the VM
4. Run another instance on your host machine

**Option C: Development Mock** (Coming Soon)
Add mock devices for UI testing without real network devices.

### Testing Messaging

Once devices are discovered:

1. **Send a Text Message**
   - Select a device from the list
   - Type a message in the input field
   - Press Enter or click Send
   - Message appears in the chat window

2. **Send Emojis**
   - Click the emoji button (😊)
   - Select an emoji from the picker
   - Send it as part of a message

3. **Test Threading**
   - Messages are automatically grouped by conversation
   - Each device pair has its own thread

### Testing File Transfer

1. **Drag and Drop**
   - Select a device
   - Drag a file into the "File Transfers" panel on the right
   - Progress bar appears showing transfer status

2. **Browse Files**
   - Select a device
   - Click in the drop zone
   - Choose files from the file picker

3. **Pause/Resume**
   - Start a file transfer
   - Click the Pause button
   - Click Resume to continue

4. **Cancel Transfer**
   - Start a transfer
   - Click the X button to cancel

5. **Test Different File Sizes**
   - Small files (< 1MB): Near instant
   - Medium files (1-100MB): See progress tracking
   - Large files (> 100MB): Test pause/resume functionality

### Testing Theme Toggle

1. Click the sun/moon icon in the header
2. Theme switches between Light and Dark
3. Close and reopen the app - theme persists

### Testing Auto-Update

**Note**: Auto-update requires a configured update server and signed builds.

For development:
1. The app checks for updates on startup (if onboarded)
2. Check console for update checking logs
3. To fully test, you need to:
   - Set up an update server
   - Generate signing keys
   - Configure `tauri.conf.json`
   - Build and sign releases

### Testing Onboarding Flow

1. Delete the app's data directory to reset onboarding:
   - **macOS**: `~/Library/Application Support/com.rajeshwar.hyper-connect`
   - **Linux**: `~/.local/share/hyper-connect`
   - **Windows**: `%APPDATA%/com.rajeshwar.hyper-connect`

2. Restart the app
3. Walk through the onboarding steps
4. Enter a device name and complete

## 🐛 Debugging Tips

### Check Device Discovery

**In Terminal:**
```bash
# macOS/Linux: Check mDNS services
dns-sd -B _hyperconnect._tcp local.

# Alternative: Use avahi-browse (Linux)
avahi-browse -art
```

### Monitor Network Traffic

**Using Wireshark:**
1. Filter: `mdns`
2. Look for service type: `_hyperconnect._tcp.local.`
3. Verify your device is advertising

### Check Rust Logs

When running `npm run tauri dev`, the terminal shows Rust backend logs:
- Look for "Failed to..." messages for errors
- `println!` statements from Rust code appear here

### Frontend Console

In the app window:
1. Right-click → Inspect
2. Open Console tab
3. Look for:
   - Event listeners working
   - API call errors
   - State updates

### Common Issues & Solutions

#### "No devices found"
- ✅ Check firewall settings
- ✅ Ensure devices are on same subnet
- ✅ Try restarting the app
- ✅ Check mDNS is not blocked

#### "Failed to send message"
- ✅ Ensure device is still connected
- ✅ Check network connection
- ✅ Restart both devices

#### "File transfer failed"
- ✅ Check file permissions
- ✅ Ensure sufficient disk space
- ✅ Try a smaller file first
- ✅ Check file path is accessible

#### Theme doesn't change
- ✅ Check console for errors
- ✅ Clear app data and restart
- ✅ Ensure store plugin is working

## 📊 Test Scenarios

### Scenario 1: Basic Communication
1. Start app on Device A
2. Start app on Device B
3. Verify both devices appear in each other's device list
4. Send message from A to B
5. Verify message appears on B
6. Reply from B to A
7. Verify conversation thread is maintained

### Scenario 2: File Sharing
1. Select Device B on Device A
2. Drag a 10MB file
3. Verify progress tracking
4. Pause transfer
5. Resume transfer
6. Verify completion and checksum

### Scenario 3: Multi-Device
1. Start app on Device A, B, and C
2. Verify all devices see each other
3. Send messages between all pairs (A↔B, B↔C, A↔C)
4. Verify each conversation is separate
5. Transfer files between different devices

### Scenario 4: Connection Loss
1. Start app on two devices
2. Establish communication
3. Disconnect one device from network
4. Verify other device shows removal
5. Reconnect device
6. Verify rediscovery

### Scenario 5: Theme and Persistence
1. Set theme to Dark
2. Close app
3. Reopen app
4. Verify theme is still Dark
5. Toggle to Light
6. Close and reopen
7. Verify theme persisted

## 🔍 Performance Testing

### Message Load Test
```typescript
// Send 100 messages rapidly
for (let i = 0; i < 100; i++) {
  await invoke('send_message', {
    fromDeviceId: localId,
    toDeviceId: remoteId,
    messageType: { type: 'Text', content: `Test message ${i}` },
    threadId: null
  });
}
```

### File Transfer Stress Test
- Transfer multiple files simultaneously
- Transfer very large files (> 1GB)
- Pause/resume multiple times
- Cancel and restart transfers

### Discovery Stress Test
- Connect/disconnect devices rapidly
- Test with 10+ devices on network
- Monitor memory usage
- Check for memory leaks

## 📈 Metrics to Monitor

### Performance Metrics
- App startup time
- Device discovery latency
- Message delivery time
- File transfer speed
- UI responsiveness
- Memory usage

### Quality Metrics
- File transfer success rate
- Message delivery rate
- Discovery reliability
- Theme switching smoothness
- State persistence accuracy

## 🎯 Pre-Release Checklist

Before releasing a new version:

- [ ] All devices discover each other reliably
- [ ] Messages send and receive correctly
- [ ] File transfers complete successfully
- [ ] Pause/resume works properly
- [ ] Theme persists across restarts
- [ ] Onboarding flow is smooth
- [ ] App doesn't crash during normal use
- [ ] Memory usage is reasonable
- [ ] No console errors in normal operation
- [ ] UI is responsive on all screen sizes
- [ ] Dark mode works correctly
- [ ] Build process completes without errors
- [ ] Auto-update mechanism tested (if configured)

## 🚢 Building for Production

### Create a Production Build
```bash
npm run tauri build
```

### Build Outputs
- **macOS**: `src-tauri/target/release/bundle/dmg/`
- **Windows**: `src-tauri/target/release/bundle/msi/`
- **Linux**: `src-tauri/target/release/bundle/deb/` or `appimage/`

### Test the Production Build
1. Install the built package
2. Run through all test scenarios
3. Verify auto-update works (if configured)
4. Check bundle size is reasonable

## 💡 Tips for Effective Testing

1. **Keep Notes**: Document any bugs you find
2. **Test Edge Cases**: Try unusual inputs and scenarios
3. **Cross-Platform**: Test on different operating systems
4. **Network Conditions**: Test on slow networks
5. **Resource Constraints**: Test on lower-end hardware
6. **User Perspective**: Think like a first-time user

## 🤝 Reporting Issues

When reporting bugs, include:
- Operating system and version
- App version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots/logs if applicable
- Console errors

## 📚 Next Steps

After testing the app:
- Review [DEVELOPMENT.md](DEVELOPMENT.md) for architecture details
- Read [README.md](README.md) for feature documentation
- Check GitHub Issues for known problems
- Consider contributing improvements!

Happy testing! 🎉
