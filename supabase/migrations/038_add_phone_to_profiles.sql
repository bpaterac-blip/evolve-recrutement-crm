-- Migration 038: ajouter le champ téléphone aux profils
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
