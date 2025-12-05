import { Event, Category, EventStatus } from '../types';

const API_KEY = process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY || '';
const BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

if (!API_KEY) {
  console.warn('EXPO_PUBLIC_TICKETMASTER_API_KEY is not set. API calls will fail.');
}

// Simple in-memory cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getFromCache = <T>(key: string): T | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
};

const setCache = <T>(key: string, data: T): void => {
  cache.set(key, { data, timestamp: Date.now() });
};

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 200; // 200ms between requests

const waitForRateLimit = async (): Promise<void> => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
};

interface TMImage {
  url: string;
  ratio: string;
  width: number;
}

interface TMEvent {
  id: string;
  name: string;
  dates: {
    start: {
      dateTime: string;
      localDate: string;
    };
    status?: {
      code: string;
    };
  };
  images: TMImage[];
  _embedded?: {
    venues?: {
      name: string;
      city: { name: string };
      country: { name: string };
      location?: {
        latitude: string;
        longitude: string;
      };
    }[];
    attractions?: {
      name: string;
    }[];
  };
  url: string;
  info?: string;
  pleaseNote?: string;
  classifications?: {
    segment?: { name: string };
    genre?: { name: string };
  }[];
  priceRanges?: {
    min: number;
    max: number;
    currency: string;
  }[];
}

const mapCategory = (segment?: string, genre?: string): Category | null => {
  if (!segment) return null;
  if (segment === 'Music') return 'Music';
  if (genre === 'Comedy' || segment === 'Comedy') return 'Comedy';
  if (segment === 'Arts & Theatre') {
    if (genre && (genre.includes('Museum') || genre.includes('Exhibit') || genre.includes('Attraction') || genre.includes('Fine Art'))) {
      return null;
    }
    return 'Theater';
  }
  return null;
};

const getEventAvailability = (tmEvent: TMEvent): EventStatus => {
  const statusCode = tmEvent.dates?.status?.code?.toLowerCase();
  const eventDateStr = tmEvent.dates.start.dateTime || tmEvent.dates.start.localDate;
  const eventDate = eventDateStr ? new Date(eventDateStr) : new Date();
  const now = new Date();

  if (statusCode === 'canceled' || statusCode === 'cancelled') return 'CANCELED';
  if (statusCode === 'postponed') return 'POSTPONED';
  if (statusCode === 'rescheduled') return 'RESCHEDULED';
  if (statusCode === 'unavailable') return 'SOLD_OUT';

  const textData = [tmEvent.name, tmEvent.info, tmEvent.pleaseNote].filter(Boolean).join(' ').toLowerCase();
  const soldOutKeywords = ['sold out', 'soldout', 'complet', 'épuisé', 'epuise', 'tickets unavailable', 'allocation exhausted', 'no tickets available', 'tickets are currently not available'];

  if (soldOutKeywords.some((kw) => textData.includes(kw))) {
    return 'SOLD_OUT';
  }

  if (statusCode === 'offsale' && eventDate > now) {
    return 'SOLD_OUT';
  }

  return 'ON_SALE';
};

const findClosestImage = (images: TMImage[], targetWidth: number, preferredRatios: string[]) => {
  if (!images || images.length === 0) return null;
  const byRatio = images.filter((img) => preferredRatios.includes(img.ratio));
  const candidates = byRatio.length > 0 ? byRatio : images;
  return candidates.reduce((prev, curr) => (Math.abs(curr.width - targetWidth) < Math.abs(prev.width - targetWidth) ? curr : prev));
};

const getBestImage = (images: TMImage[]) => {
  const img = findClosestImage(images, 1024, ['16_9', '3_2']);
  return img?.url || 'https://picsum.photos/800/400';
};

const getPortraitImage = (images: TMImage[]) => {
  const img = findClosestImage(images, 800, ['3_4', '4_3', '1_1']);
  return img?.url || 'https://picsum.photos/800/800';
};

const fetchWithRetry = async (url: string, retries = 3, delay = 1000): Promise<Response> => {
  await waitForRateLimit();
  
  try {
    const res = await fetch(url);
    
    // Handle rate limiting (429)
    if (res.status === 429) {
      if (retries > 0) {
        console.log(`Rate limited, waiting ${delay}ms before retry...`);
        await new Promise((r) => setTimeout(r, delay));
        return fetchWithRetry(url, retries - 1, delay * 2); // Exponential backoff
      }
      throw new Error('Rate limit exceeded after retries');
    }
    
    return res;
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, delay));
      return fetchWithRetry(url, retries - 1, delay * 2);
    }
    throw err;
  }
};

interface SearchParams {
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  radiusKm: number;
}

const transformEvent = (e: TMEvent, location?: SearchParams): Event | null => {
  if (e.name.toLowerCase().includes('parking')) return null;

  const category = mapCategory(e.classifications?.[0]?.segment?.name, e.classifications?.[0]?.genre?.name);
  if (!category) return null;

  const venue = e._embedded?.venues?.[0];
  const city = venue?.city?.name || 'Unknown City';
  const country = venue?.country?.name;
  const artist = e._embedded?.attractions?.[0]?.name;
  const displayCity = !location && country ? `${city}, ${country}` : city;

  return {
    id: e.id,
    name: e.name,
    artistName: artist,
    category: category,
    venue: venue?.name || 'Unknown Venue',
    city: displayCity,
    date: e.dates.start.dateTime || e.dates.start.localDate,
    imageUrl: getBestImage(e.images),
    ticketUrl: e.url,
    featured: false,
    description: e.info || e.pleaseNote,
    location: venue?.location
      ? {
          lat: parseFloat(venue.location.latitude),
          lng: parseFloat(venue.location.longitude),
        }
      : undefined,
    availability: getEventAvailability(e),
  };
};

