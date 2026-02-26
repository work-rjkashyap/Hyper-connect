# Hyper Connect — Feature Status & TODO

> **Last updated:** 2025-01-21
>
> **Architecture:** Tauri 2 (Rust backend + React 19 frontend) — Pure P2P on LAN, no cloud, no central server.

---

## 📊 Overall Progress

| Phase   | Total | Done | In Progress | TODO |
| ------- | ----- | ---- | ----------- | ---- |
| Phase 1 | 8     | 8    | 0           | 0    |
| Phase 2 | 6     | 6    | 0           | 0    |
| Phase 3 | 6     | 5    | 0           | 1    |

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
    - [x] Parallel chunk transfers (Phase 3) ✅
    - [x] Compression (Phase 3) ✅

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
- **Files:**
    - Backend: `src-tauri/src/crypto/handshake.rs`, `src-tauri/src/crypto/session.rs`, `src-tauri/src/crypto/message_crypto.rs`, `src-tauri/src/crypto/tls.rs`, `src-tauri/src/network/secure_channel.rs`
    - Backend (SAS verification): `src-tauri/src/crypto/verification.rs`, `src-tauri/src/crypto/verification_service.rs`
    - Backend (SAS protocol): `src-tauri/src/network/protocol.rs` (SasVerifyRequest, SasConfirm, SasReject frame types)
    - Backend (SAS IPC): `src-tauri/src/ipc/commands.rs` (`initiate_verification`, `confirm_verification`, `reject_verification`, `get_verification_status`, `get_verified_devices`, `revoke_verification`, `get_all_verification_statuses`)
    - Frontend: `src/hooks/use-secure-handshake.ts`, `src/components/network/HandshakeVerificationDialog.tsx`
    - Frontend: `src/components/chat/ChatWindow.tsx` (Verified/Unverified badge + Verify button in header)
    - Frontend: `src/store/index.ts` (verificationStatuses, verifiedDevices state slices)
    - Frontend: `src/types/index.ts`, `src/lib/schemas.ts` (VerificationState, VerificationStatus types + Zod schemas)
- **Details:**
    - [x] X25519 ECDH key exchange (Diffie-Hellman)
    - [x] HKDF key derivation (separate keys for messages & files)
    - [x] AES-256-GCM authenticated message encryption
    - [x] AES-256-CTR streaming file encryption
    - [x] Perfect Forward Secrecy (ephemeral keys per connection)
    - [x] TLS 1.3 transport layer (self-signed certs, TOFU model)
    - [x] Concurrent handshake support (unique handshake_id per connection)
    - [x] SecureChannelManager shared across tasks
    - [x] SAS verification code display (6-digit `XXX-XXX` derived from ECDH shared secret via HKDF-SHA256)
    - [x] VerificationService managed state tracks pending/verified peers across connections
    - [x] SAS protocol frames: SasVerifyRequest (0x1A), SasConfirm (0x18), SasReject (0x19)
    - [x] Bidirectional confirm/reject flow — both sides must confirm for Verified status
    - [x] HandshakeVerificationDialog UI with animated code display, confirm/reject buttons, state badges
    - [x] Chat header shows "Verified" (lock icon) or "Unverified" (shield alert) badge when connected
    - [x] "Verify Connection" option in chat dropdown menu
    - [x] Verified devices persisted to localStorage across app restarts
    - [x] 30 new Rust tests (verification code generation, deterministic derivation, ECDH matching, service state machine)
    - [x] Tauri events: `verification-code-ready`, `handshake-verified`, `handshake-rejected`, `verification-remote-confirmed`

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

