-- ─────────────────────────────────────────────────────────────────────────
-- JNguyen Co. CRM — Night-before checklist (mobile-friendly, tickable)
-- Stores per-booking tick state for the equipment/logistics/personal
-- checklist, plus when the automatic "night before" reminder email was
-- sent, so the nightly cron doesn't re-send for the same booking.
-- Follows the same pattern as bookings.run_sheet_items (JSONB on bookings,
-- no separate table). Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS checklist_state JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS checklist_sent_at TIMESTAMPTZ;
