-- sessions_formation: add periode, annee, date_debut
ALTER TABLE sessions_formation ADD COLUMN IF NOT EXISTS periode text;
ALTER TABLE sessions_formation ADD COLUMN IF NOT EXISTS annee integer;
ALTER TABLE sessions_formation ADD COLUMN IF NOT EXISTS date_debut date;

-- profiles: add integration_periode, integration_annee, integration_confirmed
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS integration_periode text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS integration_annee integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS integration_confirmed boolean DEFAULT false;
