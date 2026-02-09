-- ComHub AI - Enhanced Database Schema
-- This schema builds upon the existing 001_initial_schema.sql migration
-- Run this SQL in your Supabase SQL Editor AFTER running 001_initial_schema.sql
--
-- IMPORTANT: This assumes you already have:
-- - users (id, email, created_at)
-- - call_sessions (id, user_id, status, started_at, ended_at, channel_id, direction, caller_number, callee_number, created_at)
-- - call_messages (id, call_session_id, role, content, timestamp, audio_url)
-- - call_recordings (id, call_session_id, file_url, created_at, duration, file_size)
-- - RLS policies for all above tables
-- - Indexes for basic performance

-- =====================================================
-- 1. ENHANCE EXISTING USERS TABLE
-- =====================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Berlin';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- =====================================================
-- 2. ENHANCE EXISTING CALL_SESSIONS TABLE
-- =====================================================
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS phone_number_id UUID;
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS group_id UUID;
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS duration INTEGER; -- in seconds
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS call_quality TEXT;
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS disconnect_reason TEXT;
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- =====================================================
-- 3. NEW TABLE: USER SETTINGS
-- =====================================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  -- Profile Settings
  display_name TEXT,
  company TEXT,
  timezone TEXT DEFAULT 'Europe/Berlin',
  -- Notification Settings
  email_notifications BOOLEAN DEFAULT true,
  call_alerts BOOLEAN DEFAULT true,
  weekly_report BOOLEAN DEFAULT false,
  marketing_emails BOOLEAN DEFAULT false,
  -- AI Settings
  ai_voice_model TEXT DEFAULT 'alloy',
  ai_language TEXT DEFAULT 'en-US',
  ai_greeting TEXT DEFAULT 'Hey there! Here is ComHub AI. What can I help you with today?',
  ai_max_call_duration INTEGER DEFAULT 30,
  ai_silence_timeout INTEGER DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- =====================================================
-- 4. NEW TABLE: GROUPS
-- =====================================================
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sip_password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. NEW TABLE: PHONE NUMBERS
-- =====================================================
CREATE TABLE IF NOT EXISTS phone_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  phone_number TEXT UNIQUE NOT NULL,
  friendly_name TEXT,
  country_code TEXT,
  country TEXT,
  type TEXT CHECK (type IN ('purchased', 'imported')) DEFAULT 'imported',
  status TEXT CHECK (status IN ('active', 'pending', 'inactive')) DEFAULT 'active',
  -- Twilio specific data
  twilio_account_sid TEXT,
  twilio_phone_number_sid TEXT,
  twilio_capabilities JSONB DEFAULT '{}',
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraints to call_sessions (now that phone_numbers and groups exist)
ALTER TABLE call_sessions
  DROP CONSTRAINT IF EXISTS call_sessions_phone_number_id_fkey;
ALTER TABLE call_sessions
  ADD CONSTRAINT call_sessions_phone_number_id_fkey
  FOREIGN KEY (phone_number_id) REFERENCES phone_numbers(id) ON DELETE SET NULL;

ALTER TABLE call_sessions
  DROP CONSTRAINT IF EXISTS call_sessions_group_id_fkey;
ALTER TABLE call_sessions
  ADD CONSTRAINT call_sessions_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;

-- =====================================================
-- 6. NEW TABLE: BULK CALL JOBS
-- =====================================================
CREATE TABLE IF NOT EXISTS bulk_call_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
  total_numbers INTEGER DEFAULT 0,
  completed_calls INTEGER DEFAULT 0,
  failed_calls INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. NEW TABLE: BULK CALL NUMBERS
-- =====================================================
CREATE TABLE IF NOT EXISTS bulk_call_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES bulk_call_jobs(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'calling', 'completed', 'failed')) DEFAULT 'pending',
  call_session_id UUID REFERENCES call_sessions(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. NEW TABLE: FEEDBACK
-- =====================================================
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('feature', 'bug', 'improvement', 'question')) NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  email TEXT,
  status TEXT CHECK (status IN ('new', 'reviewed', 'in-progress', 'resolved')) DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 9. NEW TABLE: USAGE STATISTICS (for analytics)
