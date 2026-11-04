-- Stops duplicate recurring expenses: one auto-created copy per template per date.
-- Standalone expenses have parent_expense_id = NULL, and NULLs never conflict,
-- so they are not affected.
CREATE UNIQUE INDEX IF NOT EXISTS expenses_parent_date_unique
  ON expenses (parent_expense_id, date);
