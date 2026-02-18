-- Add collected_data JSONB column to call_sessions for storing field data collected during test calls
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS collected_data JSONB DEFAULT NULL;
