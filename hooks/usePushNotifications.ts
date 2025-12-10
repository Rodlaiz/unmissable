import { useEffect, useRef } from 'react';
import { registerForPushNotificationsAsync } from '../services/notifications';
import { supabase } from '../services/supabase';

/**
 * Hook to register for push notifications and save the token to Supabase.
 * Should be called after the user is authenticated.
 * Skips guest users (IDs starting with 'guest_') since they don't have Supabase accounts.
 * 
 * @param userId - The authenticated user's ID, or null/undefined if not authenticated
 * @param userEmail - The authenticated user's email (optional, helps create user row if needed)
 * @param displayName - The authenticated user's display name (optional)
 */
export function usePushNotifications(
  userId: string | null | undefined,
  userEmail?: string | null,
  displayName?: string | null
): void {
  const hasRegistered = useRef(false);

  useEffect(() => {
    // Skip if no user ID, guest user, or already registered in this session
    if (!userId || userId.startsWith('guest_') || hasRegistered.current) {
      return;
    }

    const registerToken = async () => {
      try {
        // Get the push token (handles permissions internally)
        const token = await registerForPushNotificationsAsync();

        if (!token) {
          // Permission denied or running in Expo Go - handled gracefully
          console.log('Push notification token not available');
          return;
        }

        // Build the upsert data with optional email and display_name
        const upsertData: Record<string, string | null> = {
          id: userId,
          push_token: token,
        };
        
        // Include email and display_name if available (helps create row if it doesn't exist)
        if (userEmail) {
          upsertData.email = userEmail;
        }
        if (displayName) {
          upsertData.display_name = displayName;
        }

        // Save the token to Supabase users table
        const { error } = await supabase
          .from('users')
          .upsert(upsertData, { onConflict: 'id' });

        if (error) {
          console.error('Failed to save push token to Supabase:', error.message);
          return;
        }

        console.log('Push token saved successfully');
        console.log('Your push token:', token);
        hasRegistered.current = true;
      } catch (error) {
        console.error('Error registering push notifications:', error);
      }
    };

    registerToken();
  }, [userId, userEmail, displayName]);
}
