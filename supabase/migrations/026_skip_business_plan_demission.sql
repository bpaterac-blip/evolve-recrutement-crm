-- Colonnes pour exclure certaines étapes du funnel (étape non applicable au profil)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skip_business_plan boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skip_demission boolean DEFAULT false;
