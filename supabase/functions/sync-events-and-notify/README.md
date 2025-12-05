# sync-events-and-notify

Supabase Edge Function that syncs events from Ticketmaster and sends push notifications to users.

## What it does

1. **Fetches all unique artist IDs** from the `user_artists` table
2. **Queries Ticketmaster Discovery API** for each artist's events
   - Uses `attractionId` parameter to get events for specific artists
   - Filters out sports events (where `classifications[].segment.name === 'Sports'`)
3. **Stores new events** in `known_events` table with `notified = false`
4. **Sends push notifications** for unnotified events:
   - Finds users who follow the artist AND have a push token
   - Checks `sent_notifications` to avoid duplicates
   - Sends via Expo Push API
   - Records sent notifications
   - Marks events as notified

## Notification Payload

```json
{
  "to": "{push_token}",
  "title": "🎵 {artist_name} is coming!",
  "body": "{event_name} - {venue_name}",
  "data": { "eventId": "{ticketmaster_id}" }
}
```

## Required Database Tables

### user_artists
- `user_id` (uuid)
- `artist_id` (text) - Ticketmaster attraction ID

### users
- `id` (uuid)
- `push_token` (text, nullable)

### known_events
- `id` (uuid, primary key)
- `ticketmaster_id` (text, unique)
- `artist_id` (text)
- `artist_name` (text)
- `event_name` (text)
- `venue_name` (text)
- `city` (text)
- `event_date` (timestamptz)
- `ticket_url` (text)
- `image_url` (text)
- `notified` (boolean, default false)

### sent_notifications
- `id` (uuid, primary key)
- `user_id` (uuid)
- `event_id` (uuid, references known_events.id)
- `sent_at` (timestamptz)

## Environment Variables

Set these in your Supabase project:

- `TICKETMASTER_API_KEY` - Your Ticketmaster Discovery API key
- `SUPABASE_URL` - Your Supabase project URL (automatically set)
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (automatically set)

## Deployment

```bash
# Login to Supabase CLI
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Set secrets
supabase secrets set TICKETMASTER_API_KEY=your_api_key

# Deploy the function
supabase functions deploy sync-events-and-notify
```

## Usage

### Invoke manually

```bash
curl -X POST https://your-project.supabase.co/functions/v1/sync-events-and-notify \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Schedule with pg_cron (recommended)

Run this SQL to schedule the function to run every hour:

```sql
-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the function to run every hour
SELECT cron.schedule(
  'sync-events-hourly',
  '0 * * * *',  -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/sync-events-and-notify',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

## Response

```json
{
  "success": true,
  "eventsProcessed": 150,
  "newEventsAdded": 5,
  "notificationsSent": 12
}
```
