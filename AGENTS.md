# Hyper Connect agent notes (minimal)

- Docs are partially stale; trust executable wiring first: `package.json`, `vite.config.ts`, `src/routes.tsx`, `src/components/layout/RootLayout.tsx`, `src-tauri/src/lib.rs`, `src-tauri/src/ipc/commands.rs`.
- Single package (not monorepo): React 19 + Vite in `src/`, Tauri 2 + Rust in `src-tauri/`; package manager is npm.
- Core commands: `npm install`, `npm run dev`, `npm run tauri:dev`, `npm run build`, `npm run tauri:build`, `npm run ios`, `npm run ios:build`, `npm run ios:xcode`.
- Rust checks/tests run from `src-tauri`: `cargo check`, `cargo test`, `cargo test <name>`.
- Frontend entry is `src/main.tsx` with `createHashRouter` in `src/routes.tsx`; global realtime hooks are mounted in `src/components/layout/RootLayout.tsx`.
- Backend setup (`src-tauri/src/lib.rs`) already auto-starts TCP server, mDNS discovery/advertising, DB init, and mesh topology task.
- Do not start discovery/advertising again in frontend unless intentional; always clean up Tauri `listen(...)` unlisten callbacks.
- IPC changes must touch all three: `src-tauri/src/ipc/commands.rs`, `tauri::generate_handler!` in `src-tauri/src/lib.rs`, and `src/types/index.ts` (keep snake_case alignment).
- `update_display_name` must call backend command; full reset needs both `clear_all_data` and clearing localStorage key `hyper-connect-storage`.
- Ports/env: Vite `1420` (`1421` for iOS via `VITE_PORT`), backend TCP via `TAURI_TCP_PORT` (defaults `8080` desktop, `8081` iOS); keep `vite.config.ts`, npm scripts, and `src-tauri/tauri*.conf.json` in sync; avoid editing generated artifacts `dist/`, `src-tauri/target/`, `src-tauri/gen/`; update `src-tauri/capabilities/default.json` when adding plugin/API permissions.
