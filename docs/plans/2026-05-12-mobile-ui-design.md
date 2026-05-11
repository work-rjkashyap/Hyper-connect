# Mobile UI Design - 2026-05-12

## Goal
Give the Tauri mobile experience a dedicated shell instead of compressing the desktop sidebar layout onto small screens.

## Approved Direction
- Keep the desktop sidebar/inset layout unchanged.
- Add a dedicated mobile shell with:
  - a safe-area aware top app bar
  - a bottom navigation bar for primary destinations
  - content padding that respects status bar and bottom navigation height
  - drawer access for secondary navigation only
- Improve key mobile screens so they fit within the new shell cleanly.

## Mobile Shell
- Top app bar:
  - safe-area top padding
  - route title
  - contextual leading action (menu or back)
  - minimal trailing action
- Bottom navigation:
  - Discovery
  - Chats
  - AI/Search
  - Settings
  - safe-area bottom padding
- Content region:
  - reserve space for the app bar and bottom nav
  - avoid overlap with chat composer and list content

## Page Behavior
- Chat remains a focused conversation view.
- Discovery becomes easier to scan on small screens.
- Settings uses one-column spacing with cleaner section rhythm.
- Empty state on mobile should guide users toward discovery or chat navigation.

## Validation
- Run frontend validation after edits.
- Spot check mobile route shell, chat, discovery, and settings behavior.
