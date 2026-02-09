-- Add profile fields to user_settings table
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Berlin';
