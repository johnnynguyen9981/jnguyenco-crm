-- ── Team Support: team_members table + contractors seed ──────────────────────
-- Run in Supabase SQL Editor.
-- Allows Thujey and Suri to log in and access all CRM data.
-- Johnny is pre-seeded; add Thujey + Suri via the Team settings UI or
-- manually update their emails below before running.

-- ── 1. team_members ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text UNIQUE NOT NULL,
  full_name    text NOT NULL,
  role         text NOT NULL CHECK (role IN ('FOUNDER', 'PHOTOGRAPHER', 'VIDEOGRAPHER', 'BOTH')),
  title        text,                      -- display title e.g. "Lead Photographer"
  bio          text,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Any authenticated team member can read the team list
CREATE POLICY "team_members_select" ON team_members
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only the founder (first team member) can insert/update/delete
CREATE POLICY "team_members_write" ON team_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid() AND tm.role = 'FOUNDER' AND tm.is_active = true
    )
  );

-- ── 2. Seed team members ──────────────────────────────────────────────────────
-- Johnny's email is known. Update Thujey and Suri's emails before running,
-- OR add them via the Settings → Team page after Johnny logs in.
INSERT INTO team_members (email, full_name, role, title, bio) VALUES
(
  'johnny.nguyen9981@gmail.com',
  'Johnny Nguyen',
  'FOUNDER',
  'Founder · Lead Photographer & Videographer',
  'Johnny founded JNguyen Co. with a passion for capturing life''s most meaningful moments. Based in Canberra, he leads every shoot with a cinematic eye and a calm presence that puts clients at ease from the first hello to the final edit.'
),
(
  'thujey@jnguyen.co',   -- ← update to Thujey''s actual email
  'Thujey Ngetup',
  'VIDEOGRAPHER',
  'Lead Videographer',
  'Thujey brings a storyteller''s instinct to every frame. His cinematic approach transforms wedding and event footage into films that clients return to for a lifetime.'
),
(
  'suri@jnguyen.co',     -- ← update to Suri''s actual email
  'Suri Le',
  'PHOTOGRAPHER',
  'Lead Photographer',
  'Suri''s eye for light and emotion means she never misses the moment that matters. Her warm, unobtrusive style helps couples and families relax and be themselves in front of the lens.'
)
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role      = EXCLUDED.role,
  title     = EXCLUDED.title,
  bio       = EXCLUDED.bio;

-- ── 3. Link Johnny's user_id when he logs in (auto-trigger) ──────────────────
-- This trigger sets user_id on the team_members row the first time
-- a matching email signs in via Supabase auth.
CREATE OR REPLACE FUNCTION public.link_team_member_on_login()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.team_members
  SET user_id = NEW.id
  WHERE email = NEW.email AND user_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_team_member_on_login();

-- Also run for existing users (Johnny is already in auth.users)
UPDATE public.team_members tm
SET user_id = au.id
FROM auth.users au
WHERE au.email = tm.email AND tm.user_id IS NULL;

-- ── 4. Update RLS on core tables to allow all active team members ─────────────
-- Replaces the single-owner pattern with team-wide access.

-- bookings
DROP POLICY IF EXISTS "owner_access" ON bookings;
DROP POLICY IF EXISTS "bookings_owner" ON bookings;
CREATE POLICY "team_bookings_access" ON bookings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- clients
DROP POLICY IF EXISTS "owner_access" ON clients;
DROP POLICY IF EXISTS "clients_owner" ON clients;
CREATE POLICY "team_clients_access" ON clients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- invoices
DROP POLICY IF EXISTS "owner_access" ON invoices;
DROP POLICY IF EXISTS "invoices_owner" ON invoices;
CREATE POLICY "team_invoices_access" ON invoices
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- payments
DROP POLICY IF EXISTS "owner_access" ON payments;
DROP POLICY IF EXISTS "payments_owner" ON payments;
CREATE POLICY "team_payments_access" ON payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- invoice_line_items
DROP POLICY IF EXISTS "owner_access" ON invoice_line_items;
DROP POLICY IF EXISTS "invoice_line_items_owner" ON invoice_line_items;
CREATE POLICY "team_line_items_access" ON invoice_line_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- deliverables
DROP POLICY IF EXISTS "owner_access" ON deliverables;
DROP POLICY IF EXISTS "deliverables_owner" ON deliverables;
CREATE POLICY "team_deliverables_access" ON deliverables
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- google_tokens (each person manages their own)
DROP POLICY IF EXISTS "owner_access" ON google_tokens;
DROP POLICY IF EXISTS "google_tokens_owner" ON google_tokens;
CREATE POLICY "team_google_tokens_access" ON google_tokens
  FOR ALL
  USING (owner_id = auth.uid());

-- ── 5. Seed contractors table ─────────────────────────────────────────────────
-- contractors is used for booking assignment dropdowns.
-- owner_id is set to a placeholder; update to Johnny's actual UUID if needed,
-- or leave as-is since RLS is now team-based.
INSERT INTO contractors (first_name, last_name, email, role, is_active)
SELECT 'Johnny', 'Nguyen', 'johnny.nguyen9981@gmail.com', 'BOTH', true
WHERE NOT EXISTS (SELECT 1 FROM contractors WHERE email = 'johnny.nguyen9981@gmail.com');

INSERT INTO contractors (first_name, last_name, email, role, is_active)
SELECT 'Thujey', 'Ngetup', 'thujey@jnguyen.co', 'VIDEOGRAPHER', true
WHERE NOT EXISTS (SELECT 1 FROM contractors WHERE email = 'thujey@jnguyen.co');

INSERT INTO contractors (first_name, last_name, email, role, is_active)
SELECT 'Suri', 'Le', 'suri@jnguyen.co', 'PHOTOGRAPHER', true
WHERE NOT EXISTS (SELECT 1 FROM contractors WHERE email = 'suri@jnguyen.co');
