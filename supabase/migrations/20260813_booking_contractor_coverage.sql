-- ─────────────────────────────────────────────────────────────────────────
-- JNguyen Co. CRM — Per-booking crew rate type + coverage window
-- Lets each crew assignment (booking_contractors) carry its own rate type
-- (HOURLY vs PER_PROJECT — e.g. a second photographer is usually hourly,
-- a photo editor is usually per-project) and its own coverage start/end
-- time, which may be a subset of the full booking's event hours (e.g. a
-- second shooter only covers the ceremony, not the reception).
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. New columns ────────────────────────────────────────────────────────
ALTER TABLE booking_contractors
  ADD COLUMN IF NOT EXISTS rate_type TEXT,
  ADD COLUMN IF NOT EXISTS coverage_start_time TIME,
  ADD COLUMN IF NOT EXISTS coverage_end_time TIME;

-- ── 2. rate_type check constraint ─────────────────────────────────────────
DO $$
DECLARE con record;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (c.conkey)
    WHERE rel.relname = 'booking_contractors' AND c.contype = 'c' AND att.attname = 'rate_type'
  LOOP
    EXECUTE format('ALTER TABLE booking_contractors DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE booking_contractors ADD CONSTRAINT booking_contractors_rate_type_check
  CHECK (rate_type IS NULL OR rate_type IN ('HOURLY', 'PER_PROJECT'));
