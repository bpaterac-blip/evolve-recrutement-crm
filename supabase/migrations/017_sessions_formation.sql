-- Table sessions_formation
CREATE TABLE IF NOT EXISTS sessions_formation (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date_session date NOT NULL,
  lieu text,
  places_total integer DEFAULT 10,
  statut text DEFAULT 'planifiée' 
    CHECK (statut IN ('planifiée', 'confirmée', 'passée')),
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- Colonne updated_at pour profiles (pour calcul "jours sans action")
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Colonne session_formation_id dans profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS session_formation_id uuid 
REFERENCES sessions_formation(id);