- **Status:** ✅ Done
- **Priority:** Low
- **Files:**
    - Backend: `src-tauri/src/screen_share/mod.rs` (module entry, re-exports)
    - Backend: `src-tauri/src/screen_share/types.rs` (session state, signaling payloads, UDP frame header, quality presets, events)
    - Backend: `src-tauri/src/screen_share/service.rs` (capture, JPEG encode, UDP streaming, session management, frame reassembly)
    - Backend: `src-tauri/src/ipc/commands.rs` (`start_screen_share`, `answer_screen_share`, `stop_screen_share`, `get_screen_share_sessions`)
    - Backend: `src-tauri/src/network/server.rs` (SCREEN_SHARE_OFFER/ANSWER/STOP signaling in encrypted message router)
    - Backend: `src-tauri/src/lib.rs` (ScreenShareService init + command registration)
    - Frontend: `src/types/index.ts` (ScreenShareSession, events, StreamQuality types)
    - Frontend: `src/hooks/use-screen-share.ts` (Tauri event listeners, IPC actions, frame rendering state)
    - Frontend: `src/pages/ScreenSharePage.tsx` (device picker, quality selector, stream viewer, stats bar)
    - Frontend: `src/components/screen-share/ScreenShareOfferDialog.tsx` (global offer accept/reject dialog)
    - Frontend: `src/components/layout/RootLayout.tsx` (ScreenShareOfferDialog mounted globally)
    - Frontend: `src/components/layout/Sidebar.tsx` (Screen Share menu item in dropdown)
    - Frontend: `src/components/chat/ChatWindow.tsx` (`onScreenShare` prop wired to Video button)
    - Frontend: `src/pages/ChatPage.tsx` (navigates to `/screen-share/:deviceId` on Video click)
    - Frontend: `src/routes.tsx` (`/screen-share` and `/screen-share/:deviceId` routes)
- **Details:**
    - [x] Custom UDP frame streaming (JPEG-encoded screen captures, chunked for MTU)
    - [x] Signaling via existing encrypted TCP connections (SCREEN_SHARE_OFFER/ANSWER/STOP)
    - [x] Quality presets: Low (720p/15fps), Medium (1080p/24fps), High (native/30fps)
    - [x] Platform-native screen capture (macOS `screencapture`, Linux `scrot`/`gnome-screenshot`)
    - [x] UDP frame header with session ID, sequence numbers, chunk reassembly (32-byte binary header)
    - [x] Viewer frame reassembly from multi-chunk UDP datagrams
    - [x] Session lifecycle: Offer → Accept/Reject → Stream → Stop
    - [x] Screen share page with device picker, quality selector, and stream viewer
    - [x] Global ScreenShareOfferDialog for accepting/rejecting offers from any page
    - [x] Real-time stats bar (FPS, frame size, total bytes, dropped frames)
    - [x] Fullscreen viewer mode with Escape key support
    - [x] Video button in ChatWindow header navigates to screen share with pre-selected device
    - [x] Sidebar dropdown menu entry for Screen Share
    - [x] Cancellation support (either side can stop at any time)
    - [x] 13 unit tests (frame header encode/decode, UUID roundtrip, quality presets, MTU bounds, session/service creation, frame reassembly)

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

- **Status:** ✅ Done
- **Priority:** Medium
- **Files:**
    - Backend: `src-tauri/src/mesh/mod.rs` (module entry, re-exports)
    - Backend: `src-tauri/src/mesh/types.rs` (RoutingEntry, MeshRoutingTable, MeshRelayPayload, MeshTopologyAnnouncement, TopologyNeighbor, MeshRoute, frontend event types)
    - Backend: `src-tauri/src/mesh/router.rs` (MeshRouter service: topology exchange, relay forwarding, deduplication, periodic purge, route management)
    - Backend: `src-tauri/src/ipc/commands.rs` (`get_mesh_routes`, `get_mesh_route_to`, `set_mesh_enabled`, `get_mesh_enabled`, `get_mesh_relay_count`)
    - Backend: `src-tauri/src/network/server.rs` (MESH_TOPOLOGY and MESH_RELAY handlers in encrypted message router, relayed TEXT_MESSAGE delivery)
    - Backend: `src-tauri/src/discovery/mdns.rs` (MeshRouter integration: `on_device_discovered` / `on_device_removed` hooks)
    - Backend: `src-tauri/src/lib.rs` (MeshRouter init, topology task auto-start, 5 mesh IPC commands registered)
    - Frontend: `src/types/index.ts` (MeshRoute, MeshRoutingUpdatedEvent, MeshMessageRelayedEvent, MeshMessageDeliveredEvent)
    - Frontend: `src/hooks/use-mesh-routing.ts` (Tauri event listeners, IPC actions, route/relay state)
    - Frontend: `src/components/network/NetworkHealthBar.tsx` (mesh routing indicator: relay count + multi-hop badge with GitBranch icon)
    - Frontend: `src/pages/SettingsPage.tsx` (mesh routing enable/disable toggle in Network & Discovery section with stats)
