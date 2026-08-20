-- ─────────────────────────────────────────────────────────────────────────
-- JNguyen Co. CRM — Auto-recorded contractor payment expenses
-- When a booking_contractors assignment is marked Paid, the app now
-- auto-creates a matching row in `expenses` (category CONTRACTOR_PAYMENTS)
-- so contractor payouts show up in P&L / financial-year totals without
-- manual double-entry. Unmarking Paid removes the auto-created expense.
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────

-- Link an expense back to the assignment that generated it (NULL for
-- manually-entered expenses).
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS source_booking_contractor_id UUID
    REFERENCES booking_contractors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS expenses_source_booking_contractor
  ON expenses(source_booking_contractor_id)
  WHERE source_booking_contractor_id IS NOT NULL;

-- Add a dedicated category for contractor labor payouts.
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_category_check CHECK (category IN (
  'SOFTWARE_SUBSCRIPTIONS',
  'EQUIPMENT_GEAR',
  'VEHICLE_TRAVEL',
  'MARKETING_PROFESSIONAL',
  'CONTRACTOR_PAYMENTS'
));
