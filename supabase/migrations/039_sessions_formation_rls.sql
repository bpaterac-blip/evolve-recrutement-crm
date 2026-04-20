-- Activer RLS sur sessions_formation
ALTER TABLE sessions_formation ENABLE ROW LEVEL SECURITY;

-- Lecture : utilisateurs authentifiés uniquement
CREATE POLICY "auth_select_sessions_formation" ON sessions_formation
FOR SELECT USING (auth.role() = 'authenticated');

-- Insert : utilisateurs authentifiés uniquement
CREATE POLICY "auth_insert_sessions_formation" ON sessions_formation
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Update : admins uniquement
CREATE POLICY "admin_update_sessions_formation" ON sessions_formation
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Delete : admins uniquement
CREATE POLICY "admin_delete_sessions_formation" ON sessions_formation
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