- **Details:**
    - [x] Route messages through intermediate devices: `A → B → C → D`
    - [x] Routing table built from mDNS topology + periodic topology announcements
    - [x] Topology announcements (`MESH_TOPOLOGY`) exchanged with direct peers every 30 seconds
    - [x] Relay protocol (`MESH_RELAY`): wraps inner message with origin, destination, hop list, TTL
    - [x] TTL (default 5, max 8) prevents infinite routing loops
    - [x] Hop-list deduplication prevents cycles (device cannot relay a message it already forwarded)
    - [x] Relay ID deduplication (up to 4096 seen IDs) prevents duplicate deliveries
    - [x] Route expiry: stale routes auto-purged after 120 seconds
    - [x] Direct routes always preferred over relayed routes
    - [x] Shorter routes preferred when multiple relayed paths exist
    - [x] Relayed TEXT_MESSAGE delivery: inner payload re-dispatched through existing message pipeline
    - [x] MeshRouter auto-integrated with mDNS discovery (direct routes added/removed automatically)
    - [x] Enable/disable toggle in Settings → Network & Discovery with live stats
    - [x] Network Health Bar shows mesh indicator (relay count, multi-hop destinations)
    - [x] Toast notification when a message arrives via mesh relay
    - [x] 34 unit tests (routing table CRUD, merge announcements, TTL enforcement, loop detection, deduplication, relay forwarding, serialization, route expiry, constants validation)

### 16. LAN Cloud (Backup Node)

- **Status:** 🔲 TODO
- **Plan:**
    - [ ] Designate 1 device as backup node
    - [ ] Others sync chat history & files when online
    - [ ] Works as an office server without internet
    - [ ] Conflict resolution via timestamps

### 17. AI Integration (Google Gemini)

- **Status:** ✅ Done
- **Files:**
    - Backend: `src-tauri/src/ai/types.rs` (Gemini API request/response types, AI action/status enums, chat message types)
    - Backend: `src-tauri/src/ai/service.rs` (`AiService` — Gemini REST API client, summarize, smart reply, ask, smart search, analyze)
    - Backend: `src-tauri/src/ai/mod.rs` (module entry point)
    - Backend: `src-tauri/src/ipc/commands.rs` (11 AI IPC commands: `ai_set_api_key`, `ai_clear_api_key`, `ai_set_model`, `ai_get_status`, `ai_summarize_chat`, `ai_smart_reply`, `ai_ask`, `ai_smart_search`, `ai_analyze_chat`, `ai_get_conversation_history`, `ai_clear_conversation_history`)
    - Backend: `src-tauri/src/lib.rs` (AI module registration, `AiService` managed state, 11 IPC commands registered)
    - Backend: `Cargo.toml` (`reqwest = "0.12"` with `json` + `rustls-tls` features)
    - Frontend: `src/types/index.ts` (AI types: `AiModel`, `AiAction`, `AiServiceStatus`, `AiChatRole`, `AiStatus`, `AiChatMessage`, `SummarizeResponse`, `SmartReplyResponse`, `AskResponse`, `SmartSearchResult`, `SmartSearchResponse`, `AnalyzeResponse`, AI events)
    - Frontend: `src/hooks/use-ai.ts` (full AI hook: status, config, summarize, smart reply, ask, smart search, analyze, conversation history)
    - Frontend: `src/pages/AiChatPage.tsx` (dedicated AI assistant page with chat UI, quick actions, conversation picker, settings panel, summary/search/analysis cards)
    - Frontend: `src/routes.tsx` (`/ai` route)
    - Frontend: `src/components/layout/Sidebar.tsx` (AI Assistant dropdown menu entry with Sparkles icon)
    - Frontend: `src/components/chat/ChatWindow.tsx` (smart reply suggestion bar, summarize/analyze overlays, AI dropdown menu items)
    - Frontend: `src/pages/ChatPage.tsx` (AI integration: smart replies, summarize, analyze wired to ChatWindow)
    - Frontend: `src/pages/SettingsPage.tsx` (AI Assistant settings section: API key input, model selector, session stats, error display)
