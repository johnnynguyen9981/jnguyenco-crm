-- Run this in your Supabase dashboard → SQL Editor
-- Adds contract_signed_url to bookings table

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS contract_signed_url text;