export const searchEvents = async (
  location?: SearchParams,
  keyword?: string,
  attractionId?: string,
  sortBy: 'date,asc' | 'relevance,desc' = 'date,asc',
  category?: Category,
  size: number = 50
): Promise<Event[]> => {
  // Build cache key
  const cacheKey = `events:${JSON.stringify({ location, keyword, attractionId, sortBy, category, size })}`;
  const cached = getFromCache<Event[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const params = new URLSearchParams({
      apikey: API_KEY,
      sort: sortBy,
      size: size.toString(),
      locale: '*',
    });

    if (location) {
      params.append('radius', location.radiusKm.toString());
      params.append('unit', 'km');
      if (location.latitude && location.longitude) {
        params.append('latlong', `${location.latitude},${location.longitude}`);
      } else if (location.city) {
        params.append('city', location.city);
      }
    }

    if (attractionId) {
      params.append('attractionId', attractionId);
    } else if (keyword) {
      params.append('keyword', keyword);
    }

    if (category) {
      if (category === 'Music') {
        params.append('segmentId', 'KZFzniwnSyZfZ7v7nJ');
      } else if (category === 'Comedy') {
        params.append('classificationId', 'KnvZfZ7vAe1');
      } else if (category === 'Theater') {
        params.append('segmentId', 'KZFzniwnSyZfZ7v7na');
      }
    }

    const res = await fetchWithRetry(`${BASE_URL}/events.json?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`TM API Error: ${res.status}`);
    }

    const data = await res.json();
    if (!data._embedded || !data._embedded.events) return [];

    const events = data._embedded.events.map((e: TMEvent) => transformEvent(e, location)).filter((e: any) => e !== null) as Event[];
    setCache(cacheKey, events);
    return events;
  } catch (error) {
    console.error('TM API Error:', error);
    return [];
  }
};

export const getEventById = async (id: string): Promise<Event | null> => {
  const cacheKey = `event:${id}`;
  const cached = getFromCache<Event | null>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  try {
    const params = new URLSearchParams({
      apikey: API_KEY,
      locale: '*',
    });
    const res = await fetchWithRetry(`${BASE_URL}/events/${id}.json?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch event');
    const data = await res.json();
    const event = transformEvent(data);
    if (event) setCache(cacheKey, event);
    return event;
  } catch (error) {
    console.error('Get Event Error', error);
    return null;
  }
};

export const searchAttractions = async (query: string): Promise<string[]> => {
  if (!query || query.length < 2) return [];
  
  const cacheKey = `attractions:${query.toLowerCase()}`;
  const cached = getFromCache<string[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const params = new URLSearchParams({
      apikey: API_KEY,
      keyword: query,
      size: '10',
      sort: 'relevance,desc',
      locale: '*',
    });

    const res = await fetchWithRetry(`${BASE_URL}/attractions.json?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch attractions');

    const data = await res.json();
    if (!data._embedded || !data._embedded.attractions) return [];

    const names: string[] = data._embedded.attractions.map((a: any) => a.name);
    const uniqueNames = Array.from(new Set(names));
    setCache(cacheKey, uniqueNames);
    return uniqueNames;
  } catch (error) {
    console.error('TM API Error:', error);
    return [];
  }
};

export const getArtistDetails = async (artistName: string) => {
  const cacheKey = `artist:${artistName.toLowerCase()}`;
  const cached = getFromCache<any>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const params = new URLSearchParams({
      apikey: API_KEY,
      keyword: artistName,
      size: '1',
      sort: 'relevance,desc',
      locale: '*',
    });

    const res = await fetchWithRetry(`${BASE_URL}/attractions.json?${params.toString()}`);
    if (!res.ok) throw new Error('API Failure');

    const data = await res.json();
    if (!data._embedded || !data._embedded.attractions || data._embedded.attractions.length === 0) {
      throw new Error('No artist found');
    }

    const artist = data._embedded.attractions[0];
    const result = {
      id: artist.id,
      name: artist.name,
      imageUrl: getPortraitImage(artist.images),
      bannerUrl: getBestImage(artist.images),
      externalLinks: artist.externalLinks,
    };
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('TM Artist Details Error, using mock fallback:', error);
    const fallback = {
      id: `mock-${Math.random()}`,
      name: artistName,
      imageUrl: `https://ui-avatars.com/api/?name=${artistName}&background=random&size=512`,
      bannerUrl: 'https://picsum.photos/800/400',
      externalLinks: {},
    };
    // Cache fallback for a shorter time (1 minute) to allow retry
    cache.set(cacheKey, { data: fallback, timestamp: Date.now() - CACHE_TTL + 60000 });
    return fallback;
  }
};