- **Details:**
    - [x] Google Gemini REST API integration (v1beta `generateContent` endpoint)
    - [x] Secure API key handling — key set via IPC, stored only in Rust memory, never exposed to frontend JS
    - [x] Model selection: Gemini 2.5 Flash (default), Gemini 2.0 Flash, Gemini 2.5 Pro
    - [x] Chat summarization — summarize any direct or group conversation with configurable message limit
    - [x] Smart reply suggestions — generates 3 context-aware reply options shown as pill buttons above chat input
    - [x] Free-form AI assistant — dedicated `/ai` page with persistent session conversation history (last 50 messages)
    - [x] Semantic smart search — combines FTS5 candidate retrieval with Gemini re-ranking and relevance explanation
    - [x] Conversation analysis — tone, topics, activity level, and insights via structured JSON output
    - [x] In-chat integration — summarize, analyze, and smart reply accessible from chat dropdown menu
    - [x] Summary & analysis overlays displayed inline in ChatWindow with dismissible cards
    - [x] AI settings in Settings page — API key management, model picker, session stats (requests, tokens)
    - [x] Event-driven processing indicators (`ai-processing`, `ai-completed` Tauri events)
    - [x] Error handling — API errors, network failures, JSON parse fallbacks for AI responses
    - [x] Quick actions on AI page — summarize, smart search, analyze, ask anything
    - [x] Conversation picker modal for selecting which chat to summarize or analyze
    - [x] Copy-to-clipboard on AI responses
    - [x] Token usage tracking per session (request count + total tokens)
    - [x] 27 unit tests (types serialization, message formatting, response extraction, search result parsing)

### 18. Full-Text Search Engine

- **Status:** ✅ Done
- **Files:**
    - Backend: `src-tauri/src/db/search.rs` (FTS5 search queries: `search_messages`, `search_group_messages`, `search_files`, `search_all`, `rebuild_fts_indexes`)
    - Backend: `src-tauri/src/db/mod.rs` (FTS5 virtual tables, sync triggers, backfill migration)
    - Backend: `src-tauri/src/ipc/commands.rs` (`search_all`, `search_messages_cmd`, `search_group_messages_cmd`, `search_files_cmd`, `rebuild_search_index`)
    - Backend: `src-tauri/src/messaging/service.rs` (`db_pool()` accessor for search)
    - Backend: `src-tauri/src/lib.rs` (registered 5 search IPC commands)
    - Frontend: `src/types/index.ts` (`MessageSearchResult`, `GroupMessageSearchResult`, `FileSearchResult`, `SearchResult`, `SearchResponse`)
    - Frontend: `src/hooks/use-search.ts` (debounced search hook with filter support)
    - Frontend: `src/pages/SearchPage.tsx` (full search UI with filter tabs, highlighted snippets, result cards)
    - Frontend: `src/routes.tsx` (`/search` route)
    - Frontend: `src/components/layout/Sidebar.tsx` (🔍 search button in header + dropdown menu item)
- **Details:**
    - [x] SQLite FTS5 for indexing (content-sync mode with triggers for auto-sync)
    - [x] Index: messages, group messages, file transfers (filenames)
    - [x] Instant search, no internet required — all local FTS5 queries
    - [x] Search UI with filter tabs (All, Messages, Groups, Files) and per-category counts
    - [x] FTS5 snippet highlighting with `<b>` tags rendered as bold spans in UI
    - [x] Debounced search input (200ms) with stale-result protection
    - [x] Input sanitisation: user queries are quoted + prefix-wildcarded to prevent FTS5 syntax errors
    - [x] Backfill migration: existing data indexed on first launch
    - [x] `rebuild_search_index` IPC for manual re-index
    - [x] FTS indexes cleared on app reset (`clear_all_data`)
    - [x] Click-to-navigate: message results → chat page, group results → group page, file results → chat page
    - [x] 6 unit tests for FTS query sanitisation

### 19. Parallel Chunk Transfers

- **Status:** ✅ Done
- **Files:**
    - Backend: `src-tauri/src/network/file_transfer.rs` (`perform_parallel_stream`, `stream_range`)
    - Backend: `src-tauri/src/network/protocol.rs` (`parallel_streams` field on `FileRequestPayload`)
    - Backend: `src-tauri/src/db/mod.rs` (migration for `parallel_streams` column)
    - Backend: `src-tauri/src/db/transfers.rs` (read/write `parallel_streams`)
    - Frontend: `src/types/index.ts` (`parallel_streams` on `FileTransfer`)
    - Frontend: `src/lib/schemas.ts` (`parallel_streams` in Zod schema)
    - Frontend: `src/components/network/TransferHUD.tsx` (⚡ parallel stream badge)
