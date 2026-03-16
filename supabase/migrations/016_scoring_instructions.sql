-- Instructions permanentes pour le scoring (règles métier)
CREATE TABLE IF NOT EXISTS scoring_instructions (
  id uuid default gen_random_uuid() primary key,
  content text,
  updated_at timestamptz default now(),
  updated_by text default 'Baptiste'
);

-- RLS
ALTER TABLE scoring_instructions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on scoring_instructions" ON scoring_instructions FOR ALL USING (true) WITH CHECK (true);

-- Insert initial empty row if table is empty
INSERT INTO scoring_instructions (content) SELECT '' WHERE NOT EXISTS (SELECT 1 FROM scoring_instructions LIMIT 1);
