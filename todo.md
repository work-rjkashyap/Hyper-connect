# Hyper Connect — Feature Status & TODO

> **Last updated:** 2025-01-20
>
> **Architecture:** Tauri 2 (Rust backend + React 19 frontend) — Pure P2P on LAN, no cloud, no central server.

---

## 📊 Overall Progress

| Phase   | Total | Done | In Progress | TODO |
| ------- | ----- | ---- | ----------- | ---- |
| Phase 1 | 8     | 8    | 0           | 0    |
| Phase 2 | 6     | 5    | 0           | 1    |
| Phase 3 | 6     | 0    | 0           | 6    |

---

## ✅ Phase 1 — Strong MVP (COMPLETE)

### 1. mDNS / UDP Discovery

- **Status:** ✅ Complete
- **Files:** `src-tauri/src/discovery/mdns.rs`, `src-tauri/src/discovery/mod.rs`
- **Frontend:** `src/components/discovery/DeviceList.tsx`, `src/pages/DiscoveryPage.tsx`
- **Details:**
    - [x] mDNS broadcast & listener via dedicated OS thread
    - [x] Live device list with auto-refresh
    - [x] No manual IP typing — automatic peer detection
    - [x] Device removed events on timeout
    - [x] IPC commands: `start_discovery`, `start_advertising`, `get_devices`, `get_local_device_id`

### 2. Direct Chat (TCP)

- **Status:** ✅ Complete
- **Files:** `src-tauri/src/messaging/service.rs`, `src-tauri/src/network/server.rs`, `src-tauri/src/network/client.rs`
- **Frontend:** `src/pages/ChatPage.tsx`, `src/components/chat/ChatWindow.tsx`, `src/components/chat/ChatInput.tsx`, `src/components/chat/MessageBubble.tsx`
- **Details:**
    - [x] Direct TCP messaging (PC A → PC B, no relay)
    - [x] Message types: Text, Emoji, Reply, File
    - [x] Delivery receipts (sent → delivered → read)
    - [x] Read receipts with `mark_as_read` / `mark_conversation_as_read`
    - [x] Chat request / approval system (approve, decline, system messages)
    - [x] Ping/latency measurement per device
    - [x] Date separators in chat UI

### 3. File Transfer (Chunked + Checksum)

- **Status:** ✅ Complete
- **Files:** `src-tauri/src/network/file_transfer.rs`, `src-tauri/src/network/protocol.rs`
- **Frontend:** `src/components/files/FileDropZone.tsx`, `src/hooks/use-file-transfer.ts`, `src/hooks/use-file-transfers.ts`
- **Details:**
    - [x] Chunked upload (256KB chunks)
    - [x] SHA-256 checksum verification
    - [x] Transfer progress with speed (B/s) and ETA
    - [x] Transfer states: Pending, InProgress, Paused, Completed, Failed, Cancelled, Rejected, AwaitingAcceptance
    - [x] Accept / reject incoming transfers
    - [x] File drag-and-drop via FileDropZone
    - [x] Configurable download directory
    - [x] Transfer history persisted to SQLite
    - [x] Resume interrupted transfers (Phase 2) ✅
    - [ ] Parallel chunk transfers (Phase 3)
    - [ ] Compression (Phase 3)

### 4. Local DB (SQLite)

- **Status:** ✅ Complete
- **Files:** `src-tauri/src/db/mod.rs`, `src-tauri/src/db/messages.rs`, `src-tauri/src/db/transfers.rs`
- **Details:**
    - [x] SQLite with WAL mode for concurrent reads
    - [x] Connection pool (max 5 connections)
    - [x] Messages table with conversation indexing
    - [x] Threads table for conversation metadata
    - [x] File transfers table with full metadata
    - [x] History survives app restarts

### 5. Dark UI with shadcn/ui

- **Status:** ✅ Complete
- **Files:** `src/components/ui/*`, `src/components/layout/*`
- **Details:**
    - [x] Tailwind CSS + shadcn/ui component library
    - [x] Dark/light theme toggle with persistence
    - [x] Accent color customization
    - [x] Responsive sidebar layout
    - [x] `cn()` utility for conditional classes
    - [x] Hash routing (Tauri-compatible)

