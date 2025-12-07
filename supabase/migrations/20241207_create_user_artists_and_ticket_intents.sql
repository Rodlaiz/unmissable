-- Migration: Create user_artists and ticket_intents tables
-- Run this in your Supabase SQL Editor

-- Table: user_artists
-- Stores which artists each user is following (for notifications)
CREATE TABLE IF NOT EXISTS user_artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, artist_id)
);

-- Table: ticket_intents
-- Tracks when users click to buy tickets (for analytics)
CREATE TABLE IF NOT EXISTS ticket_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  ticket_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_artists_user_id ON user_artists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_artists_artist_id ON user_artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_ticket_intents_user_id ON ticket_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_intents_event_id ON ticket_intents(event_id);

-- Enable RLS (Row Level Security)
ALTER TABLE user_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_intents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_artists
-- Users can view their own followed artists
CREATE POLICY "Users can view own user_artists" ON user_artists
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own followed artists
CREATE POLICY "Users can insert own user_artists" ON user_artists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own followed artists
CREATE POLICY "Users can delete own user_artists" ON user_artists
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can do anything (for edge functions)
CREATE POLICY "Service role full access to user_artists" ON user_artists
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for ticket_intents
-- Users can view their own ticket intents
CREATE POLICY "Users can view own ticket_intents" ON ticket_intents
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own ticket intents
CREATE POLICY "Users can insert own ticket_intents" ON ticket_intents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can do anything (for analytics)
CREATE POLICY "Service role full access to ticket_intents" ON ticket_intents
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE user_artists IS 'Maps users to artists they follow for push notifications';
COMMENT ON TABLE ticket_intents IS 'Tracks when users click to buy tickets for analytics';