-- =====================================================
CREATE TABLE IF NOT EXISTS usage_statistics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_calls INTEGER DEFAULT 0,
  inbound_calls INTEGER DEFAULT 0,
  outbound_calls INTEGER DEFAULT 0,
  total_minutes INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  successful_calls INTEGER DEFAULT 0,
  failed_calls INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- =====================================================
-- ADDITIONAL INDEXES for Performance
-- Note: Basic indexes already exist from 001_initial_schema.sql
-- =====================================================
-- Users table (email index already exists)
CREATE INDEX IF NOT EXISTS idx_phone_numbers_user_id ON phone_numbers(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_phone_number ON phone_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_group_id ON phone_numbers(group_id);
CREATE INDEX IF NOT EXISTS idx_groups_user_id ON groups(user_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_phone_number_id ON call_sessions(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_group_id ON call_sessions(group_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_channel_id ON call_sessions(channel_id);
CREATE INDEX IF NOT EXISTS idx_bulk_call_jobs_user_id ON bulk_call_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_bulk_call_numbers_job_id ON bulk_call_numbers(job_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_statistics_user_date ON usage_statistics(user_id, date);

-- =====================================================
-- TRIGGERS for updated_at columns
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to user_settings table
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to groups table
DROP TRIGGER IF EXISTS update_groups_updated_at ON groups;
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to phone_numbers table
DROP TRIGGER IF EXISTS update_phone_numbers_updated_at ON phone_numbers;
CREATE TRIGGER update_phone_numbers_updated_at BEFORE UPDATE ON phone_numbers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to call_sessions table
DROP TRIGGER IF EXISTS update_call_sessions_updated_at ON call_sessions;
CREATE TRIGGER update_call_sessions_updated_at BEFORE UPDATE ON call_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to bulk_call_jobs table
DROP TRIGGER IF EXISTS update_bulk_call_jobs_updated_at ON bulk_call_jobs;
CREATE TRIGGER update_bulk_call_jobs_updated_at BEFORE UPDATE ON bulk_call_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to feedback table
DROP TRIGGER IF EXISTS update_feedback_updated_at ON feedback;
CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) Policies for NEW TABLES ONLY
-- Note: RLS policies for users, call_sessions, call_messages, call_recordings already exist
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_call_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_call_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_statistics ENABLE ROW LEVEL SECURITY;

-- User settings policies
CREATE POLICY "Users can view their own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage user settings" ON user_settings
  FOR ALL USING (true) WITH CHECK (true);

-- Groups policies
CREATE POLICY "Users can view their own groups" ON groups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own groups" ON groups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own groups" ON groups
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own groups" ON groups
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage groups" ON groups
  FOR ALL USING (true) WITH CHECK (true);

-- Phone numbers policies
CREATE POLICY "Users can view their own phone numbers" ON phone_numbers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own phone numbers" ON phone_numbers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own phone numbers" ON phone_numbers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own phone numbers" ON phone_numbers
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage phone numbers" ON phone_numbers
  FOR ALL USING (true) WITH CHECK (true);

-- Bulk call jobs policies
CREATE POLICY "Users can view their own bulk jobs" ON bulk_call_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bulk jobs" ON bulk_call_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bulk jobs" ON bulk_call_jobs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bulk jobs" ON bulk_call_jobs
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage bulk jobs" ON bulk_call_jobs
  FOR ALL USING (true) WITH CHECK (true);

-- Bulk call numbers policies
CREATE POLICY "Users can view numbers from their bulk jobs" ON bulk_call_numbers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bulk_call_jobs
      WHERE bulk_call_jobs.id = bulk_call_numbers.job_id
      AND bulk_call_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert numbers to their bulk jobs" ON bulk_call_numbers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bulk_call_jobs
      WHERE bulk_call_jobs.id = bulk_call_numbers.job_id
      AND bulk_call_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage bulk call numbers" ON bulk_call_numbers
  FOR ALL USING (true) WITH CHECK (true);

-- Feedback policies
CREATE POLICY "Users can view their own feedback" ON feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage feedback" ON feedback
  FOR ALL USING (true) WITH CHECK (true);

-- Usage statistics policies
CREATE POLICY "Users can view their own usage statistics" ON usage_statistics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage usage statistics" ON usage_statistics
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- FUNCTIONS for Analytics
-- =====================================================

-- Function to update usage statistics when call ends
CREATE OR REPLACE FUNCTION update_usage_statistics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ended' AND (OLD.status IS NULL OR OLD.status != 'ended') THEN
    INSERT INTO usage_statistics (
      user_id,
      date,
      total_calls,
      inbound_calls,
      outbound_calls,
      total_minutes,
      successful_calls,
      failed_calls
    )
    VALUES (
      NEW.user_id,
      CURRENT_DATE,
      1,
      CASE WHEN NEW.direction = 'inbound' THEN 1 ELSE 0 END,
      CASE WHEN NEW.direction = 'outbound' THEN 1 ELSE 0 END,
      COALESCE(NEW.duration, 0) / 60,
      CASE WHEN NEW.disconnect_reason IS NULL OR NEW.disconnect_reason = 'completed' THEN 1 ELSE 0 END,
      CASE WHEN NEW.disconnect_reason IS NOT NULL AND NEW.disconnect_reason != 'completed' THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id, date) DO UPDATE SET
      total_calls = usage_statistics.total_calls + 1,
      inbound_calls = usage_statistics.inbound_calls + CASE WHEN NEW.direction = 'inbound' THEN 1 ELSE 0 END,
      outbound_calls = usage_statistics.outbound_calls + CASE WHEN NEW.direction = 'outbound' THEN 1 ELSE 0 END,
      total_minutes = usage_statistics.total_minutes + COALESCE(NEW.duration, 0) / 60,
      successful_calls = usage_statistics.successful_calls + CASE WHEN NEW.disconnect_reason IS NULL OR NEW.disconnect_reason = 'completed' THEN 1 ELSE 0 END,
      failed_calls = usage_statistics.failed_calls + CASE WHEN NEW.disconnect_reason IS NOT NULL AND NEW.disconnect_reason != 'completed' THEN 1 ELSE 0 END,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for usage statistics
DROP TRIGGER IF EXISTS update_usage_stats_on_call_end ON call_sessions;
CREATE TRIGGER update_usage_stats_on_call_end
  AFTER UPDATE ON call_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_usage_statistics();

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Create system user for inbound calls (if not exists)
INSERT INTO users (id, email, name)
VALUES ('00000000-0000-0000-0000-000000000000', 'system@comhubai.com', 'System')
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- VIEWS for Easy Querying
-- =====================================================

-- View for call history with phone number details
CREATE OR REPLACE VIEW call_history_view AS
SELECT
  cs.*,
  pn.phone_number as associated_phone_number,
  pn.friendly_name as phone_number_name,
  g.name as group_name,
  (SELECT COUNT(*) FROM call_messages WHERE call_session_id = cs.id) as message_count
FROM call_sessions cs
LEFT JOIN phone_numbers pn ON cs.phone_number_id = pn.id
LEFT JOIN groups g ON cs.group_id = g.id
ORDER BY cs.started_at DESC;

-- View for usage overview
CREATE OR REPLACE VIEW usage_overview AS
SELECT
  user_id,
  SUM(total_calls) as total_calls,
  SUM(inbound_calls) as inbound_calls,
  SUM(outbound_calls) as outbound_calls,
  SUM(total_minutes) as total_minutes,
  SUM(successful_calls) as successful_calls,
  SUM(failed_calls) as failed_calls,
  CASE WHEN SUM(total_calls) > 0
    THEN ROUND((SUM(successful_calls)::numeric / SUM(total_calls)::numeric) * 100, 2)
    ELSE 0
  END as success_rate
FROM usage_statistics
GROUP BY user_id;

-- =====================================================
-- COMPLETED!
-- =====================================================
-- Your ComHub AI database is now ready to use!
--
-- Next steps:
-- 1. Verify all tables exist: SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- 2. Check RLS is enabled: SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- 3. Test by creating a group and importing a phone number
-- =====================================================
