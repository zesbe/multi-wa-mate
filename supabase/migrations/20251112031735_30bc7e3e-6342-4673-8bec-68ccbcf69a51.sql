-- Add RLS policies for tables that have RLS enabled but no policies

-- ===== AUTO_REPLIES POLICIES =====
CREATE POLICY "Users can view own auto-replies"
ON auto_replies FOR SELECT
USING (session_id IN (
  SELECT id FROM sessions WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create own auto-replies"
ON auto_replies FOR INSERT
WITH CHECK (session_id IN (
  SELECT id FROM sessions WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update own auto-replies"
ON auto_replies FOR UPDATE
USING (session_id IN (
  SELECT id FROM sessions WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete own auto-replies"
ON auto_replies FOR DELETE
USING (session_id IN (
  SELECT id FROM sessions WHERE user_id = auth.uid()
));

-- ===== MESSAGES POLICIES =====
CREATE POLICY "Users can view own messages"
ON messages FOR SELECT
USING (session_id IN (
  SELECT id FROM sessions WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert own messages"
ON messages FOR INSERT
WITH CHECK (session_id IN (
  SELECT id FROM sessions WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update own messages"
ON messages FOR UPDATE
USING (session_id IN (
  SELECT id FROM sessions WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete own messages"
ON messages FOR DELETE
USING (session_id IN (
  SELECT id FROM sessions WHERE user_id = auth.uid()
));

-- ===== SESSIONS POLICIES =====
CREATE POLICY "Users can view own sessions"
ON sessions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create own sessions"
ON sessions FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions"
ON sessions FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions"
ON sessions FOR DELETE
USING (user_id = auth.uid());

-- ===== USERS POLICIES =====
-- Note: Check if this table is deprecated. If profiles table is used instead, consider dropping this.
CREATE POLICY "Users can view own data"
ON users FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Users can update own data"
ON users FOR UPDATE
USING (id = auth.uid());

CREATE POLICY "Admins can view all users"
ON users FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all users"
ON users FOR ALL
USING (has_role(auth.uid(), 'admin'));