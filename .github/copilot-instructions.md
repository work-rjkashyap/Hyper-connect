# Hyper Connect - AI Coding Agent Instructions
## Architecture Overview
**Tauri 2 Desktop App**: Rust backend + React 19 frontend for local device communication via mDNS.
- **Backend**: [src-tauri/src/](../src-tauri/src/) - Rust modules: `discovery.rs`, `messaging.rs`, `file_transfer.rs`
- **Frontend**: [src/](../src/) - React + TypeScript with Zustand state, React Router, Radix UI + Tailwind
- **Bridge**: Tauri commands (invoke) and events (listen/emit) connect Rust ↔ JavaScript
## Critical Patterns
### Tauri Command/Event Architecture
Commands are synchronous requests, events are async real-time updates:
```typescript
// Frontend: Invoke Rust command
import { invoke } from '@tauri-apps/api/core';
const devices = await invoke<Device[]>('get_devices');
// Frontend: Listen for Rust events (with cleanup!)
import { listen } from '@tauri-apps/api/event';
useEffect(() => {
  let unlisten: (() => void) | undefined;
  listen<Device>('device-discovered', (e) => addDevice(e.payload))
    .then(fn => { unlisten = fn; });
  return () => unlisten?.(); // Always cleanup listeners
}, [addDevice]);
```
```rust
// Backend: Define Tauri command in src-tauri/src/lib.rs
#[tauri::command]
fn get_devices(state: State<AppState>) -> Vec<Device> {
    state.discovery.lock().unwrap().get_devices()
}
// Backend: Emit event to frontend
app_handle.emit("device-discovered", device)?;
```
**Register all commands** in [src-tauri/src/lib.rs](../src-tauri/src/lib.rs) `lib_tauri_v2()`:
```rust
.invoke_handler(tauri::generate_handler![
    start_discovery, get_devices, send_message, // add new ones here
])
```
### State Management (Zustand)
Single store in [src/store/index.ts](../src/store/index.ts) with normalized structure:
```typescript
// ✅ Correct: Update specific slice, use functional updates for arrays
addDevice: (device) => set((state) => ({
  devices: [...state.devices.filter(d => d.id !== device.id), device]
}));
// ❌ Avoid: Replacing entire state unnecessarily
setDevices: (devices) => set({ devices }); // Only when replacing all
```
Access store in components: `const { devices, addDevice } = useAppStore();`
### Type Alignment (Rust ↔ TypeScript)
Keep types synced between [src-tauri/src/*.rs](../src-tauri/src/) and [src/types/index.ts](../src/types/index.ts):
```rust
// Rust: src-tauri/src/discovery.rs
#[derive(Serialize, Deserialize, Clone)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub port: u16,
}
```
```typescript
// TypeScript: src/types/index.ts
export interface Device {
  id: string;
  name: string;
  port: number; // u16 → number
}
```
**Validate at boundaries** with Zod schemas in [src/lib/schemas.ts](../src/lib/schemas.ts):
```typescript
const result = deviceSchema.safeParse(event.payload);
if (!result.success) {
  console.error('Invalid data:', result.error);
  return;
}
```
### React Patterns (React 19 + Performance)
Follow [.agents/skills/vercel-react-best-practices/AGENTS.md](../.agents/skills/vercel-react-best-practices/AGENTS.md) for optimization:
- **Eliminate waterfalls**: `Promise.all()` for independent calls
- **Dynamic imports**: Use for heavy components (emoji picker, dropzone)
- **Memoization**: Extract to `memo()` components only when profiled
- **Hash routing**: Tauri uses `createHashRouter` not `createBrowserRouter`
### UI Components (shadcn/ui)
Components in [src/components/ui/](../src/components/ui/) follow shadcn pattern:
```bash
# Add new components via shadcn CLI
npx shadcn@latest add <component-name>
```
Customize in place, use `cn()` utility from [src/lib/utils.ts](../src/lib/utils.ts) for conditional classes:
```typescript
import { cn } from '@/lib/utils';
<div className={cn("base-class", isActive && "active-class")} />
```
## Development Workflows
### Running the App
```bash
npm install                # Install dependencies
npm run tauri dev          # Development mode (hot reload)
npm run tauri build        # Production build
```
**Dev server runs on port 1420** (configured in [vite.config.ts](../vite.config.ts)).
### Multi-Device Testing
mDNS discovery requires **2+ devices on same network**:
- Physical devices, VMs (bridged mode), or mock data in [src/lib/mockData.ts](../src/lib/mockData.ts)
- See [TESTING.md](../TESTING.md) for detailed test scenarios
### Debugging Backend
Rust logs via `println!` or `dbg!` appear in terminal running `npm run tauri dev`.
## Project-Specific Conventions
- **No barrel imports**: Import directly from files, not index.ts (bundle size optimization)
- **Event cleanup**: Always return cleanup function in `useEffect` for Tauri listeners
- **Async state in Rust**: Use `Mutex<Service>` for shared state, `tokio::spawn` for background tasks
- **Theme persistence**: Theme stored via `tauri-plugin-store`, loaded in [src/App.tsx](../src/App.tsx)
- **Checksum verification**: File transfers use SHA-256, implemented in [src-tauri/src/file_transfer.rs](../src-tauri/src/file_transfer.rs)
## Common Tasks
**Add a new Tauri command:**
1. Define in Rust module (e.g., `src-tauri/src/messaging.rs`)
2. Add function signature with `#[tauri::command]`
3. Register in `lib.rs`: `.invoke_handler(tauri::generate_handler![...])`
4. Call from frontend: `await invoke('command_name', { param: value })`
**Add a new event:**
1. Emit from Rust: `app_handle.emit("event-name", payload)?;`
2. Listen in frontend hook: `listen<Type>('event-name', callback)`
3. Store cleanup function and call on unmount
**Add a new page:**
1. Create in [src/pages/](../src/pages/)
2. Define route in [src/routes.tsx](../src/routes.tsx)
3. Add navigation in sidebar: [src/components/layout/Sidebar.tsx](../src/components/layout/Sidebar.tsx)
## Key Files Reference
- [src-tauri/src/lib.rs](../src-tauri/src/lib.rs) - Main Tauri entry, command registration
- [src/store/index.ts](../src/store/index.ts) - Zustand state management
- [src/hooks/use-lan-peers.ts](../src/hooks/use-lan-peers.ts) - Example event listener pattern
- [src/lib/schemas.ts](../src/lib/schemas.ts) - Zod validation schemas
- [DEVELOPMENT.md](../DEVELOPMENT.md) - Complete feature documentation
- [VALIDATION.md](../VALIDATION.md) - Zod & validation examples
