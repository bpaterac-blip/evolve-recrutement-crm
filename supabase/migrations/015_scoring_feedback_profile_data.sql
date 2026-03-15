-- profile_data pour stocker les infos quand le profil n'est pas encore dans le CRM
ALTER TABLE scoring_feedback ADD COLUMN IF NOT EXISTS profile_data jsonb;

-- profile_id est déjà nullable (pas de NOT NULL dans la création initiale)
-- Ajout de original_score/corrected_score comme alias si besoin (on garde previous_score/new_score pour compatibilité)
