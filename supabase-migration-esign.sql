-- Run this in Supabase dashboard → SQL Editor
-- Adds e-signature token fields to bookings table

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS contract_sign_token      text UNIQUE,
  ADD COLUMN IF NOT EXISTS contract_sign_expires_at timestamptz;
