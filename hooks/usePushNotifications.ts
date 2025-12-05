import { useEffect, useRef } from 'react';
import { registerForPushNotificationsAsync } from '../services/notifications';
import { supabase } from '../services/supabase';

/**
 * Hook to register for push notifications and save the token to Supabase.
 * Should be called after the user is authenticated.
 * 
 * @param userId - The authenticated user's ID, or null/undefined if not authenticated
 */
export function usePushNotifications(userId: string | null | undefined): void {
  const hasRegistered = useRef(false);

  useEffect(() => {
    // Skip if no user ID or already registered in this session
    if (!userId || hasRegistered.current) {
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

        // Save the token to Supabase users table
        const { error } = await supabase
          .from('users')
          .upsert(
            { id: userId, push_token: token },
            { onConflict: 'id' }
          );

        if (error) {
          console.error('Failed to save push token to Supabase:', error.message);
          return;
        }

        console.log('Push token saved successfully');
        hasRegistered.current = true;
      } catch (error) {
        console.error('Error registering push notifications:', error);
      }
    };

    registerToken();
  }, [userId]);
}
