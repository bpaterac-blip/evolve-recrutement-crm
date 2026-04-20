-- ============================================================
-- Correction des policies permissives (USING true sans restriction)
-- Ces policies exposaient les données aux utilisateurs non connectés
-- ============================================================

-- ── ACTIVITIES ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all on activities" ON activities;

CREATE POLICY "auth_all_activities" ON activities
FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ── NOTES ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all on notes" ON notes;

CREATE POLICY "auth_all_notes" ON notes
FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ── EVENTS ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all on events" ON events;

CREATE POLICY "auth_all_events" ON events
FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ── SCORING_FEEDBACK ────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all on scoring_feedback" ON scoring_feedback;

CREATE POLICY "auth_all_scoring_feedback" ON scoring_feedback
FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ── USER_ROLES ──────────────────────────────────────────────
-- Critique : lecture pour tous les authentifiés, écriture admin seulement
DROP POLICY IF EXISTS "Allow all" ON user_roles;

CREATE POLICY "auth_select_user_roles" ON user_roles
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admin_insert_user_roles" ON user_roles
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "admin_update_user_roles" ON user_roles
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "admin_delete_user_roles" ON user_roles
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ── SCORING_CONFIG ──────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all on scoring_config" ON scoring_config;

CREATE POLICY "auth_select_scoring_config" ON scoring_config
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admin_write_scoring_config" ON scoring_config
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ── SCORING_INSTRUCTIONS ────────────────────────────────────
DROP POLICY IF EXISTS "Allow all on scoring_instructions" ON scoring_instructions;

CREATE POLICY "auth_select_scoring_instructions" ON scoring_instructions
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admin_write_scoring_instructions" ON scoring_instructions
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
