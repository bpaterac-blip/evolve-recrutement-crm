-- Permettre plusieurs lignes avec le même contenu si besoin (pas d'unicité sur content)
ALTER TABLE scoring_instructions DROP CONSTRAINT IF EXISTS scoring_instructions_content_key;
