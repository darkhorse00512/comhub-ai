-- Platform-wide settings (key-value store for admin-managed configuration)
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS (admin-only access via service role)
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
