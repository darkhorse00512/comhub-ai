-- Voice models managed by admin
CREATE TABLE IF NOT EXISTS voice_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  elevenlabs_voice_id TEXT NOT NULL,
  elevenlabs_api_key TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'eleven_multilingual_v2',
  image_url TEXT,
  preview_url TEXT,
  category TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS (admin-only access via service role)
ALTER TABLE voice_models ENABLE ROW LEVEL SECURITY;
