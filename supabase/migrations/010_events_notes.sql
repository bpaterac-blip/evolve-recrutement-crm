-- Colonne notes pour les événements (notes libres par événement)
ALTER TABLE events ADD COLUMN IF NOT EXISTS notes text;

