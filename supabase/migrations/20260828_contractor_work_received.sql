-- ─────────────────────────────────────────────────────────────────────────
-- JNguyen Co. CRM — Contractor "work received" tracking
--
-- Problem: the existing `deadline` column on booking_contractors drives the
-- red "overdue" badge purely by comparing the stored date to today. It has
-- no way to know the work actually came back, so a completed, paid
-- assignment stays red forever once its deadline passes. Editing `deadline`
-- after the fact to "clear" the badge destroys the original agreed date,
-- which Johnny wants kept as a fixed record for contractor
-- performance/rate conversations.
--
-- Fix: add a separate `work_received_at` date. `deadline` stays untouched
-- once set (app-level convention, not DB-enforced); `work_received_at` is
-- the new field the UI toggles when a contractor's work actually comes
-- back. The overdue badge becomes a function of both columns instead of
-- `deadline` alone — see isOverdue()/badge logic in ContractorAssignment.tsx.
--
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE booking_contractors
  ADD COLUMN IF NOT EXISTS work_received_at DATE;
