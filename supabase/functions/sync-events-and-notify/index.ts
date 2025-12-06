import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Environment variables
const TICKETMASTER_API_KEY = Deno.env.get("TICKETMASTER_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN");

// Initialize Supabase client with service role key for admin access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Ticketmaster API configuration
const TICKETMASTER_BASE_URL = "https://app.ticketmaster.com/discovery/v2";

interface TicketmasterEvent {
  id: string;
  name: string;
  dates: {
    start: {
      dateTime?: string;
      localDate?: string;
    };
  };
  _embedded?: {
    venues?: Array<{
      name: string;
      city?: { name: string };
      country?: { name: string };
      location?: {
        latitude: string;
        longitude: string;
      };
    }>;
    attractions?: Array<{
      id: string;
      name: string;
    }>;
  };
  url?: string;
  images?: Array<{
    url: string;
    ratio: string;
    width: number;
  }>;
  classifications?: Array<{
    segment?: { name: string };
    genre?: { name: string };
  }>;
  priceRanges?: Array<{
    min: number;
    max: number;
    currency: string;
  }>;
}

interface TicketmasterResponse {
  _embedded?: {
    events?: TicketmasterEvent[];
  };
  page?: {
    totalElements: number;
    totalPages: number;
  };
}

interface KnownEvent {
  id: string;
  ticketmaster_id: string;
  artist_id: string;
  artist_name: string;
  event_name: string;
  venue_name: string;
  city: string;
  event_date: string;
  ticket_url: string;
  image_url: string;
  notified: boolean;
}

interface UserArtist {
  user_id: string;
  artist_id: string;
}

interface UserWithToken {
  id: string;
  push_token: string;
}

interface SentNotification {
  user_id: string;
  event_id: string;
}

// Rate limiting helper for Ticketmaster API
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches events for an artist from Ticketmaster API
 */
async function fetchEventsForArtist(
  artistId: string
): Promise<TicketmasterEvent[]> {
  const url = new URL(`${TICKETMASTER_BASE_URL}/events.json`);
  url.searchParams.set("attractionId", artistId);
  url.searchParams.set("apikey", TICKETMASTER_API_KEY);
  url.searchParams.set("size", "50");

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error(
        `Ticketmaster API error for artist ${artistId}: ${response.status}`
      );
      return [];
    }

    const data: TicketmasterResponse = await response.json();

    if (!data._embedded?.events) {
      return [];
    }

    // Filter out sports events
    return data._embedded.events.filter((event) => {
      const isSports = event.classifications?.some(
        (classification) => classification.segment?.name === "Sports"
      );
      return !isSports;
    });
  } catch (error) {
    console.error(`Error fetching events for artist ${artistId}:`, error);
    return [];
  }
}

/**
 * Gets all unique artist IDs from user_artists table
 */
async function getUniqueArtistIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_artists")
    .select("artist_id");

  if (error) {
    console.error("Error fetching artist IDs:", error);
    return [];
  }

  // Get unique artist IDs
  const uniqueIds = [...new Set(data?.map((item) => item.artist_id) || [])];
  return uniqueIds;
}

/**
 * Checks if an event exists in known_events table
 */
async function eventExists(ticketmasterId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("known_events")
    .select("id")
    .eq("ticketmaster_id", ticketmasterId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found
    console.error("Error checking event existence:", error);
  }

  return !!data;
}

/**
 * Inserts a new event into known_events table
 */
async function insertKnownEvent(
  event: TicketmasterEvent,
  artistId: string,
  artistName: string
): Promise<void> {
  const venue = event._embedded?.venues?.[0];
  const bestImage = event.images?.reduce((best, current) =>
    current.width > (best?.width || 0) ? current : best
  );

  const newEvent = {
    ticketmaster_id: event.id,
    artist_id: artistId,
    artist_name: artistName,
    event_name: event.name,
    venue_name: venue?.name || "TBA",
    city: venue?.city?.name || "TBA",
    event_date: event.dates?.start?.dateTime || event.dates?.start?.localDate,
    ticket_url: event.url || "",
    image_url: bestImage?.url || "",
    notified: false,
  };

  const { error } = await supabase.from("known_events").insert(newEvent);

  if (error) {
    console.error("Error inserting event:", error);
  }
}

/**
 * Gets all unnotified events
 */
async function getUnnotifiedEvents(): Promise<KnownEvent[]> {
  const { data, error } = await supabase
    .from("known_events")
    .select("*")
    .eq("notified", false);

  if (error) {
    console.error("Error fetching unnotified events:", error);
    return [];
  }

  return data || [];
}

/**
 * Gets users who follow a specific artist and have a push token
 */
async function getUsersFollowingArtist(
  artistId: string
): Promise<UserWithToken[]> {
  // First get user IDs who follow this artist
  const { data: userArtists, error: userArtistsError } = await supabase
    .from("user_artists")
    .select("user_id")
    .eq("artist_id", artistId);

  if (userArtistsError || !userArtists?.length) {
    return [];
  }

  const userIds = userArtists.map((ua) => ua.user_id);

  // Then get users with push tokens
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, push_token")
    .in("id", userIds)
    .not("push_token", "is", null);

  if (usersError) {
    console.error("Error fetching users with push tokens:", error);
    return [];
  }

  return (users || []).filter((user) => user.push_token);
}

