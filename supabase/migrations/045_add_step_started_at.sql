-- Migration 045: ajoute step_started_at pour mesurer la durée dans l'étape courante
ALTER TABLE onboarding_profiles
  ADD COLUMN IF NOT EXISTS step_started_at date DEFAULT CURRENT_DATE;

-- Initialiser à start_date pour les profils existants (approximation)
UPDATE onboarding_profiles
SET step_started_at = start_date
WHERE step_started_at IS NULL;
