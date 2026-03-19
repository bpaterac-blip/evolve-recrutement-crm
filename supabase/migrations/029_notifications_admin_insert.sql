-- Permettre aux utilisateurs authentifiés d'insérer des notifications pour les admins
-- (ex: nouveau ticket créé → notifier tous les admins)
CREATE POLICY "Users can notify admins"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );
