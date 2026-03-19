-- Table notifications pour les alertes en temps réel (ex: ticket résolu)
CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  message text,
  ticket_id uuid REFERENCES tickets(id),
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin insère via service_role (bypass RLS) — pas de policy INSERT nécessaire

-- Activer la réplication temps réel pour les notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Tickets : user_id si absent (déjà présent dans 006, mais au cas où)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Mettre à jour les tickets existants sans user_id (user_email → user_id)
UPDATE tickets
SET user_id = (SELECT id FROM auth.users WHERE email = tickets.user_email LIMIT 1)
WHERE user_id IS NULL AND user_email IS NOT NULL;
