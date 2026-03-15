-- Colonne updated_at pour les notes (affichage "Modifiée le ...")
ALTER TABLE notes ADD COLUMN IF NOT EXISTS updated_at timestamptz default now();
