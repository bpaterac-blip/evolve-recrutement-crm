-- Réponse du user à la réponse admin
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS user_response text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS user_response_date timestamptz;

-- Users peuvent mettre à jour leurs propres tickets (user_response, user_response_date, statut)
CREATE POLICY "Users update own tickets"
  ON tickets FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
