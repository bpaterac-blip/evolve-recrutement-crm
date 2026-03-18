-- Migration: add pas_interesse_raison column for Pas intéressé tracking
-- Note: Pas intéressé uses the same chute_type, chute_detail, chute_date columns as Chute.
-- This column is optional for future extensibility.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS pas_interesse_raison text;
