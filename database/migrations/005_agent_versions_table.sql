-- Agent Version History Table
-- Stores a snapshot of agent config each time the user saves
CREATE TABLE IF NOT EXISTS agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  node_count INTEGER DEFAULT 0,
  edge_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(agent_id, version_number)
);

-- Indexes
CREATE INDEX idx_agent_versions_agent_id ON agent_versions(agent_id);
CREATE INDEX idx_agent_versions_user_id ON agent_versions(user_id);
CREATE INDEX idx_agent_versions_created_at ON agent_versions(created_at DESC);

-- RLS Policies
ALTER TABLE agent_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent versions"
  ON agent_versions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own agent versions"
  ON agent_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own agent versions"
  ON agent_versions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to agent_versions"
  ON agent_versions FOR ALL
  USING (auth.role() = 'service_role');
