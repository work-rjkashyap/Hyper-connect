# Design & Layout Principles

Optimize for visual density, clarity, and consistency. Avoid oversized marketing-style layouts.

## Layout & Spacing
- **Constraints**: Always use `max-w-7xl` (1280px) and `mx-auto` for content containers.
- **Padding**: Mobile `px-4`, Tablet `px-6`, Desktop `px-8`.
- **Vertical spacing**: Default `py-10`, Hero max `py-14`. Stack with `space-y-3/4/6`.
- **Grids**: Desktop max `grid-cols-3` (4 for small icons). Tablet `grid-cols-2`. Mobile `grid-cols-1`.
- **Ideal Card Width**: 280px - 360px. Avoid edge-to-edge cards.

## Typography & Visuals
- **Text**: Base `text-sm` or `text-base` only.
- **Headings**: H1 (`text-3xl`), H2 (`text-2xl`), H3 (`text-lg`).
- **Line Height**: `leading-5` or `leading-6`. Avoid loose line heights.
- **Style**: Prefer borders (`border-border`) over shadows. Use `rounded-md` (Dialogs/Sheets `rounded-lg`).
- **Utilities to Avoid**: `py-24+`, `space-y-10+`, `gap-12+`, `text-5xl+`, `leading-loose`.

## Component Defaults (Shadcn UI)
- **Controls**: Match height for Buttons, Inputs, and Selects (`h-9` or `h-10`).
- **Cards**: Default `p-4` or `p-6`. Avoid combining `p-6` with `space-y-6`.
- **Preference**: If a design choice is unclear, choose the more compact option.
