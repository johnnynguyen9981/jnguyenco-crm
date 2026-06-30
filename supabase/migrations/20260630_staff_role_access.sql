-- ── Staff Role Access: role-aware RLS + Thujey email fix ─────────────────────
-- Run in Supabase SQL Editor AFTER 20260625_add_team_support.sql.

-- ── 1. Fix Thujey's email to his actual Gmail ─────────────────────────────────
UPDATE team_members
  SET email = 'thujeyb8@gmail.com'
  WHERE email = 'thujey@jnguyen.co';

UPDATE contractors
  SET email = 'thujeyb8@gmail.com'
  WHERE email = 'thujey@jnguyen.co';

-- ── 2. bookings: all team can SELECT; only FOUNDER can write ──────────────────
DROP POLICY IF EXISTS "team_bookings_access" ON bookings;

CREATE POLICY "bookings_select_team" ON bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "bookings_write_founder" ON bookings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND role = 'FOUNDER' AND is_active = true
    )
  );

CREATE POLICY "bookings_update_founder" ON bookings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND role = 'FOUNDER' AND is_active = true
    )
  );

CREATE POLICY "bookings_delete_founder" ON bookings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND role = 'FOUNDER' AND is_active = true
    )
  );

-- ── 3. clients: all team can SELECT; only FOUNDER can write ───────────────────
DROP POLICY IF EXISTS "team_clients_access" ON clients;

CREATE POLICY "clients_select_team" ON clients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "clients_write_founder" ON clients
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND role = 'FOUNDER' AND is_active = true
    )
  );

CREATE POLICY "clients_update_founder" ON clients
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND role = 'FOUNDER' AND is_active = true
    )
  );

CREATE POLICY "clients_delete_founder" ON clients
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND role = 'FOUNDER' AND is_active = true
    )
  );

-- ── 4. invoices — FOUNDER only ────────────────────────────────────────────────
DROP POLICY IF EXISTS "team_invoices_access" ON invoices;
CREATE POLICY "invoices_founder_only" ON invoices
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND role = 'FOUNDER' AND is_active = true
    )
  );

-- ── 5. payments — FOUNDER only ────────────────────────────────────────────────
DROP POLICY IF EXISTS "team_payments_access" ON payments;
CREATE POLICY "payments_founder_only" ON payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND role = 'FOUNDER' AND is_active = true
    )
  );

-- ── 6. invoice_line_items — FOUNDER only ──────────────────────────────────────
DROP POLICY IF EXISTS "team_line_items_access" ON invoice_line_items;
CREATE POLICY "line_items_founder_only" ON invoice_line_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND role = 'FOUNDER' AND is_active = true
    )
  );

-- ── 7. deliverables — FOUNDER only ───────────────────────────────────────────
DROP POLICY IF EXISTS "team_deliverables_access" ON deliverables;
CREATE POLICY "deliverables_founder_only" ON deliverables
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND role = 'FOUNDER' AND is_active = true
    )
  );

-- ── 8. Link Thujey's user_id when he first logs in (trigger already exists) ───
-- The on_auth_user_created trigger from the previous migration handles this
-- automatically when Thujey accepts his invite and signs in.
