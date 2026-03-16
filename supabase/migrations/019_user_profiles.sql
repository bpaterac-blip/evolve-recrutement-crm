-- Table user_profiles : prénom, nom des utilisateurs
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid REFERENCES auth.users(id) PRIMARY KEY,
  email text,
  first_name text,
  last_name text,
  full_name text GENERATED ALWAYS AS (
    TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
  ) STORED,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_all_profiles" ON user_profiles
FOR SELECT USING (true);

CREATE POLICY "user_updates_own_profile" ON user_profiles
FOR ALL USING (id = auth.uid());

-- Colonne owner_full_name dans profiles (pour affichage Responsable)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS owner_full_name text;
