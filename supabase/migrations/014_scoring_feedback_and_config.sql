-- Colonnes supplémentaires pour scoring_feedback
ALTER TABLE scoring_feedback ADD COLUMN IF NOT EXISTS priority_label text;
ALTER TABLE scoring_feedback ADD COLUMN IF NOT EXISTS author text;
ALTER TABLE scoring_feedback ADD COLUMN IF NOT EXISTS reason text;

-- Table scoring_config pour les poids configurables
CREATE TABLE IF NOT EXISTS scoring_config (
  id uuid default gen_random_uuid() primary key,
  weight_employer integer default 50,
  weight_title integer default 30,
  weight_seniority integer default 20,
  bonus_cgp_experience integer default 20,
  threshold_priority integer default 70,
  threshold_towork integer default 50,
  updated_at timestamptz default now(),
  updated_by text default 'Baptiste'
);

-- Insert config par défaut si vide
INSERT INTO scoring_config (
  weight_employer, weight_title, weight_seniority,
  bonus_cgp_experience, threshold_priority, threshold_towork
)
SELECT 50, 30, 20, 20, 70, 50
WHERE NOT EXISTS (SELECT 1 FROM scoring_config LIMIT 1);

ALTER TABLE scoring_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on scoring_config" ON scoring_config FOR ALL USING (true) WITH CHECK (true);
