-- =============================================================================
-- TEST PUSH NOTIFICATION SCRIPT
-- =============================================================================
-- Run this script in Supabase SQL Editor to test push notifications
-- 
-- STEPS:
-- 1. Run this script to create a fake "unnotified" event
-- 2. Trigger the edge function (via Dashboard or curl)
-- 3. You should receive a push notification on your device!
--
-- IMPORTANT: Make sure you:
-- - Are logged into the app on a physical device (not simulator/Expo Go)
-- - Have push notifications enabled
-- - Have a push_token stored in the users table
-- =============================================================================

-- Step 1: View your followed artists to pick one for testing
SELECT 
  artist_id,
  artist_name,
  user_id::text as user_id
FROM user_artists
LIMIT 10;

-- Step 2: Check if your user has a push token registered
SELECT 
  id::text as user_id,
  email,
  CASE 
    WHEN push_token IS NOT NULL THEN 'YES - Token registered'
    ELSE 'NO - Missing push token!'
  END as push_token_status,
  LEFT(push_token, 40) as token_preview
FROM users
LIMIT 10;

-- =============================================================================
-- UNCOMMENT AND MODIFY THE FOLLOWING TO CREATE A TEST EVENT
-- Replace the values with an artist you follow!
-- =============================================================================

/*
-- Create a test event that will trigger a notification
INSERT INTO known_events (
  ticketmaster_id,
  artist_id,
  artist_name,
  event_name,
  venue_name,
  city,
  event_date,
  ticket_url,
  image_url,
  notified
) VALUES (
  'TEST_' || to_char(NOW(), 'YYYYMMDDHH24MISS'),  -- Unique ID based on timestamp
  'K8vZ9171K77',                                    -- ⚠️ Replace with YOUR artist_id from Step 1
  'Taylor Swift',                                  -- ⚠️ Replace with YOUR artist_name from Step 1
  '🧪 TEST: New Concert Announcement!',
  'WiZink Center',
  'Madrid',
  NOW() + INTERVAL '60 days',
  'https://www.ticketmaster.com',
  'https://via.placeholder.com/600x400/6366f1/ffffff?text=Test+Event',
  false  -- ← This is key! false = will trigger notification
);
*/

-- =============================================================================
-- After inserting, trigger the edge function:
--
-- Option A: Supabase Dashboard → Edge Functions → sync-events-and-notify → Invoke
--
-- Option B: Terminal command:
-- curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/sync-events-and-notify' \
--   -H 'Authorization: Bearer YOUR_ANON_KEY'
-- =============================================================================

-- Step 3: Verify the test event was created and check notification status
SELECT 
  id,
  ticketmaster_id,
  artist_name,
  event_name,
  venue_name,
  notified,
  created_at
FROM known_events
WHERE ticketmaster_id LIKE 'TEST_%'
ORDER BY created_at DESC
LIMIT 5;

-- Step 4: Check if notifications were sent
SELECT 
  sn.id,
  sn.user_id,
  sn.event_id,
  ke.event_name,
  sn.sent_at
FROM sent_notifications sn
JOIN known_events ke ON sn.event_id = ke.id
WHERE ke.ticketmaster_id LIKE 'TEST_%'
ORDER BY sn.sent_at DESC
LIMIT 10;

-- =============================================================================
-- CLEANUP: Remove test data when done
-- =============================================================================

/*
-- Delete test notifications first (due to foreign key)
DELETE FROM sent_notifications 
WHERE event_id IN (
  SELECT id FROM known_events WHERE ticketmaster_id LIKE 'TEST_%'
);

-- Delete test events
DELETE FROM known_events WHERE ticketmaster_id LIKE 'TEST_%';
*/