### 6. Secure Handshake & Encryption

- **Status:** ✅ Complete
- **Files:** `src-tauri/src/crypto/handshake.rs`, `src-tauri/src/crypto/session.rs`, `src-tauri/src/crypto/message_crypto.rs`, `src-tauri/src/crypto/tls.rs`, `src-tauri/src/network/secure_channel.rs`
- **Details:**
    - [x] X25519 ECDH key exchange (Diffie-Hellman)
    - [x] HKDF key derivation (separate keys for messages & files)
    - [x] AES-256-GCM authenticated message encryption
    - [x] AES-256-CTR streaming file encryption
    - [x] Perfect Forward Secrecy (ephemeral keys per connection)
    - [x] TLS 1.3 transport layer (self-signed certs, TOFU model)
    - [x] Concurrent handshake support (unique handshake_id per connection)
    - [x] SecureChannelManager shared across tasks
    - [ ] Security code display for user verification (e.g., `482-991`) — UI not yet implemented

### 7. Zod Validation

- **Status:** ✅ Complete
- **Files:** `src/lib/schemas.ts`
- **Details:**
    - [x] Device / Peer schema
    - [x] Message schema (discriminated union for message types)
    - [x] File transfer schema
    - [x] Settings & onboarding schema
    - [x] Validation helper functions

### 8. Identity & Onboarding

- **Status:** ✅ Complete
- **Files:** `src-tauri/src/identity/`, `src/pages/OnboardingPage.tsx`, `src/routes.tsx`
- **Details:**
    - [x] Device identity generation (ID, name, platform, version)
    - [x] Onboarding flow with device name setup
    - [x] Protected routes (redirect to onboarding if not set up)
    - [x] Identity persistence across restarts
    - [x] Display name update support

---

## 🔲 Phase 2 — Enhanced Features (NEXT)

### 9. Network Health Bar

- **Status:** ✅ Done
- **Priority:** High (UI polish, builds on existing ping infrastructure)
- **Files:** `src/components/network/NetworkHealthBar.tsx`
- **Details:**
    - [x] Top bar component showing: `LAN: Strong | 12 Devices | 4ms avg`
    - [x] Aggregate latency from existing `deviceLatencyMs` store data
    - [x] Network quality indicator (Excellent / Strong / Fair / Weak / No Devices)
    - [x] Live device count from discovery with active connection count
    - [x] Auto-refresh on device/connection/latency changes (reactive via Zustand)
    - [x] Animated status dot with color-coded signal quality
    - [x] Tooltips with detailed latency stats (avg, min, max)
    - [x] Signal strength icon adapts to quality level
    - [x] Integrated into RootLayout above main content area

### 10. Transfer HUD (Floating Panel)

- **Status:** ✅ Done
- **Priority:** High
- **Files:** `src/components/network/TransferHUD.tsx`
- **Details:**
    - [x] Floating overlay panel (fixed bottom-right) for active transfers
    - [x] Progress bars with speed & ETA per transfer
    - [x] Minimize/expand toggle with chevron animation
    - [x] Visible across all pages (mounted in RootLayout)
    - [x] Cancel/pause controls inline per transfer
    - [x] Accept/reject buttons for incoming transfers
    - [x] Open file location button for completed transfers
    - [x] Auto-hides when no active/recent transfers
    - [x] Recently finished transfers linger for 8s then disappear
    - [x] Overall progress summary in footer and collapsed header
    - [x] Active transfer count badge on file icon
    - [x] Sorted: active first, then recent, by most recent update
    - [x] Tooltips with full filename and size on hover

### 11. Group Chat