- **Details:**
    - [x] Split file into N chunks, send over parallel TCP streams (4 streams by default)
    - [x] Reassemble at receiver with offset tracking (existing `SeekFrom::Start(offset)` write)
    - [x] Auto-detect: files ≥10 MB use parallel streams, smaller files stay single-stream
    - [x] Atomic progress counters aggregate per-stream progress into single transfer progress
    - [x] Cancel/pause checked per-stream, all streams exit cooperatively
    - [x] Full-file SHA-256 checksum computed sequentially after all streams complete
    - [x] UI shows parallel stream count badge (⚡ 4×) in TransferHUD

### 20. File Compression

- **Status:** ✅ Done
- **Files:**
    - Backend: `src-tauri/src/network/file_transfer.rs` (`should_compress`, `compress_chunk`, `decompress_chunk`)
    - Backend: `src-tauri/src/network/protocol.rs` (`compression` field on `FileRequestPayload`, `compressed_size` on `FileDataHeader`)
    - Backend: `src-tauri/src/db/mod.rs` (migration for `compression`, `compression_ratio` columns)
    - Backend: `src-tauri/src/db/transfers.rs` (read/write compression fields)
    - Backend: `Cargo.toml` (`zstd = "0.13"`)
    - Frontend: `src/types/index.ts` (`compression`, `compression_ratio` on `FileTransfer` and `TransferProgressEvent`)
    - Frontend: `src/lib/schemas.ts` (Zod schema updated)
    - Frontend: `src/hooks/use-file-transfers.ts` (`compression_ratio` in progress event handler)
    - Frontend: `src/components/network/TransferHUD.tsx` (compression ratio badge with Minimize2 icon)
- **Details:**
    - [x] zstd compression for file transfers (level 3, good speed/ratio balance for LAN)
    - [x] Auto-detect compressible file types (skip for video/images/archives via extension list)
    - [x] Compression negotiated via `compression` field in `FileRequestPayload`
    - [x] Per-chunk compression with fallback: if zstd makes a chunk bigger, send uncompressed
    - [x] `FileDataHeader` carries `compressed_size` — receiver decompresses transparently
    - [x] Backward compatible: `compressed_size=0` means uncompressed (legacy senders work)
    - [x] Show compression ratio in transfer HUD (e.g. "zstd 2.3x" badge)
    - [x] Compression ratio tracked in `FileTransfer` struct and persisted to SQLite

---

## 🗂️ Feature Status Summary

| #   | Feature                 | Phase | Status  | Notes                                                |
| --- | ----------------------- | ----- | ------- | ---------------------------------------------------- |
| 1   | mDNS Discovery          | 1     | ✅ Done | `src-tauri/src/discovery/`                           |
| 2   | Direct Chat (TCP)       | 1     | ✅ Done | `src-tauri/src/messaging/`, chat UI complete         |
| 3   | File Transfer (Chunked) | 1     | ✅ Done | 256KB chunks, SHA-256, drag-and-drop                 |
| 4   | Local DB (SQLite)       | 1     | ✅ Done | WAL mode, messages + transfers tables                |
| 5   | Dark UI (shadcn/ui)     | 1     | ✅ Done | Tailwind + shadcn, theme toggle                      |
| 6   | Secure Handshake        | 1     | ✅ Done | X25519 + AES-256-GCM + TLS 1.3 + SAS verification UI |
| 7   | Zod Validation          | 1     | ✅ Done | `src/lib/schemas.ts`                                 |
| 8   | Identity & Onboarding   | 1     | ✅ Done | Device ID, name, protected routes                    |
| 9   | Network Health Bar      | 2     | ✅ Done | `src/components/network/NetworkHealthBar.tsx`        |
| 10  | Transfer HUD            | 2     | ✅ Done | `src/components/network/TransferHUD.tsx`             |
| 11  | Group Chat              | 2     | ✅ Done | Temporary host model, fan-out, host election         |

