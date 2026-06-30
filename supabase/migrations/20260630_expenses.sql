-- ─────────────────────────────────────────────────────────────────────────
-- JNguyen Co. CRM — Business Expenses Table
-- Run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expenses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  vendor              TEXT,
  category            TEXT NOT NULL CHECK (category IN (
                        'SOFTWARE_SUBSCRIPTIONS',
                        'EQUIPMENT_GEAR',
                        'VEHICLE_TRAVEL',
                        'MARKETING_PROFESSIONAL'
                      )),
  amount              NUMERIC(10, 2) NOT NULL DEFAULT 0,
  date                DATE NOT NULL,
  notes               TEXT,
  -- Recurring
  is_recurring        BOOLEAN NOT NULL DEFAULT false,
  recurring_frequency TEXT CHECK (recurring_frequency IN ('MONTHLY', 'ANNUAL')),
  last_generated_date DATE,           -- tracks when the last auto-entry was made
  -- Google Drive receipt
  gdrive_file_id      TEXT,
  gdrive_file_name    TEXT,
  gdrive_file_url     TEXT,
  -- Australian financial year e.g. "2024-25"
  financial_year      TEXT NOT NULL,
  -- Links to a parent recurring template (NULL = standalone or the template itself)
  parent_expense_id   UUID REFERENCES expenses(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast FY + owner lookups
CREATE INDEX IF NOT EXISTS expenses_owner_fy ON expenses(owner_id, financial_year);
CREATE INDEX IF NOT EXISTS expenses_owner_date ON expenses(owner_id, date DESC);
CREATE INDEX IF NOT EXISTS expenses_recurring ON expenses(is_recurring, last_generated_date)
  WHERE is_recurring = true;

-- RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_owner" ON expenses;
CREATE POLICY "expenses_owner" ON expenses
  FOR ALL USING (owner_id = auth.uid());
