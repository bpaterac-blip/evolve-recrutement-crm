-- Colonnes pour gérer la prochaine étape d'un événement
ALTER TABLE events ADD COLUMN IF NOT EXISTS next_step text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS next_step_date text;

