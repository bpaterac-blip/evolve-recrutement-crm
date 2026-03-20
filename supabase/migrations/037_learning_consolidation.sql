-- Apprentissage automatisé : consolidation des feedbacks
ALTER TABLE scoring_feedback ADD COLUMN IF NOT EXISTS consolidated boolean DEFAULT false;
ALTER TABLE scoring_instructions ADD COLUMN IF NOT EXISTS auto_generated boolean DEFAULT false;
