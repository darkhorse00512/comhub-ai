-- Migration: Add agent_id to call_sessions
-- Links test call sessions to the agent they were testing

ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_call_sessions_agent_id ON call_sessions(agent_id);
