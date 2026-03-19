-- Réponse admin sur un ticket
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS admin_reponse text;
