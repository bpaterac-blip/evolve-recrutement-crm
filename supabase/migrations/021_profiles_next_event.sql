-- Colonnes pour événements à venir sur les profils
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS next_event_date date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS next_event_label text;
