export type Category = 'Music' | 'Comedy' | 'Theater';
export type EventStatus = 'ON_SALE' | 'SOLD_OUT' | 'CANCELED' | 'POSTPONED' | 'RESCHEDULED' | 'UNAVAILABLE';

export interface UserPreferences {
  hasOnboarded: boolean;
  hasSeenLogin?: boolean;
  location: {
    city: string;
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

export type OnboardingStep = 'location' | 'categories' | 'favorites' | 'done';