- **Status:** ✅ Done
- **Priority:** Medium
- **Model:** Temporary Host (creator = initial host, auto-elect on leave)
- **Files:**
    - Backend: `src-tauri/src/messaging/group.rs` (GroupService, fan-out, host election)
    - Backend: `src-tauri/src/db/groups.rs` (groups, group_members, group_messages tables & CRUD)
    - Backend: `src-tauri/src/db/mod.rs` (DB migrations for group tables)
    - Backend: `src-tauri/src/network/server.rs` (GROUP_MESSAGE & GROUP_CONTROL routing)
    - Backend: `src-tauri/src/ipc/commands.rs` (10 new group IPC commands)
    - Backend: `src-tauri/src/lib.rs` (GroupService registration & command handler)
    - Frontend: `src/hooks/use-group-chat.ts` (event listeners, data loading, group actions)
    - Frontend: `src/pages/GroupChatPage.tsx` (full group chat UI with member panel)
    - Frontend: `src/components/group/CreateGroupDialog.tsx` (group creation with device picker)
    - Frontend: `src/components/layout/Sidebar.tsx` (groups section in sidebar)
    - Frontend: `src/components/layout/RootLayout.tsx` (useGroupChat hook init)
    - Frontend: `src/store/index.ts` (group state slice: groups, groupMessages, groupMembers)
    - Frontend: `src/types/index.ts` (GroupChat, GroupMember, GroupMessage, GroupSummary, etc.)
    - Frontend: `src/routes.tsx` (`/group/:groupId` route)
- **Details:**
    - [x] Temporary Host model: creator becomes host, fans out messages to all members
    - [x] Host election: if host leaves/goes offline, member with smallest device_id elected
    - [x] Group CRUD: create, add member, remove member, leave, disband
    - [x] GROUP_MESSAGE protocol: routed through encrypted channel, host fans out
    - [x] GROUP_CONTROL protocol: create, member_added, member_removed, host_changed, disband
    - [x] SQLite persistence: groups, group_members, group_messages tables
    - [x] Group creation dialog with device picker (approved devices only)
    - [x] Full group chat page with message bubbles, sender names, date separators
    - [x] Member panel (slide-out) with online status, host crown badge
    - [x] Host can remove members; leave/disband with confirmation dialogs
    - [x] Groups appear in sidebar with last message preview and member count
    - [x] Real-time events: group-created, group-message-received, group-member-added/removed, group-host-changed, group-disbanded
    - [x] Toast notifications for group events (new group invite, incoming messages, host changes)
    - [x] Member list reconciliation via control payloads (full member list sync)
    - [x] All 30 existing tests pass; TypeScript and Vite build clean

### 12. Resume Transfers

- **Status:** ✅ Done
- **Priority:** Medium
- **Files:**
    - Backend: `src-tauri/src/network/file_transfer.rs` (`resume_transfer`, modified `perform_transfer` with resume offset)
    - Backend: `src-tauri/src/db/transfers.rs` (`update_transfer_progress`, `get_resumable_transfers`)
    - Backend: `src-tauri/src/ipc/commands.rs` (`resume_transfer`, `get_resumable_transfers` IPC commands)
    - Backend: `src-tauri/src/network/protocol.rs` (`resume_offset` field on `FileRequestPayload`)
    - Backend: `src-tauri/src/network/server.rs` (auto-send `FILE_ACK` for resume requests)
    - Frontend: `src/hooks/use-file-transfer.ts` (`resumeTransfer`, `loadResumableTransfers` actions)
    - Frontend: `src/hooks/use-file-transfers.ts` (`transfer-resumed` event listener)
    - Frontend: `src/components/network/TransferHUD.tsx` (Resume button, resumable transfer visibility)
    - Frontend: `src/types/index.ts` (`TransferResumedEvent` type)
    - Frontend: `src/lib/schemas.ts` (added `Rejected`, `AwaitingAcceptance` to Zod schema)
- **Details:**
    - [x] Track chunk offsets in SQLite (periodic progress persistence every ~1MB via `update_transfer_progress`)
    - [x] Resume from last confirmed offset on reconnect (`resume_transfer` IPC → `perform_transfer` with `resume_offset`)
    - [x] Re-verify partial checksum on resume (sender hashes bytes 0..resume_offset before streaming, full SHA-256 verified at completion)
    - [x] UI indicator for resumed vs fresh transfers (Resume button ↻ on Paused/Failed transfers in TransferHUD, toast notifications)
    - [x] Receiver auto-accepts resume requests (no second user prompt) and sends `FILE_ACK` with confirmed offset
    - [x] Progress persisted on pause/cancel so resume picks up accurately
    - [x] Resumable transfers stay visible in TransferHUD (not hidden after linger timeout)

### 13. Screen Share (LAN Streaming)

