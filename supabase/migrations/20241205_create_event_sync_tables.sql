-- Migration: Create tables for event sync and notifications
-- Run this in your Supabase SQL Editor

-- Table: known_events
-- Stores events fetched from Ticketmaster
CREATE TABLE IF NOT EXISTS known_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticketmaster_id TEXT UNIQUE NOT NULL,
  artist_id TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  event_name TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  city TEXT NOT NULL,
  event_date TIMESTAMPTZ,
  ticket_url TEXT,
  image_url TEXT,
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: sent_notifications
-- Tracks which notifications have been sent to avoid duplicates
CREATE TABLE IF NOT EXISTS sent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES known_events(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_known_events_ticketmaster_id ON known_events(ticketmaster_id);
CREATE INDEX IF NOT EXISTS idx_known_events_artist_id ON known_events(artist_id);
CREATE INDEX IF NOT EXISTS idx_known_events_notified ON known_events(notified) WHERE notified = FALSE;
CREATE INDEX IF NOT EXISTS idx_sent_notifications_user_event ON sent_notifications(user_id, event_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_known_events_updated_at ON known_events;
CREATE TRIGGER update_known_events_updated_at
  BEFORE UPDATE ON known_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies (optional - enable if you want row-level security)
-- ALTER TABLE known_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sent_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access (for the edge function)
-- CREATE POLICY "Service role can manage known_events" ON known_events
--   FOR ALL USING (auth.role() = 'service_role');

-- CREATE POLICY "Service role can manage sent_notifications" ON sent_notifications
--   FOR ALL USING (auth.role() = 'service_role');

-- Policy: Users can read their own sent notifications
-- CREATE POLICY "Users can view own sent_notifications" ON sent_notifications
--   FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE known_events IS 'Events fetched from Ticketmaster API for followed artists';
COMMENT ON TABLE sent_notifications IS 'Tracks push notifications sent to users to avoid duplicates';
