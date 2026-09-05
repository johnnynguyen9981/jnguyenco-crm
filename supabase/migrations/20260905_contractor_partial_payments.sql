-- ─────────────────────────────────────────────────────────────────────────
-- JNguyen Co. CRM — Partial contractor payments
--
-- Problem: booking_contractors.paid is a plain boolean — there was no way
-- to record "paid $140 of $280 now, rest after the event." The badge could
-- only say Paid or Unpaid for the whole assignment.
--
-- Fix: add `amount_paid`, a running total of what's actually been paid out
-- so far. `paid` still means "fully settled" (unchanged — it's what drives
-- the auto-recorded Expense for the full amount, see
-- 20260820_contractor_payment_expenses.sql) and stays in lockstep with
-- amount_paid: the API auto-flips `paid` to true once amount_paid reaches
-- the computed total, and resets amount_paid to 0 whenever an assignment is
-- explicitly unmarked Paid. See app/api/bookings/[id]/contractors/[assignmentId]/route.ts.
--
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE booking_contractors
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC NOT NULL DEFAULT 0;
