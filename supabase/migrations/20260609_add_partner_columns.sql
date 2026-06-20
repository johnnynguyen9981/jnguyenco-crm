-- Add wedding partner columns to clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS partner_first  text,
  ADD COLUMN IF NOT EXISTS partner_last   text,
  ADD COLUMN IF NOT EXISTS partner_email  text,
  ADD COLUMN IF NOT EXISTS partner_phone  text;
