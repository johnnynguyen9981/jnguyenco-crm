-- Create google_tokens table for storing OAuth2 credentials
-- Safe to re-run (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS google_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token  text NOT NULL,
  refresh_token text NOT NULL,
  token_expiry  timestamptz NOT NULL,
  scopes        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id)
);

-- RLS: users can only see/modify their own tokens
ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_only" ON google_tokens;
CREATE POLICY "owner_only" ON google_tokens
  FOR ALL USING (owner_id = auth.uid());

-- Service role can bypass RLS (needed for server-side upsert)
-- This is already the default for service role in Supabase.
