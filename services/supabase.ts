import 'react-native-url-polyfill/auto';
import { createClient, AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

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

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not found. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
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
