# Hyper Connect — Feature Roadmap & TODO

> **✅ Core Principle: Pure Peer-to-Peer on LAN**
>
> Your app = **Distributed system on local network** (no cloud, no central server)
>
> Each device runs:
>
> - Discovery service
> - Messaging service
> - File server
> - Encryption engine
>
> **No internet. No backend.**

---

## 🧩 1. Device Discovery (No Server)

### 🔹 Use Multicast / Broadcast

**Tech:**

- UDP Broadcast
- mDNS / Bonjour
- Zeroconf

**How:**

> "Hey, I'm Raj-PC at 192.168.1.5:8080"
>
> Sent every 3–5 seconds.

**UI:**

- [ ] Live device list
- [ ] Auto refresh
- [ ] No manual IP typing

**Bonus:** Show latency by ping.

---

## 🔐 2. Secure Handshake (Local Only)

When two devices connect:

### Step 1: Key Exchange

Use:

- Diffie-Hellman / RSA
- Generate session key

### Step 2: Verify

Show:

> 🔑 Security Code: `482-991`

- [ ] User confirms on both devices.
- [ ] No server involved.

---

## 💬 3. Messaging (Direct Socket)

| Tech          | Purpose            |
| ------------- | ------------------ |
| TCP/WebSocket | Reliable chat      |
| QUIC/UDP      | Optional fast mode |

**Flow:**

```
PC A → Direct → PC B
```

No relay.

**Offline?**

- [ ] Store locally → retry on reconnect.

---

## 📁 4. File Transfer (Local P2P)

Each device runs a mini file server.

**Flow:**

```
Sender → HTTP/FTP/Custom Protocol → Receiver
```

**Features:**

- [ ] Chunked upload
- [ ] Resume
- [ ] Parallel chunks
- [ ] Compression
- [ ] SHA-256 checksum verification

> Like: **AirDrop / SHAREit** (but better).

---

## 🗂️ 5. Group Chat Without Server

### Option A: Leaderless Mesh

Each device forwards messages.

```
A → B → C → D
```

### Option B: Temporary Host

- [ ] First member becomes host.
- [ ] If host leaves → new host elected.

> (Like Zoom local meetings)

---

## 🔄 6. Sync & History (Local DB Only)

**Store in:**

- SQLite
- LevelDB
- RocksDB

**Per device:**

```
/app-data/
  chats.db
  files/
  keys/
```

- [ ] Sync on reconnect.
- [ ] Conflict resolution via timestamps.

---

## 🖥️ 7. Screen Share (LAN Streaming)

No server.

**Use:**

- WebRTC (Local signaling)
- RTSP
- Custom UDP stream

- [ ] Signaling via LAN broadcast.
- [ ] Latency: <50ms.

---

## 🔍 8. Search Engine (Offline)

**Build local index:**

- SQLite FTS5
- Tantivy (Rust)

**Indexes:**

- [ ] Messages
- [ ] Files
- [ ] Users

Instant search. No internet required.

---

## 🎨 9. UI/UX Designed for Local Systems

### 🟢 Network Health Bar

Top bar:

```
LAN: Strong | 12 Devices | 4ms
```

### 🔹 Peer Card

Each device:

```
┌──────────────┐
│ Raj-PC  🟢   │
│ 4ms | Win11  │
│ 🔒 Secured   │
└──────────────┘
```

### 🔹 Transfer HUD

- [ ] Floating panel for active transfers.
- [ ] Progress bars with speed & ETA.

---

## ⚡ 10. Power Feature: "LAN Cloud"

No cloud. But:

- [ ] Pick 1 device = **Backup Node**
- [ ] Others sync when online.
- [ ] Office server without internet.

---

## 🧠 11. AI Without Internet (Optional)

Run local LLM:

- `llama.cpp`
- GGUF models

- [ ] Chat summaries without cloud.
- [ ] Smart file search.

---

## 🏗️ Recommended Tech Stack (Desktop)

### Frontend

- React 19 + Tailwind + shadcn/ui

### Backend (Local — Tauri 2 / Rust)

- **Tokio** — Async runtime
- **Hyper** — HTTP server
- **mdns** — Device discovery
- **quinn** — QUIC protocol (optional)

### Alternative Backends

| Option   | Stack                |
| -------- | -------------------- |
| **Rust** | Tokio + Hyper + mdns |

---

## 📐 Architecture (Serverless)

```
┌─────────────┐
│  UI (React) │
└──────┬──────┘
       │ IPC (Tauri Commands & Events)
┌──────▼──────┐
│ Local Core  │
│─────────────│
│ Discovery   │
│ Messaging   │
│ FileServer  │
│ Crypto      │
│ Sync        │
└──────┬──────┘
       │ LAN (TCP/UDP/WebSocket/QUIC)
┌──────▼──────┐
│  Other PCs  │
└─────────────┘
```

> **Every PC = Server + Client.**

---

## 🎯 Resume-Worthy Description

> _"Designed and implemented a fully decentralized, serverless LAN messaging and file-sharing system using peer-to-peer networking, encrypted channels, multicast discovery, and local-first storage."_

---

## ✅ Phased Implementation Plan

### Phase 1 — Strong MVP

- [ ] UDP / mDNS discovery
- [ ] Direct chat (TCP/WebSocket)
- [ ] File send (chunked, with checksum)
- [ ] Local DB (SQLite)
- [ ] Dark UI with shadcn/ui
- [ ] Secure handshake (key exchange + verification code)

### Phase 2 — Enhanced Features

- [ ] Group chat (mesh or temporary host)
- [ ] Resume transfers
- [ ] Screen share (WebRTC / UDP stream)
- [ ] Transfer HUD (floating panel)
- [ ] Network health bar
- [ ] Offline message queue & retry

### Phase 3 — Power Features

- [ ] Mesh routing (multi-hop)
- [ ] Backup node ("LAN Cloud")
- [ ] Local AI integration (llama.cpp)
- [ ] Full-text search engine (Tantivy / FTS5)
- [ ] Parallel chunk transfers
- [ ] Compression for file transfers

---

## 📋 Current Status

| Feature            | Status         | Notes                            |
| ------------------ | -------------- | -------------------------------- |
| mDNS Discovery     | ✅ Implemented | `src-tauri/src/discovery.rs`     |
| Messaging          | ✅ Implemented | `src-tauri/src/messaging.rs`     |
| File Transfer      | ✅ Implemented | `src-tauri/src/file_transfer.rs` |
| Zustand Store      | ✅ Implemented | `src/store/index.ts`             |
| Dark UI            | ✅ Implemented | Tailwind + shadcn/ui             |
| Zod Validation     | ✅ Implemented | `src/lib/schemas.ts`             |
| Secure Handshake   | 🔲 TODO        |                                  |
| Group Chat         | 🔲 TODO        |                                  |
| Resume Transfers   | 🔲 TODO        |                                  |
| Screen Share       | 🔲 TODO        |                                  |
| LAN Cloud          | 🔲 TODO        |                                  |
| Local AI           | 🔲 TODO        |                                  |
| Offline Search     | 🔲 TODO        |                                  |
| Network Health Bar | 🔲 TODO        |                                  |
| Transfer HUD       | 🔲 TODO        |                                  |
| Mesh Routing       | 🔲 TODO        |                                  |
