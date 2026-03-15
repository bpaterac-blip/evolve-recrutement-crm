-- Colonne template pour les notes (type/objet : Récapitulatif R0, Note libre, etc.)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS template text;
-- Colonne author pour l'auteur de la note
ALTER TABLE notes ADD COLUMN IF NOT EXISTS author text;
