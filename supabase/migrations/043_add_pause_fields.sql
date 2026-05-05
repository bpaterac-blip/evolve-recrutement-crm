-- Migration 043 : champs "En pause" sur les profils
-- pause_reason : raison de la mise en pause (vie personnelle, projet immobilier, etc.)
-- pause_until  : date de relance prévue
-- pause_stade  : stade du profil au moment de la mise en pause (pour reprendre au bon endroit)

alter table profiles
  add column if not exists pause_reason text,
  add column if not exists pause_until  date,
  add column if not exists pause_stade  text;
