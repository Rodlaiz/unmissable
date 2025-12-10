import { useCallback } from 'react';
import { useUser } from '../context/UserContext';
import { syncUserArtist, removeUserArtist } from '../services/supabase';
import { getArtistDetails } from '../services/ticketmaster';

interface UseFavoritesOptions {
  /** Pre-fetched artist ID (skips lookup if provided) */
  artistId?: string | null;
}

interface UseFavoritesReturn {
  /** Check if an artist name is in favorites */
  isFavorited: (artistName: string) => boolean;
  /** Toggle favorite status for an artist */
  toggleFavorite: (artistName: string, options?: UseFavoritesOptions) => Promise<void>;
  /** Check if an artist can be favorited (has a name) */
  canFavorite: (artistName?: string) => boolean;
}

/**
 * Hook for managing artist favorites with Supabase sync.
 * Consolidates favorite logic used across event detail, artist detail, and home screens.
 */
export function useFavorites(): UseFavoritesReturn {
  const { user, authUser, updateUser } = useUser();

  const isFavorited = useCallback(
    (artistName: string): boolean => {
      if (!user || !artistName) return false;
      return user.favorites.includes(artistName);
    },
    [user]
  );

  const canFavorite = useCallback((artistName?: string): boolean => {
    return !!artistName;
  }, []);

  const toggleFavorite = useCallback(
    async (artistName: string, options?: UseFavoritesOptions) => {
      if (!user || !artistName) return;

      const alreadyFavorited = user.favorites.includes(artistName);
      let newFavorites: string[];

      if (alreadyFavorited) {
        newFavorites = user.favorites.filter((f) => f !== artistName);
      } else {
        // Prevent duplicates
        if (user.favorites.includes(artistName)) return;
        newFavorites = [...user.favorites, artistName];
      }

      await updateUser({ ...user, favorites: newFavorites });

      // Sync to Supabase if authenticated
      if (authUser && !user.isGuest) {
        let artistIdToSync = options?.artistId;

        // Fetch artist ID if not provided
        if (!artistIdToSync) {
          try {
            const details = await getArtistDetails(artistName);
            if (details && !details.id.startsWith('mock-')) {
              artistIdToSync = details.id;
            }
          } catch (err) {
            console.error('Failed to get artist details for sync:', err);
          }
        }

        // Only sync if we have a valid (non-mock) artist ID
        if (artistIdToSync && !artistIdToSync.startsWith('mock-')) {
          if (alreadyFavorited) {
            removeUserArtist(authUser.id, artistIdToSync).catch((err) => {
              console.error('Failed to remove artist from Supabase:', err);
            });
          } else {
            syncUserArtist(authUser.id, artistIdToSync, artistName).catch((err) => {
              console.error('Failed to sync artist to Supabase:', err);
            });
          }
        }
      }
    },
    [user, authUser, updateUser]
  );

  return { isFavorited, toggleFavorite, canFavorite };
}
