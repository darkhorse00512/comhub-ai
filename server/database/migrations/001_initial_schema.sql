-- AI Telephony Platform - Supabase Database Schema
-- Execute this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Call sessions table
CREATE TABLE IF NOT EXISTS call_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('ringing', 'active', 'ended', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  channel_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  caller_number TEXT,
  callee_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Call messages table (chat history)
CREATE TABLE IF NOT EXISTS call_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'ai')),
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  audio_url TEXT
);

-- Call recordings table
CREATE TABLE IF NOT EXISTS call_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration INTEGER,
  file_size BIGINT
);

-- Create indexes for better query performance
CREATE INDEX idx_call_sessions_user_id ON call_sessions(user_id);
CREATE INDEX idx_call_sessions_status ON call_sessions(status);
CREATE INDEX idx_call_sessions_started_at ON call_sessions(started_at DESC);
CREATE INDEX idx_call_messages_call_session_id ON call_messages(call_session_id);
CREATE INDEX idx_call_messages_timestamp ON call_messages(timestamp DESC);
CREATE INDEX idx_call_recordings_call_session_id ON call_recordings(call_session_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Allow service role to manage users (for backend operations)
CREATE POLICY "Service role can manage users"
  ON users FOR ALL
  USING (true)
  WITH CHECK (true);

-- Allow users to be created (for registration)
CREATE POLICY "Allow user registration"
  ON users FOR INSERT
  WITH CHECK (true);

-- RLS Policies for call_sessions table
CREATE POLICY "Users can view their own call sessions"
  ON call_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own call sessions"
  ON call_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own call sessions"
  ON call_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow service role to manage call sessions (for backend operations)
CREATE POLICY "Service role can manage call sessions"
  ON call_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for call_messages table
CREATE POLICY "Users can view messages from their calls"
  ON call_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM call_sessions
      WHERE call_sessions.id = call_messages.call_session_id
      AND call_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to their calls"
  ON call_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM call_sessions
      WHERE call_sessions.id = call_messages.call_session_id
      AND call_sessions.user_id = auth.uid()
    )
  );

-- Allow service role to manage call messages (for backend operations)
CREATE POLICY "Service role can manage call messages"
  ON call_messages FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for call_recordings table
CREATE POLICY "Users can view recordings from their calls"
  ON call_recordings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM call_sessions
      WHERE call_sessions.id = call_recordings.call_session_id
      AND call_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert recordings to their calls"
  ON call_recordings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM call_sessions
      WHERE call_sessions.id = call_recordings.call_session_id
      AND call_sessions.user_id = auth.uid()
    )
  );

-- Allow service role to manage call recordings (for backend operations)
CREATE POLICY "Service role can manage call recordings"
  ON call_recordings FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create a storage bucket for call recordings (execute separately in Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('call-recordings', 'call-recordings', false);

-- Storage RLS policies (execute after creating bucket)
-- CREATE POLICY "Users can upload their own recordings"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'call-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can view their own recordings"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'call-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