- **Status:** 🔲 TODO
- **Priority:** Low
- **Plan:**
    - [ ] WebRTC with local signaling (no STUN/TURN)
    - [ ] Or custom UDP stream (RTSP-like)
    - [ ] Signaling via existing LAN TCP connections
    - [ ] Target latency: <50ms
    - [ ] Screen selection UI

### 14. Offline Message Queue & Retry

- **Status:** ✅ Done
- **Priority:** Medium
- **Files:**
    - Backend: `src-tauri/src/messaging/service.rs` (queue on send failure, flush logic)
    - Backend: `src-tauri/src/db/messages.rs` (queued message queries)
    - Backend: `src-tauri/src/ipc/commands.rs` (`flush_message_queue`, `get_queued_count`)
    - Frontend: `src/hooks/use-lan-peers.ts` (auto-flush on device discovery)
    - Frontend: `src/hooks/use-messaging.ts` (`message-queued`, `message-queue-flushed` listeners)
    - Frontend: `src/components/chat/MessageBubble.tsx` (clock icon for queued status)
    - Frontend: `src/components/chat/FileMessageBubble.tsx` (queued status support)
    - Frontend: `src/types/index.ts`, `src/lib/schemas.ts` (queued status type + schema)
- **Details:**
    - [x] Queue messages when peer is offline (send failure → `Queued` status in DB)
    - [x] Store in SQLite with `queued` status (new `MessageStatus::Queued` variant)
    - [x] Auto-retry on peer reconnect (`device-discovered` → `flush_message_queue` IPC)
    - [x] Backend looks up peer address from mDNS discovery at flush time
    - [x] Sequential flush: stops on first failure to avoid spam
    - [x] UI indicator: clock icon (🕐) on queued message bubbles
    - [x] Zod schema updated with `queued` status
    - [x] `message-queued` event updates bubble status in real-time
    - [x] `message-queue-flushed` event flips status queued → sent
    - [x] `get_queued_count` IPC for per-device or global queue counts

---

## 🔲 Phase 3 — Power Features

### 15. Mesh Routing (Multi-hop)

- **Status:** 🔲 TODO
- **Plan:**
    - [ ] Route messages through intermediate devices: `A → B → C → D`
    - [ ] Routing table based on mDNS topology
    - [ ] TTL to prevent infinite routing loops
    - [ ] Useful for devices not directly reachable on subnet

### 16. LAN Cloud (Backup Node)

- **Status:** 🔲 TODO
- **Plan:**
    - [ ] Designate 1 device as backup node
    - [ ] Others sync chat history & files when online
    - [ ] Works as an office server without internet
    - [ ] Conflict resolution via timestamps

### 17. Local AI Integration

- **Status:** 🔲 TODO
- **Plan:**
    - [ ] Integrate `llama.cpp` / GGUF models
    - [ ] Chat summaries without cloud
    - [ ] Smart file search
    - [ ] Runs entirely on-device

### 18. Full-Text Search Engine

- **Status:** 🔲 TODO
- **Plan:**
    - [ ] SQLite FTS5 or Tantivy (Rust) for indexing
    - [ ] Index: messages, files, device names
    - [ ] Instant search, no internet required
    - [ ] Search UI with filters (by date, device, type)

### 19. Parallel Chunk Transfers

- **Status:** 🔲 TODO
- **Plan:**
    - [ ] Split file into N chunks, send over parallel TCP streams
    - [ ] Reassemble at receiver with offset tracking
    - [ ] Saturate LAN bandwidth (target: 100+ MB/s on gigabit)

### 20. File Compression

- **Status:** 🔲 TODO
- **Plan:**
    - [ ] zstd or lz4 compression for file transfers
    - [ ] Auto-detect compressible file types (skip for video/images/archives)
    - [ ] Negotiate compression support in handshake
    - [ ] Show compression ratio in transfer HUD

---

## 🗂️ Feature Status Summary

