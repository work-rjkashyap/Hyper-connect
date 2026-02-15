# Discovery Troubleshooting Guide

**Status:** 🔍 Diagnostic  
**Last Updated:** 2024

---

## Quick Diagnosis Checklist

### ✅ Step 1: Check if Discovery is Starting

Open the browser console (F12) or view Tauri logs and look for:

```
🆔 Device identity loaded: { device_id: "...", display_name: "..." }
🔍 Discovery started
📡 Advertising started on port: 8080
```

**If you see these logs:** Discovery is working, issue is elsewhere (see Step 2)  
**If you DON'T see these logs:** Discovery is not starting (see Step 3)

---

### ✅ Step 2: Verify Identity is Loaded

**Check Browser Console:**
```javascript
// In browser console, type:
localStorage
```

Look for `app-store` key. It should contain:
```json
{
  "state": {
    "isOnboarded": true,
    "deviceIdentity": {
      "device_id": "some-uuid",
      "display_name": "Your Device Name",
      "platform": "macos",
      "app_version": "0.1.0"
    }
  }
}
```

**If `isOnboarded: false` or `deviceIdentity: null`:**
- Go through onboarding again
- Check if backend is returning identity (see Step 3)

---

### ✅ Step 3: Verify Backend is Running

**Check Tauri Console Logs:**

When app starts, you should see:
```
🚀 Starting Hyper Connect...
✓ Identity: YourDeviceName (some-uuid)
✓ TCP port: 8080
✓ TCP server started on port 8080
✓ Hyper Connect initialized successfully
```

**If you DON'T see these:**
- Backend failed to start
- Check for Rust compilation errors
- Restart the app

---

### ✅ Step 4: Test mDNS Discovery Manually