-- Ejecutá en Supabase → SQL Editor → Run
-- (solo una vez, antes de npm run create:admin)

CREATE TABLE IF NOT EXISTS admin_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_profiles_read_own" ON admin_profiles;
CREATE POLICY "admin_profiles_read_own"
  ON admin_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
