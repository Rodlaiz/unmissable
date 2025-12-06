export type Category = 'Music' | 'Comedy' | 'Theater';
export type EventStatus = 'ON_SALE' | 'SOLD_OUT' | 'CANCELED' | 'POSTPONED' | 'RESCHEDULED' | 'UNAVAILABLE';

// Auth types
export type AuthProvider = 'email' | 'google' | 'apple' | 'guest';

export interface AuthUser {
  id: string;
  email: string | null;
  provider: AuthProvider;
  displayName?: string;
  avatarUrl?: string;
  emailVerified?: boolean;
  createdAt?: string;
}

export interface UserPreferences {
  hasOnboarded: boolean;
  hasSeenLogin?: boolean;
  // Auth info
  authUser?: AuthUser;
  isGuest?: boolean;
  location: {
    city: string;
    country?: string;
    displayLabel?: string;
    latitude: number | null;
    longitude: number | null;
    radiusKm: number;
  };
  categories: Category[];
  favorites: string[];
  notifications?: {
    enabled: boolean;
    dailyDigest: boolean;
    weeklySummary: boolean;
  };
  pushToken?: string;
}

export interface Event {
  id: string;
  name: string;
  artistName?: string;
  category: Category;
  venue: string;
  city: string;
  date: string;
  imageUrl: string;
  ticketUrl: string;
  featured?: boolean;
  description?: string;
  location?: { lat: number; lng: number };
  availability: EventStatus;
}

export interface ArtistProfile {
  id: string;
  name: string;
  image: string;
  bannerUrl?: string;
  genre: string;
  nextEvent: Event | null;
  status: 'local' | 'global' | 'none';
}

export type OnboardingStep = 'location' | 'categories' | 'favorites' | 'notifications' | 'done';
