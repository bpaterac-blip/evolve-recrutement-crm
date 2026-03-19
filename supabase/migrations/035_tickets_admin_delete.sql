-- Admins peuvent supprimer des tickets
CREATE POLICY "Admins delete tickets"
  ON tickets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins peuvent supprimer des notifications (pour nettoyer lors de la suppression d'un ticket)
CREATE POLICY "Admins delete notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
