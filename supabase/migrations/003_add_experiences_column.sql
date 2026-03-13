-- Colonne experiences (jsonb) pour stocker les expériences passées extraites du PDF LinkedIn
-- Colonne duration pour l'ancienneté du poste actuel
alter table profiles add column if not exists experiences jsonb default '[]'::jsonb;
alter table profiles add column if not exists duration text default '';
