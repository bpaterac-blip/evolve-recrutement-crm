-- Ajout du champ mail2 (email personnel / secondaire) sur les profils
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mail2 text;
