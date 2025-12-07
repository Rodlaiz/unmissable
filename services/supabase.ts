import 'react-native-url-polyfill/auto';
import { createClient, AuthChangeEvent, Session, User, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// SecureStore adapter for Supabase auth persistence
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('SecureStore getItem error:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('SecureStore setItem error:', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('SecureStore removeItem error:', error);
    }
  },
};

// Helper to get config values - checks process.env first, then Constants.expoConfig.extra
const getConfigValue = (envKey: string, extraKey: string): string => {
  // Check process.env first (works in dev and EAS builds)
  const envValue = process.env[envKey];
  if (envValue) return envValue;
  
  // Fallback to Constants.expoConfig.extra (embedded at build time)
  const extraValue = Constants.expoConfig?.extra?.[extraKey];
  if (extraValue) return extraValue;
  
  return '';
};

// Lazy initialization of Supabase client
let _supabaseInstance: SupabaseClient | null = null;

const getSupabaseClient = (): SupabaseClient => {
  if (_supabaseInstance) {
    return _supabaseInstance;
  }

  const supabaseUrl = getConfigValue('EXPO_PUBLIC_SUPABASE_URL', 'supabaseUrl');
  const supabaseAnonKey = getConfigValue('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'supabaseAnonKey');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase configuration:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      expoConfig: Constants.expoConfig?.extra,
    });
    throw new Error(
      'Supabase credentials not found. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
    );
  }

  _supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return _supabaseInstance;
};

// Export a proxy that lazily initializes the client
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabaseClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

// Auth types
export interface AuthResult {
  success: boolean;
  user?: User | null;
  error?: string;
}

// Email/Password Sign Up
export const signUpWithEmail = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Check if email confirmation is required
    if (data.user && !data.session) {
      return {
        success: true,
        user: data.user,
        error: 'Please check your email to confirm your account.',
      };
    }

    return { success: true, user: data.user };
  } catch (error) {
    console.error('Sign up error:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
};

// Email/Password Sign In
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Provide user-friendly error messages
      if (error.message.includes('Invalid login credentials')) {
        return { success: false, error: 'Invalid email or password.' };
      }
      if (error.message.includes('Email not confirmed')) {
        return { success: false, error: 'Please verify your email before signing in.' };
      }
      return { success: false, error: error.message };
    }

    return { success: true, user: data.user };
  } catch (error) {
    console.error('Sign in error:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
};

// Sign In with Apple
export const signInWithApple = async (): Promise<AuthResult> => {
  if (Platform.OS !== 'ios') {
    return { success: false, error: 'Apple Sign In is only available on iOS.' };
  }

  try {
    // Check if Apple authentication is available
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      return { success: false, error: 'Apple Sign In is not available on this device.' };
    }

    // Request Apple authentication
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { success: false, error: 'Failed to get Apple identity token.' };
    }

    // Sign in to Supabase with Apple ID token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // If we got the user's name from Apple (first sign in only), update their profile
    if (credential.fullName?.givenName || credential.fullName?.familyName) {
      const displayName = [credential.fullName.givenName, credential.fullName.familyName]
        .filter(Boolean)
        .join(' ');

      if (displayName) {
        await supabase.auth.updateUser({
          data: { full_name: displayName },
        });
      }
    }

    return { success: true, user: data.user };
  } catch (error: any) {
    if (error.code === 'ERR_REQUEST_CANCELED') {
      return { success: false, error: 'Sign in was cancelled.' };
    }
    console.error('Apple sign in error:', error);
    return { success: false, error: 'Failed to sign in with Apple. Please try again.' };
  }
};

// Sign In with Google
export const signInWithGoogle = async (): Promise<AuthResult> => {
  try {
    // For Google OAuth, we need to use the web-based flow
    // This requires setting up Google OAuth in Supabase dashboard
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'unmissable://auth/callback',
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // The OAuth flow opens a browser, so we need to handle the callback
    // This is typically done through deep linking
    if (data.url) {
      // Return the URL so the caller can open it
      return { 
        success: true, 
        error: data.url // Using error field to pass URL (not ideal but works for this flow)
      };
    }

    return { success: false, error: 'Failed to initiate Google sign in.' };
  } catch (error) {
    console.error('Google sign in error:', error);
    return { success: false, error: 'Failed to sign in with Google. Please try again.' };
  }
};

// Password Reset
export const resetPassword = async (email: string): Promise<AuthResult> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'unmissable://auth/reset-password',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Password reset error:', error);
    return { success: false, error: 'Failed to send password reset email.' };
  }
};

