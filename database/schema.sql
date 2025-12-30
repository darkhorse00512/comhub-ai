-- ComHub AI - Complete Database Schema
-- Run this SQL in your Supabase SQL Editor

-- =====================================================
-- 1. USERS TABLE (Enhanced)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  company TEXT,
  timezone TEXT DEFAULT 'Europe/Berlin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. USER SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
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
-- 3. GROUPS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sip_password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. PHONE NUMBERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- =====================================================
-- 5. CALL SESSIONS TABLE (Enhanced)
-- =====================================================
CREATE TABLE IF NOT EXISTS call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  phone_number_id UUID REFERENCES phone_numbers(id) ON DELETE SET NULL,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('ringing', 'active', 'ended', 'failed')) DEFAULT 'ringing',
  direction TEXT CHECK (direction IN ('inbound', 'outbound')) NOT NULL,
  caller_number TEXT,
  callee_number TEXT,
  channel_id TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration INTEGER, -- in seconds
  -- Call metadata
  call_quality TEXT,
  disconnect_reason TEXT,
  recording_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. CALL MESSAGES TABLE (unchanged)
-- =====================================================
CREATE TABLE IF NOT EXISTS call_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id UUID REFERENCES call_sessions(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'ai')) NOT NULL,
  content TEXT NOT NULL,
  audio_url TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. CALL RECORDINGS TABLE (unchanged)
-- =====================================================
CREATE TABLE IF NOT EXISTS call_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id UUID REFERENCES call_sessions(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  duration INTEGER,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. BULK CALL JOBS TABLE (unchanged)
-- =====================================================
CREATE TABLE IF NOT EXISTS bulk_call_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
-- 9. BULK CALL NUMBERS TABLE (unchanged)
-- =====================================================
CREATE TABLE IF NOT EXISTS bulk_call_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES bulk_call_jobs(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'calling', 'completed', 'failed')) DEFAULT 'pending',
  call_session_id UUID REFERENCES call_sessions(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 10. FEEDBACK TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
-- 11. USAGE STATISTICS TABLE (for analytics)
-- =====================================================
CREATE TABLE IF NOT EXISTS usage_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
-- INDEXES for Performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_user_id ON phone_numbers(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_phone_number ON phone_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_groups_user_id ON groups(user_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_user_id ON call_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_channel_id ON call_sessions(channel_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions(status);
CREATE INDEX IF NOT EXISTS idx_call_sessions_started_at ON call_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_messages_call_session_id ON call_messages(call_session_id);
CREATE INDEX IF NOT EXISTS idx_bulk_call_jobs_user_id ON bulk_call_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_bulk_call_numbers_job_id ON bulk_call_numbers(job_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_statistics_user_date ON usage_statistics(user_id, date);

-- =====================================================
-- TRIGGERS for updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phone_numbers_updated_at BEFORE UPDATE ON phone_numbers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_call_sessions_updated_at BEFORE UPDATE ON call_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bulk_call_jobs_updated_at BEFORE UPDATE ON bulk_call_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_call_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_call_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_statistics ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- User settings policies
CREATE POLICY "Users can view their own settings" ON user_settings
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own settings" ON user_settings
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Groups policies
CREATE POLICY "Users can view their own groups" ON groups
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own groups" ON groups
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own groups" ON groups
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own groups" ON groups
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Phone numbers policies
CREATE POLICY "Users can view their own phone numbers" ON phone_numbers
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own phone numbers" ON phone_numbers
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own phone numbers" ON phone_numbers
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own phone numbers" ON phone_numbers
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Call sessions policies
CREATE POLICY "Users can view their own call sessions" ON call_sessions
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own call sessions" ON call_sessions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own call sessions" ON call_sessions
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Call messages policies
CREATE POLICY "Users can view messages from their calls" ON call_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM call_sessions
      WHERE call_sessions.id = call_messages.call_session_id
      AND auth.uid()::text = call_sessions.user_id::text
    )
  );

CREATE POLICY "Users can insert messages to their calls" ON call_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM call_sessions
      WHERE call_sessions.id = call_messages.call_session_id
      AND auth.uid()::text = call_sessions.user_id::text
    )
  );

-- Call recordings policies
CREATE POLICY "Users can view their call recordings" ON call_recordings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM call_sessions
      WHERE call_sessions.id = call_recordings.call_session_id
      AND auth.uid()::text = call_sessions.user_id::text
    )
  );

-- Bulk call jobs policies
CREATE POLICY "Users can view their own bulk jobs" ON bulk_call_jobs
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own bulk jobs" ON bulk_call_jobs
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own bulk jobs" ON bulk_call_jobs
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own bulk jobs" ON bulk_call_jobs
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Bulk call numbers policies
CREATE POLICY "Users can view numbers from their bulk jobs" ON bulk_call_numbers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bulk_call_jobs
      WHERE bulk_call_jobs.id = bulk_call_numbers.job_id
      AND auth.uid()::text = bulk_call_jobs.user_id::text
    )
  );

CREATE POLICY "Users can insert numbers to their bulk jobs" ON bulk_call_numbers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bulk_call_jobs
      WHERE bulk_call_jobs.id = bulk_call_numbers.job_id
      AND auth.uid()::text = bulk_call_jobs.user_id::text
    )
  );

-- Feedback policies
CREATE POLICY "Users can view their own feedback" ON feedback
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Usage statistics policies
CREATE POLICY "Users can view their own usage statistics" ON usage_statistics
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- =====================================================
-- FUNCTIONS for Analytics
-- =====================================================

-- Function to update usage statistics
CREATE OR REPLACE FUNCTION update_usage_statistics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ended' AND OLD.status != 'ended' THEN
    INSERT INTO usage_statistics (
      user_id,
      date,
      total_calls,
      inbound_calls,
      outbound_calls,
      total_minutes,
      successful_calls
    )
    VALUES (
      NEW.user_id,
      CURRENT_DATE,
      1,
      CASE WHEN NEW.direction = 'inbound' THEN 1 ELSE 0 END,
      CASE WHEN NEW.direction = 'outbound' THEN 1 ELSE 0 END,
      COALESCE(NEW.duration, 0) / 60,
      CASE WHEN NEW.disconnect_reason IS NULL OR NEW.disconnect_reason = 'completed' THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id, date) DO UPDATE SET
      total_calls = usage_statistics.total_calls + 1,
      inbound_calls = usage_statistics.inbound_calls + CASE WHEN NEW.direction = 'inbound' THEN 1 ELSE 0 END,
      outbound_calls = usage_statistics.outbound_calls + CASE WHEN NEW.direction = 'outbound' THEN 1 ELSE 0 END,
      total_minutes = usage_statistics.total_minutes + COALESCE(NEW.duration, 0) / 60,
      successful_calls = usage_statistics.successful_calls + CASE WHEN NEW.disconnect_reason IS NULL OR NEW.disconnect_reason = 'completed' THEN 1 ELSE 0 END,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
