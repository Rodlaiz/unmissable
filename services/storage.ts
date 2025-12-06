import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserPreferences } from '../types';

const STORAGE_KEY = 'unmissable_user_prefs_v2';

const defaultPreferences: UserPreferences = {
  hasOnboarded: false,
  hasSeenLogin: false,
  location: {
    city: '',
    displayLabel: '',
    latitude: null,
    longitude: null,
    radiusKm: 25,
  },
  categories: [],
  favorites: [],
  notifications: {
    enabled: true,
    dailyDigest: true,
    weeklySummary: false,
  },
};

export const getUserPreferences = async (): Promise<UserPreferences | null> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: UserPreferences = JSON.parse(stored);
      // Filter out old Sports category if present
      if (parsed.categories) {
        parsed.categories = parsed.categories.filter((c: any) => c !== 'Sports');
      }
      // Ensure notifications object exists
      if (!parsed.notifications) {
        parsed.notifications = {
          enabled: true,
          dailyDigest: true,
          weeklySummary: false,
        };
      }
      return parsed;
    }
    return null;
  } catch (e) {
    console.error('Failed to get user preferences', e);
    return null;
  }
};

export const saveUserPreferences = async (prefs: UserPreferences): Promise<void> => {
  try {
    // Ensure favorites are always unique (prevents race condition duplicates)
    const sanitizedPrefs = {
      ...prefs,
      favorites: [...new Set(prefs.favorites)],
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedPrefs));
  } catch (e) {
    console.error('Failed to save user preferences', e);
  }
};

export const clearUserPreferences = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear user preferences', e);
  }
};

export { defaultPreferences };
