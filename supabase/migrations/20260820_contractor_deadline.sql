-- ─────────────────────────────────────────────────────────────────────────
-- JNguyen Co. CRM — Per-assignment contractor deadline
-- Lets each crew assignment (booking_contractors) carry its own internal
-- deadline — e.g. the date a photo editor needs to hand back edited images
-- by, separate from (and usually earlier than) the client-facing delivery
-- date tracked in `deliverables`. Gives Johnny a review buffer before the
-- client due date.
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE booking_contractors
  ADD COLUMN IF NOT EXISTS deadline DATE;
