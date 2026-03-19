-- Colonnes cv_url et cv_url_path sur profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cv_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cv_url_path text;

-- Bucket cvs (privé)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cvs', 'cvs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS : les utilisateurs authentifiés peuvent upload et lire leurs propres fichiers
-- (fichiers dans un dossier profile_id où le profil leur appartient : owner_id = auth.uid())
DROP POLICY IF EXISTS "Users can upload CVs for their profiles" ON storage.objects;
CREATE POLICY "Users can upload CVs for their profiles"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cvs'
    AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.profiles WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can read CVs for their profiles" ON storage.objects;
CREATE POLICY "Users can read CVs for their profiles"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cvs'
    AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.profiles WHERE owner_id = auth.uid())
  );
