ALTER TABLE profiles ADD COLUMN IF NOT EXISTS grille_notation jsonb DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS grille_commentaires text;
