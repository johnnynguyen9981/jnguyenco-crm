-- ─────────────────────────────────────────────────────────────────────────
-- JNguyen Co. CRM — Event run sheet (minute-by-minute day-of timeline)
-- Stores an editable, ordered list of {time, activity, notes} items per
-- booking so Johnny can generate a suggested schedule, tweak it, and export
-- it as a branded PDF to share with clients/crew — separate from the
-- per-crew-member "Call Sheet" (logistics/rate) which already exists.
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS run_sheet_items JSONB DEFAULT '[]'::jsonb;