// Sync user profile to users table (call after successful auth)
// Uses update first to preserve existing fields like push_token, then inserts if user doesn't exist
export const syncUserProfile = async (user: User): Promise<void> => {
  try {
    const email = user.email || null;
    const displayName = user.user_metadata?.full_name || 
                        user.user_metadata?.name || 
                        user.user_metadata?.display_name || 
                        null;

    // First try to update existing user (preserves push_token and other fields)
    const { data: updateData, error: updateError } = await supabase
      .from('users')
      .update({
        email: email,
        display_name: displayName,
      })
      .eq('id', user.id)
      .select();

    if (updateError) {
      console.error('Failed to update user profile:', updateError.message);
      return;
    }

    // If no rows were updated, the user doesn't exist yet - insert them
    if (!updateData || updateData.length === 0) {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: email,
          display_name: displayName,
        });

      if (insertError) {
        console.error('Failed to insert user profile:', insertError.message);
      } else {
        console.log('User profile created in Supabase successfully');
      }
    } else {
      console.log('User profile synced to Supabase successfully');
    }
  } catch (error) {
    console.error('Error syncing user profile:', error);
  }
};

// Sign Out
export const signOut = async (): Promise<AuthResult> => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return { success: false, error: 'Failed to sign out.' };
  }
};

// Get current session
export const getCurrentSession = async (): Promise<Session | null> => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Get session error:', error);
      return null;
    }
    return data.session;
  } catch (error) {
    console.error('Get session error:', error);
    return null;
  }
};

// Get current user
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Get user error:', error);
      return null;
    }
    return data.user;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
};

// Subscribe to auth state changes
export const onAuthStateChange = (
  callback: (event: AuthChangeEvent, session: Session | null) => void
) => {
  return supabase.auth.onAuthStateChange(callback);
};

// ============================================
// User Artists Sync Functions
// ============================================

export interface UserArtist {
  user_id: string;
  artist_id: string;
  artist_name: string;
}

// Add an artist to user's favorites in Supabase
export const syncUserArtist = async (
  userId: string,
  artistId: string,
  artistName: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('user_artists')
      .upsert(
        {
          user_id: userId,
          artist_id: artistId,
          artist_name: artistName,
        },
        { onConflict: 'user_id,artist_id' }
      );

    if (error) {
      console.error('Failed to sync user artist:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`Synced artist ${artistName} (${artistId}) for user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('Error syncing user artist:', error);
    return { success: false, error: 'Failed to sync artist' };
  }
};

// Remove an artist from user's favorites in Supabase
export const removeUserArtist = async (
  userId: string,
  artistId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('user_artists')
      .delete()
      .eq('user_id', userId)
      .eq('artist_id', artistId);

    if (error) {
      console.error('Failed to remove user artist:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`Removed artist ${artistId} for user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('Error removing user artist:', error);
    return { success: false, error: 'Failed to remove artist' };
  }
};

// Bulk sync all user artists (useful on sign-in to sync local favorites)
export const syncAllUserArtists = async (
  userId: string,
  artists: Array<{ artistId: string; artistName: string }>,
  replaceAll: boolean = false
): Promise<{ success: boolean; error?: string }> => {
  try {
    // If replaceAll is true, delete all existing artists first
    if (replaceAll) {
      const { error: deleteError } = await supabase
        .from('user_artists')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Error deleting old user artists:', deleteError);
        // Continue anyway - we'll still try to insert the new ones
      } else {
        console.log(`Deleted all existing artists for user ${userId}`);
      }
    }

    if (artists.length === 0) return { success: true };

    const records = artists.map((artist) => ({
      user_id: userId,
      artist_id: artist.artistId,
      artist_name: artist.artistName,
    }));

    const { error } = await supabase
      .from('user_artists')
      .upsert(records, { onConflict: 'user_id,artist_id' });

    if (error) {
      console.error('Failed to bulk sync user artists:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`Bulk synced ${artists.length} artists for user ${userId} (replaceAll: ${replaceAll})`);
    return { success: true };
  } catch (error) {
    console.error('Error bulk syncing user artists:', error);
    return { success: false, error: 'Failed to sync artists' };
  }
};

// ============================================
// Ticket Intent Tracking Functions
// ============================================

export interface TicketIntent {
  user_id: string;
  event_id: string;
  event_name: string;
  ticket_url: string;
}

// Track when a user clicks to buy tickets
export const trackTicketIntent = async (
  userId: string,
  eventId: string,
  eventName: string,
  ticketUrl: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('ticket_intents')
      .insert({
        user_id: userId,
        event_id: eventId,
        event_name: eventName,
        ticket_url: ticketUrl,
      });

    if (error) {
      console.error('Failed to track ticket intent:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`Tracked ticket intent for event ${eventName} (${eventId})`);
    return { success: true };
  } catch (error) {
    console.error('Error tracking ticket intent:', error);
    return { success: false, error: 'Failed to track ticket intent' };
  }
};
