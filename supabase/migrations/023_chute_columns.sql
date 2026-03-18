-- Colonnes pour la maturité "Chute"
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chute_stade text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chute_type text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chute_detail text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chute_date timestamp with time zone;
