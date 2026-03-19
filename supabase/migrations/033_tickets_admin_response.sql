-- Colonne admin_response pour la réponse de l'équipe
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS admin_response text;
