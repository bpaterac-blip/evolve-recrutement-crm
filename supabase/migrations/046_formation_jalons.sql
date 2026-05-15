-- ── Migration 046 : Table formation_jalons ────────────────────────────────────
-- Tracks the 4 pre-formation email milestones per CGP per session.
-- Dates are computed in the app from sessions_formation.date_session:
--   M2  = date_session - 2 months
--   M1  = date_session - 1 month
--   J15 = date_session - 15 days
--   J7  = date_session - 7 days

CREATE TABLE IF NOT EXISTS formation_jalons (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id  UUID        NOT NULL REFERENCES sessions_formation(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('M2', 'M1', 'J15', 'J7')),
  sent_at     TIMESTAMPTZ,
  sent_by     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (profile_id, type)
);

ALTER TABLE formation_jalons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage formation_jalons"
  ON formation_jalons FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Index for fast lookups by session
CREATE INDEX IF NOT EXISTS idx_formation_jalons_session
  ON formation_jalons (session_id);

-- Index for fast lookups by profile
CREATE INDEX IF NOT EXISTS idx_formation_jalons_profile
  ON formation_jalons (profile_id);
