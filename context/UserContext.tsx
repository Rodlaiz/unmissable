import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { UserPreferences, AuthUser, AuthProvider } from '../types';
import { getUserPreferences, saveUserPreferences, clearUserPreferences, defaultPreferences } from '../services/storage';
import {
  supabase,
  signInWithEmail,
  signUpWithEmail,
  signInWithApple,
  signInWithGoogle,
  signOut as supabaseSignOut,
  resetPassword,
  getCurrentSession,
  onAuthStateChange,
  syncUserProfile,
  syncAllUserArtists,
  removeUserArtist,
  AuthResult,
} from '../services/supabase';
import { getArtistDetails } from '../services/ticketmaster';

interface UserContextType {
  user: UserPreferences | null;
  authUser: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // Preference methods
  updateUser: (prefs: UserPreferences) => Promise<void>;
  // Auth methods
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signInWithApple: () => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  continueAsGuest: () => Promise<void>;
  forgotPassword: (email: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Convert Supabase user to our AuthUser type
const mapSupabaseUser = (user: User | null): AuthUser | null => {
  if (!user) return null;

  const provider: AuthProvider = 
    user.app_metadata?.provider === 'apple' ? 'apple' :
    user.app_metadata?.provider === 'google' ? 'google' :
    'email';

  return {
    id: user.id,
    email: user.email || null,
    provider,
    displayName: user.user_metadata?.full_name || user.user_metadata?.name || undefined,
    avatarUrl: user.user_metadata?.avatar_url || undefined,
    emailVerified: user.email_confirmed_at ? true : false,
    createdAt: user.created_at,
  };
};

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserPreferences | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();

    // Subscribe to auth state changes
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (session?.user) {
        const mappedUser = mapSupabaseUser(session.user);
        setAuthUser(mappedUser);
        
        // Sync user profile to Supabase users table (for OAuth providers like Google)
        // Do this in the background, don't block the UI
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          syncUserProfile(session.user).catch(err => {
            console.error('Failed to sync user profile:', err);
          });
        }
        
        // Update user preferences with auth info if needed
        if (user && mappedUser) {
          const updatedPrefs: UserPreferences = {
            ...user,
            authUser: mappedUser,
            isGuest: false,
          };
          await saveUserPreferences(updatedPrefs);
          setUser(updatedPrefs);
        }
      } else if (event === 'SIGNED_OUT') {
        setAuthUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadUser = async () => {
    try {
      // Load local preferences
      const prefs = await getUserPreferences();
      setUser(prefs);

      // Check for existing Supabase session
      const session = await getCurrentSession();
      if (session?.user) {
        const mappedUser = mapSupabaseUser(session.user);
        setAuthUser(mappedUser);
        
        // Update preferences with auth user if they exist
        if (prefs && mappedUser) {
          const updatedPrefs: UserPreferences = {
            ...prefs,
            authUser: mappedUser,
            isGuest: false,
          };
          await saveUserPreferences(updatedPrefs);
          setUser(updatedPrefs);
        }
      } else if (prefs?.authUser) {
        // Had a user but session expired
        setAuthUser(prefs.authUser);
      }
    } catch (e) {
      console.error('Failed to load user', e);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = async (prefs: UserPreferences) => {
    // Get the previous favorites to detect changes
    const previousFavorites = user?.favorites || [];
    
    // Ensure favorites are always unique before saving (prevents race condition duplicates)
    const sanitizedPrefs = {
      ...prefs,
      favorites: [...new Set(prefs.favorites)],
    };
    await saveUserPreferences(sanitizedPrefs);
    setUser(sanitizedPrefs);

    // Sync location data to Supabase if user is authenticated
    // Uses update to preserve existing fields like push_token
    const currentAuthUser = authUser || sanitizedPrefs.authUser;
    if (currentAuthUser && !sanitizedPrefs.isGuest && sanitizedPrefs.location) {
      try {
        const { error } = await supabase
          .from('users')
          .update({
            city: sanitizedPrefs.location.city || null,
            country: sanitizedPrefs.location.country || null,
            latitude: sanitizedPrefs.location.latitude || null,
            longitude: sanitizedPrefs.location.longitude || null,
            radius_km: sanitizedPrefs.location.radiusKm || 25,
          })
          .eq('id', currentAuthUser.id);

        if (error) {
          console.error('Failed to sync location to Supabase:', error.message);
        } else {
          console.log('Location synced to Supabase successfully');
        }
      } catch (error) {
        console.error('Error syncing location to Supabase:', error);
      }
    }

    // Sync favorites to Supabase if user is authenticated and favorites changed
    if (currentAuthUser && !sanitizedPrefs.isGuest) {
      const newFavorites = sanitizedPrefs.favorites.filter(f => !previousFavorites.includes(f));
      const removedFavorites = previousFavorites.filter(f => !sanitizedPrefs.favorites.includes(f));
      
      if (newFavorites.length > 0) {
        // New favorites were added - sync them to Supabase
        syncFavoritesToSupabase(currentAuthUser.id, newFavorites).catch(err => {
          console.error('Failed to sync new favorites:', err);
        });
      }
      
      if (removedFavorites.length > 0) {
        // Favorites were removed - remove them from Supabase
        removedFavorites.forEach(artistName => {
          // We need to get the artist ID to remove - fetch it first
          getArtistDetails(artistName).then(details => {
            if (details && !details.id.startsWith('mock-')) {
              removeUserArtist(currentAuthUser.id, details.id).catch(err => {
                console.error(`Failed to remove artist ${artistName} from Supabase:`, err);
              });
            }
          }).catch(err => {
            console.error(`Failed to get artist details for removal ${artistName}:`, err);
          });
        });
      }
    }
  };

  // Helper function to sync local favorites to Supabase user_artists table
  const syncFavoritesToSupabase = async (userId: string, favorites: string[]) => {
    if (favorites.length === 0) return;

    try {
      // Fetch artist IDs for all favorites in parallel
      const artistPromises = favorites.map(async (artistName) => {
        try {
          const details = await getArtistDetails(artistName);
          if (details && !details.id.startsWith('mock-')) {
            return { artistId: details.id, artistName };
          }
          return null;
        } catch (err) {
          console.error(`Failed to get artist details for ${artistName}:`, err);
          return null;
        }
      });

      const artists = (await Promise.all(artistPromises)).filter(
        (a): a is { artistId: string; artistName: string } => a !== null
      );

      if (artists.length > 0) {
        await syncAllUserArtists(userId, artists);
        console.log(`Synced ${artists.length} favorites to Supabase`);
      }
    } catch (error) {
      console.error('Error syncing favorites to Supabase:', error);
    }
  };

  const handleSignIn = async (email: string, password: string): Promise<AuthResult> => {
    const result = await signInWithEmail(email, password);
    
    if (result.success && result.user) {
      const mappedUser = mapSupabaseUser(result.user);
      setAuthUser(mappedUser);
      
      // Sync user profile to Supabase users table (in background)
      syncUserProfile(result.user).catch(err => {
        console.error('Failed to sync user profile:', err);
      });
      
      // Update or create preferences
      const basePrefs = user || defaultPreferences;
      const updatedPrefs: UserPreferences = {
        ...basePrefs,
        hasSeenLogin: true,
        authUser: mappedUser!,
        isGuest: false,
      };
      await saveUserPreferences(updatedPrefs);
      setUser(updatedPrefs);

      // Sync existing favorites to Supabase user_artists table (in background)
      if (basePrefs.favorites.length > 0) {
        syncFavoritesToSupabase(result.user.id, basePrefs.favorites).catch(err => {
          console.error('Failed to sync favorites:', err);
        });
      }
    }
    
    return result;
  };

  const handleSignUp = async (email: string, password: string): Promise<AuthResult> => {
    const result = await signUpWithEmail(email, password);
    
    if (result.success && result.user) {
      const mappedUser = mapSupabaseUser(result.user);
      setAuthUser(mappedUser);
      
      // Sync user profile to Supabase users table (in background)
      syncUserProfile(result.user).catch(err => {
        console.error('Failed to sync user profile:', err);
      });
      
      // Update or create preferences
      const basePrefs = user || defaultPreferences;
      const updatedPrefs: UserPreferences = {
        ...basePrefs,
        hasSeenLogin: true,
        authUser: mappedUser!,
        isGuest: false,
      };
      await saveUserPreferences(updatedPrefs);
      setUser(updatedPrefs);

      // Sync existing favorites to Supabase user_artists table (in background)
      if (basePrefs.favorites.length > 0) {
        syncFavoritesToSupabase(result.user.id, basePrefs.favorites).catch(err => {
          console.error('Failed to sync favorites:', err);
        });
      }
    }
    
    return result;
  };

  const handleAppleSignIn = async (): Promise<AuthResult> => {
    const result = await signInWithApple();
    
    if (result.success && result.user) {
      const mappedUser = mapSupabaseUser(result.user);
      setAuthUser(mappedUser);
      
      // Sync user profile to Supabase users table (in background)
      syncUserProfile(result.user).catch(err => {
        console.error('Failed to sync user profile:', err);
      });
      
      // Update or create preferences
      const basePrefs = user || defaultPreferences;
      const updatedPrefs: UserPreferences = {
        ...basePrefs,
        hasSeenLogin: true,
        authUser: mappedUser!,
        isGuest: false,
      };
      await saveUserPreferences(updatedPrefs);
      setUser(updatedPrefs);

      // Sync existing favorites to Supabase user_artists table (in background)
      if (basePrefs.favorites.length > 0) {
        syncFavoritesToSupabase(result.user.id, basePrefs.favorites).catch(err => {
          console.error('Failed to sync favorites:', err);
        });
      }
    }
    
    return result;
  };

  const handleGoogleSignIn = async (): Promise<AuthResult> => {
    // Google OAuth returns a URL to open
    const result = await signInWithGoogle();
    return result;
  };

  const continueAsGuest = async () => {
    const basePrefs = user || defaultPreferences;
    const guestUser: AuthUser = {
      id: `guest_${Date.now()}`,
      email: null,
      provider: 'guest',
    };
    
    const updatedPrefs: UserPreferences = {
      ...basePrefs,
      hasSeenLogin: true,
      authUser: guestUser,
      isGuest: true,
    };
    
    await saveUserPreferences(updatedPrefs);
    setUser(updatedPrefs);
    setAuthUser(guestUser);
  };

  const handleForgotPassword = async (email: string): Promise<AuthResult> => {
    return await resetPassword(email);
  };

  const logout = async () => {
    // Sign out from Supabase
    await supabaseSignOut();
    
    // Clear local user data
    await clearUserPreferences();
    setUser(null);
    setAuthUser(null);
  };

  const isAuthenticated = !!authUser && !user?.isGuest;

  return (
    <UserContext.Provider 
      value={{ 
        user, 
        authUser,
        isLoading, 
        isAuthenticated,
        updateUser,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signInWithApple: handleAppleSignIn,
        signInWithGoogle: handleGoogleSignIn,
        continueAsGuest,
        forgotPassword: handleForgotPassword,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