/**
 * Checks if a notification has already been sent to a user for an event
 */
async function wasNotificationSent(
  userId: string,
  eventId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("sent_notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error checking sent notification:", error);
  }

  return !!data;
}

/**
 * Sends a push notification via Expo Push API
 */
async function sendExpoPushNotification(
  pushToken: string,
  artistName: string,
  eventName: string,
  venueName: string,
  ticketmasterId: string
): Promise<boolean> {
  const payload = {
    to: pushToken,
    title: `🎵 ${artistName} is coming!`,
    body: `${eventName} - ${venueName}`,
    data: { eventId: ticketmasterId },
  };

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    
    // Add authorization header if Expo access token is available (required for FCM)
    if (EXPO_ACCESS_TOKEN) {
      headers["Authorization"] = `Bearer ${EXPO_ACCESS_TOKEN}`;
    }

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Expo push failed: ${response.status}`);
      return false;
    }

    const result = await response.json();

    if (result.data?.status === "error") {
      console.error("Expo push error:", result.data.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending push notification:", error);
    return false;
  }
}

/**
 * Records a sent notification
 */
async function recordSentNotification(
  userId: string,
  eventId: string
): Promise<void> {
  const { error } = await supabase.from("sent_notifications").insert({
    user_id: userId,
    event_id: eventId,
    sent_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Error recording sent notification:", error);
  }
}

/**
 * Marks an event as notified
 */
async function markEventAsNotified(eventId: string): Promise<void> {
  const { error } = await supabase
    .from("known_events")
    .update({ notified: true })
    .eq("id", eventId);

  if (error) {
    console.error("Error marking event as notified:", error);
  }
}

/**
 * Main function to sync events and send notifications
 */
async function syncEventsAndNotify(): Promise<{
  eventsProcessed: number;
  newEventsAdded: number;
  notificationsSent: number;
}> {
  const stats = {
    eventsProcessed: 0,
    newEventsAdded: 0,
    notificationsSent: 0,
  };

  console.log("Starting sync-events-and-notify...");

  // Step 1: Get all unique artist IDs
  const artistIds = await getUniqueArtistIds();
  console.log(`Found ${artistIds.length} unique artists to check`);

  // Step 2: For each artist, fetch events from Ticketmaster
  for (const artistId of artistIds) {
    // Rate limiting - wait between requests
    await delay(200);

    const events = await fetchEventsForArtist(artistId);
    console.log(`Found ${events.length} events for artist ${artistId}`);

    for (const event of events) {
      stats.eventsProcessed++;

      // Step 3: Check if event exists in known_events
      const exists = await eventExists(event.id);

      if (!exists) {
        // Get artist name from the event
        const artistName =
          event._embedded?.attractions?.find((a) => a.id === artistId)?.name ||
          event._embedded?.attractions?.[0]?.name ||
          "Unknown Artist";

        // Insert new event with notified = false
        await insertKnownEvent(event, artistId, artistName);
        stats.newEventsAdded++;
        console.log(`Added new event: ${event.name}`);
      }
    }
  }

  // Step 4: Find unnotified events and send notifications
  const unnotifiedEvents = await getUnnotifiedEvents();
  console.log(`Found ${unnotifiedEvents.length} unnotified events`);

  for (const event of unnotifiedEvents) {
    // Get users who follow this artist and have push tokens
    const users = await getUsersFollowingArtist(event.artist_id);
    console.log(
      `Found ${users.length} users to notify for event: ${event.event_name}`
    );

    let eventNotifiedToAtLeastOne = false;

    for (const user of users) {
      // Check if notification was already sent
      const alreadySent = await wasNotificationSent(user.id, event.id);

      if (!alreadySent) {
        // Send push notification
        const success = await sendExpoPushNotification(
          user.push_token,
          event.artist_name,
          event.event_name,
          event.venue_name,
          event.ticketmaster_id
        );

        if (success) {
          // Record sent notification
          await recordSentNotification(user.id, event.id);
          stats.notificationsSent++;
          eventNotifiedToAtLeastOne = true;
          console.log(`Sent notification to user ${user.id} for ${event.event_name}`);
        }
      }
    }

    // Mark event as notified if at least one notification was sent
    // or if there are no users to notify
    if (eventNotifiedToAtLeastOne || users.length === 0) {
      await markEventAsNotified(event.id);
    }
  }

  console.log("Sync completed:", stats);
  return stats;
}

// Edge Function handler
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Verify required environment variables
    if (!TICKETMASTER_API_KEY) {
      throw new Error("TICKETMASTER_API_KEY is not set");
    }
    if (!SUPABASE_URL) {
      throw new Error("SUPABASE_URL is not set");
    }
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    }

    const result = await syncEventsAndNotify();

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in sync-events-and-notify:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
