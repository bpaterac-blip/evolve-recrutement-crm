-- Add region column to profiles (régions de France)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS region text;
