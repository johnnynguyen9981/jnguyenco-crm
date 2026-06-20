-- ── bookings: add missing columns ───────────────────────────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS venue_name         text,
  ADD COLUMN IF NOT EXISTS venue_address      text,
  ADD COLUMN IF NOT EXISTS ceremony_venue     text,
  ADD COLUMN IF NOT EXISTS reception_venue    text,
  ADD COLUMN IF NOT EXISTS event_start_time   text,
  ADD COLUMN IF NOT EXISTS event_end_time     text,
  ADD COLUMN IF NOT EXISTS hours_booked       numeric,
  ADD COLUMN IF NOT EXISTS shot_list          text,
  ADD COLUMN IF NOT EXISTS special_requests   text,
  ADD COLUMN IF NOT EXISTS internal_notes     text,
  ADD COLUMN IF NOT EXISTS contract_sent_at   timestamptz,
  ADD COLUMN IF NOT EXISTS contract_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS gcal_event_id      text;

-- ── clients: add partner columns ─────────────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS partner_first  text,
  ADD COLUMN IF NOT EXISTS partner_last   text,
  ADD COLUMN IF NOT EXISTS partner_email  text,
  ADD COLUMN IF NOT EXISTS partner_phone  text;

-- ── invoices: rename columns to match app code ───────────────────────────────
-- Only rename if the old column exists and new one doesn't
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='total')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='total_amount')
  THEN
    ALTER TABLE invoices RENAME COLUMN total TO total_amount;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='gst')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='gst_amount')
  THEN
    ALTER TABLE invoices RENAME COLUMN gst TO gst_amount;
  END IF;
END $$;

-- Add columns that were missing entirely
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS issue_date  date;