| #   | Feature                 | Phase | Status  | Notes                                         |
| --- | ----------------------- | ----- | ------- | --------------------------------------------- |
| 1   | mDNS Discovery          | 1     | ✅ Done | `src-tauri/src/discovery/`                    |
| 2   | Direct Chat (TCP)       | 1     | ✅ Done | `src-tauri/src/messaging/`, chat UI complete  |
| 3   | File Transfer (Chunked) | 1     | ✅ Done | 256KB chunks, SHA-256, drag-and-drop          |
| 4   | Local DB (SQLite)       | 1     | ✅ Done | WAL mode, messages + transfers tables         |
| 5   | Dark UI (shadcn/ui)     | 1     | ✅ Done | Tailwind + shadcn, theme toggle               |
| 6   | Secure Handshake        | 1     | ✅ Done | X25519 + AES-256-GCM + TLS 1.3                |
| 7   | Zod Validation          | 1     | ✅ Done | `src/lib/schemas.ts`                          |
| 8   | Identity & Onboarding   | 1     | ✅ Done | Device ID, name, protected routes             |
| 9   | Network Health Bar      | 2     | ✅ Done | `src/components/network/NetworkHealthBar.tsx` |
| 10  | Transfer HUD            | 2     | ✅ Done | `src/components/network/TransferHUD.tsx`      |
| 11  | Group Chat              | 2     | ✅ Done | Temporary host model, fan-out, host election  |

| 12 | Resume Transfers | 2 | ✅ Done | Resume from last confirmed offset, periodic progress persist, auto-accept |
| 13 | Screen Share | 2 | 🔲 TODO | **Next up** — WebRTC or custom UDP stream |
| 14 | Offline Queue & Retry | 2 | ✅ Done | Auto-queue on failure, flush on device discovery |
| 15 | Mesh Routing | 3 | 🔲 TODO | Multi-hop message routing |
| 16 | LAN Cloud | 3 | 🔲 TODO | Backup node for sync |
| 17 | Local AI | 3 | 🔲 TODO | llama.cpp integration |
| 18 | Full-Text Search | 3 | 🔲 TODO | FTS5 / Tantivy indexing |
| 19 | Parallel Chunks | 3 | 🔲 TODO | Multi-stream file transfer |
| 20 | File Compression | 3 | 🔲 TODO | zstd/lz4 for compressible files |

---

## 🔑 Key Files Reference

| Area            | Path                                                                |
| --------------- | ------------------------------------------------------------------- |
| Tauri entry     | `src-tauri/src/lib.rs`                                              |
| Network Health  | `src/components/network/NetworkHealthBar.tsx`                       |
| Transfer HUD    | `src/components/network/TransferHUD.tsx`                            |
| Offline Queue   | `src-tauri/src/messaging/service.rs` (flush)                        |
| Group Service   | `src-tauri/src/messaging/group.rs`                                  |
| Group DB        | `src-tauri/src/db/groups.rs`                                        |
| Group Chat UI   | `src/pages/GroupChatPage.tsx`                                       |
| Group Hook      | `src/hooks/use-group-chat.ts`                                       |
| Create Group    | `src/components/group/CreateGroupDialog.tsx`                        |
| Discovery       | `src-tauri/src/discovery/mdns.rs`                                   |
| Messaging       | `src-tauri/src/messaging/service.rs`                                |
| File Transfer   | `src-tauri/src/network/file_transfer.rs`                            |
| Resume Transfer | `src-tauri/src/network/file_transfer.rs` (`resume_transfer`)        |
| Transfer DB     | `src-tauri/src/db/transfers.rs` (progress persist, resumable query) |
| TCP Server      | `src-tauri/src/network/server.rs`                                   |
| TCP Client      | `src-tauri/src/network/client.rs`                                   |
| Protocol        | `src-tauri/src/network/protocol.rs`                                 |
| Crypto          | `src-tauri/src/crypto/`                                             |
| Database        | `src-tauri/src/db/`                                                 |
| IPC Commands    | `src-tauri/src/ipc/commands.rs`                                     |
| Zustand Store   | `src/store/index.ts`                                                |
| Types           | `src/types/index.ts`                                                |
| Schemas         | `src/lib/schemas.ts`                                                |
| Routes          | `src/routes.tsx`                                                    |
| Sidebar         | `src/components/layout/Sidebar.tsx`                                 |
| Chat UI         | `src/components/chat/`                                              |
| Discovery UI    | `src/components/discovery/DeviceList.tsx`                           |
