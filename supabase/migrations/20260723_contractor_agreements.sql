-- ─────────────────────────────────────────────────────────────────────────
-- JNguyen Co. CRM — Contractor Agreements
-- Extends the existing `contractors` table (previously used only for
-- on-shoot crew assigned to bookings — Thujey/Suri as PHOTOGRAPHER /
-- VIDEOGRAPHER) to also support ongoing business-services contractors
-- (e.g. a Photo Editor) with a rate type, start date, and PDF agreement
-- generation tracking.
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. New columns ────────────────────────────────────────────────────────
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS rate_type TEXT;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS contract_generated_at TIMESTAMPTZ;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS contract_file_name TEXT;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── 2. rate_type check constraint ─────────────────────────────────────────
DO $$
DECLARE con record;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (c.conkey)
    WHERE rel.relname = 'contractors' AND c.contype = 'c' AND att.attname = 'rate_type'
  LOOP
    EXECUTE format('ALTER TABLE contractors DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE contractors ADD CONSTRAINT contractors_rate_type_check
  CHECK (rate_type IS NULL OR rate_type IN ('HOURLY', 'PER_PROJECT'));

-- ── 3. Widen role check constraint to add PHOTO_EDITOR / OTHER ────────────
-- (Dynamically finds the existing constraint regardless of its name, since
-- the original `contractors` table wasn't created via a migration in this
-- repo and its constraint name is unknown.)
DO $$
DECLARE con record;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (c.conkey)
    WHERE rel.relname = 'contractors' AND c.contype = 'c' AND att.attname = 'role'
  LOOP
    EXECUTE format('ALTER TABLE contractors DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE contractors ADD CONSTRAINT contractors_role_check
  CHECK (role IN ('PHOTOGRAPHER', 'VIDEOGRAPHER', 'BOTH', 'PHOTO_EDITOR', 'OTHER'));

-- ── 4. RLS — founder-only ──────────────────────────────────────────────────
-- Rate/pay data is sensitive; restrict the whole table to the FOUNDER,
-- same as invoices/payments. (Bookings write — where contractors are
-- assigned to a shoot — is already founder-only per 20260630_staff_role_access.sql,
-- so this doesn't remove any capability staff currently rely on.)
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contractors_owner" ON contractors;
DROP POLICY IF EXISTS "team_contractors_access" ON contractors;
DROP POLICY IF EXISTS "contractors_select_team" ON contractors;
DROP POLICY IF EXISTS "contractors_founder_only" ON contractors;

CREATE POLICY "contractors_founder_only" ON contractors
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND role = 'FOUNDER' AND is_active = true
    )
  );

-- Also lock down booking_contractors the same way, since it holds agreed_rate/paid.
ALTER TABLE booking_contractors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_contractors_owner" ON booking_contractors;
DROP POLICY IF EXISTS "team_booking_contractors_access" ON booking_contractors;
DROP POLICY IF EXISTS "booking_contractors_founder_only" ON booking_contractors;

CREATE POLICY "booking_contractors_founder_only" ON booking_contractors
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND role = 'FOUNDER' AND is_active = true
    )
  );
