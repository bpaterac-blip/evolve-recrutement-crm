-- Ajouter owner_id et owner_email dans profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS owner_email text;

-- Supprimer l'ancienne policy permissive
DROP POLICY IF EXISTS "Allow all operations on profiles" ON profiles;

-- Activer Row Level Security (au cas où)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Politique : chaque user ne voit que ses propres profils ; admin voit tout (y compris owner_id NULL)
CREATE POLICY "user_sees_own_profiles" ON profiles
FOR SELECT USING (
  owner_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Politique : chaque user ne peut modifier que ses propres profils (admin peut modifier tout)
CREATE POLICY "user_updates_own_profiles" ON profiles
FOR UPDATE USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Politique : insert avec owner_id automatique
CREATE POLICY "user_inserts_own_profiles" ON profiles
FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Politique : suppression uniquement de ses propres profils (ou admin)
CREATE POLICY "user_deletes_own_profiles" ON profiles
FOR DELETE USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