| 12 | Resume Transfers | 2 | ✅ Done | Resume from last confirmed offset, periodic progress persist, auto-accept |
| 13 | Screen Share | 2 | ✅ Done | Custom UDP stream, signaling over encrypted TCP, quality presets |
| 14 | Offline Queue & Retry | 2 | ✅ Done | Auto-queue on failure, flush on device discovery |
| 15 | Mesh Routing | 3 | ✅ Done | Multi-hop relay via topology announcements, TTL + loop detection |
| 16 | LAN Cloud | 3 | 🔲 TODO | Backup node for sync |
| 17 | AI Integration | 3 | ✅ Done | Google Gemini: summarize, smart reply, AI chat, smart search, analyze |
| 18 | Full-Text Search | 3 | ✅ Done | FTS5 indexes, search UI with filters, snippets |
| 19 | Parallel Chunks | 3 | ✅ Done | 4-stream parallel transfer for files ≥10 MB |
| 20 | File Compression | 3 | ✅ Done | zstd compression, auto-detect, ratio in HUD |

---

## 🔑 Key Files Reference

| Area             | Path                                                                |
| ---------------- | ------------------------------------------------------------------- |
| Tauri entry      | `src-tauri/src/lib.rs`                                              |
| Network Health   | `src/components/network/NetworkHealthBar.tsx`                       |
| Transfer HUD     | `src/components/network/TransferHUD.tsx`                            |
| Offline Queue    | `src-tauri/src/messaging/service.rs` (flush)                        |
| Group Service    | `src-tauri/src/messaging/group.rs`                                  |
| Group DB         | `src-tauri/src/db/groups.rs`                                        |
| Group Chat UI    | `src/pages/GroupChatPage.tsx`                                       |
| Group Hook       | `src/hooks/use-group-chat.ts`                                       |
| Create Group     | `src/components/group/CreateGroupDialog.tsx`                        |
| Discovery        | `src-tauri/src/discovery/mdns.rs`                                   |
| Messaging        | `src-tauri/src/messaging/service.rs`                                |
| File Transfer    | `src-tauri/src/network/file_transfer.rs`                            |
| Resume Transfer  | `src-tauri/src/network/file_transfer.rs` (`resume_transfer`)        |
| Transfer DB      | `src-tauri/src/db/transfers.rs` (progress persist, resumable query) |
| TCP Server       | `src-tauri/src/network/server.rs`                                   |
| TCP Client       | `src-tauri/src/network/client.rs`                                   |
| Protocol         | `src-tauri/src/network/protocol.rs`                                 |
| Crypto           | `src-tauri/src/crypto/`                                             |
| SAS Verification | `src-tauri/src/crypto/verification.rs` (code derivation)            |
| SAS Service      | `src-tauri/src/crypto/verification_service.rs` (state management)   |
| SAS Hook         | `src/hooks/use-secure-handshake.ts`                                 |
| SAS Dialog       | `src/components/network/HandshakeVerificationDialog.tsx`            |
| Database         | `src-tauri/src/db/`                                                 |
| IPC Commands     | `src-tauri/src/ipc/commands.rs`                                     |
| Zustand Store    | `src/store/index.ts`                                                |
| Types            | `src/types/index.ts`                                                |
| Schemas          | `src/lib/schemas.ts`                                                |
| Routes           | `src/routes.tsx`                                                    |
| Sidebar          | `src/components/layout/Sidebar.tsx`                                 |
| Chat UI          | `src/components/chat/`                                              |
| Discovery UI     | `src/components/discovery/DeviceList.tsx`                           |
| FTS5 Search DB   | `src-tauri/src/db/search.rs` (FTS5 queries, sanitisation, rebuild)  |
| Search IPC       | `src-tauri/src/ipc/commands.rs` (`search_all`, `search_*_cmd`)      |
| Search Hook      | `src/hooks/use-search.ts` (debounced search with filters)           |
| Search UI        | `src/pages/SearchPage.tsx` (filter tabs, snippets, result cards)    |
| AI Service       | `src-tauri/src/ai/service.rs` (Gemini API, summarize, smart reply)  |
| AI Types         | `src-tauri/src/ai/types.rs` (request/response types, enums)         |
| AI Hook          | `src/hooks/use-ai.ts` (AI actions, status, event listeners)         |
| AI Chat UI       | `src/pages/AiChatPage.tsx` (assistant page, quick actions, cards)   |
