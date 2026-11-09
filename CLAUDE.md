# ScanF - Project Context & AI Guidelines (CLAUDE.md)

This project contains comprehensive architecture documentation and technical guidelines in:
👉 **[`AI_SYSTEM_MANUAL.md`](./AI_SYSTEM_MANUAL.md)**

## Quick Reference Summary

- **App Name:** ScanF (Industrial QR Scanning System for Zebra TC26 / Android APK + Web Dashboard)
- **Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React, Canvas Confetti.
- **Backend Services:**
  - **Supabase Cloud:** `https://rocvksztovacylltjopq.supabase.co/rest/v1/`
    - Tables: `inventory_scans`, `terminal_sessions`, `inventory_round_control`, `sharepoint_settings`.
  - **Power Automate Webhook (SharePoint Excel):**
    - Target Excel file: `Scaneo fiscal 2026.xlsx`
    - Tables: `TablaConteo1`, `TablaConteo2`, `TablaConteo3`.
- **Modes (Apartados):**
  1. **Apartado 1 (APK / Zebra TC26 Handheld):** Clean single-screen scanner view. No navigation tabs. Laser wedge hardware keystroke wedge input debounced. Fila 1 (Picking) Rack-Columna-Fila (e.g. A-22-1) SKU auto-unlock. Real-time manual duplicate detection on onBlur/submit. Initial Check-in (Name + User 1 to 10). Round 2 authorization blocking screen.
  2. **Apartado 2 (Web / Gerente & Master):** Multi-tab dashboard (`Escáner`, `Historial Excel`, `Enlace SharePoint`). Live 10-terminal monitoring, individual round assignment, global round advancement, Excel export (.CSV).
- **Hidden Gestures & Passwords:**
  - **Secret 12-Tap:** Tap the `ScanF` logo in `Header.tsx` 12 consecutive times within 2.5 seconds to unlock `MasterAuthModal`.
  - **Master PIN:** `1234` (stored in `localStorage` key `tc26_master_pin_v2`).
  - **Force APK Mode in Browser:** URL params `?mode=apk`, `?apk=1`, `?source=pwa`, or `?twa=1`.
- **Duplicate Prevention Rules:**
  - Duplicate localizer check is strictly **within the same count round** (`1ER_CONTEO`, `2DO_CONTEO`, `3ER_CONTEO`).
  - If a localizer was scanned in 1st count, scanning it again in 2nd count or 3rd count is **allowed**.
  - If duplicate in the same round: clear 5 text boxes, sound warning, show modal, block upload.
- **No Supabase Deletion Loop:**
  - Handhelds never auto-reupload old scans.
  - When Gerente wipes Supabase, `globalResetAt` is broadcasted and all handhelds wipe their local cache and `localStorage`.
- **Session Reset / Re-login Handlers:**
  - Handled by `handleResetUserDevice(userNumber)` and `handleResetAllDevices()` in `App.tsx`, triggering `sendDeviceRebootCommand(...)`.
- **Poka-Yoke 4 & 5:**
  - **Poka-Yoke 4 (Offline Retry Queue):** Background auto-retry every 15s in FIFO batches of 3 for `pending`/`failed` SharePoint scans + manual retry button in scanner indicator.
  - **Poka-Yoke 5 (Auto-Upload Mode):** Optional 1.5s countdown before automatic Excel upload with progress bar and `[Cancelar]` button. Pauses for Fila 1 (Picking) manual SKU verification.

For complete details, schemas, JSON payloads, and button catalog, refer to **`AI_SYSTEM_MANUAL.md`**.
