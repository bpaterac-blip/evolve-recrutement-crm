-- Colonne lead_status pour le statut Lemlist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lead_status text;
