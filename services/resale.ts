import { Event } from '../types';

export interface ResaleOption {
  source: 'SeatGeek' | 'StubHub' | 'Viagogo';
  displayName: string;
  url: string;
  lowestPrice?: number;
  listingCount?: number;
  currency?: string;
  logoColor?: string;
}

const SEATGEEK_CLIENT_ID = process.env.EXPO_PUBLIC_SEATGEEK_CLIENT_ID || '';

export const getResaleOptions = async (event: Event): Promise<ResaleOption[]> => {
  const options: ResaleOption[] = [];

  try {
    const query = `${event.artistName || event.name}`;
    const params = new URLSearchParams({
      client_id: SEATGEEK_CLIENT_ID,
      q: query,
      'venue.city': event.city.split(',')[0],
      'datetime_utc.gte': new Date(event.date).toISOString().split('T')[0],
      per_page: '1',
    });

    const res = await fetch(`https://api.seatgeek.com/2/events?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.events && data.events.length > 0) {
        const sgEvent = data.events[0];
        options.push({
          source: 'SeatGeek',
          displayName: 'SeatGeek',
          url: sgEvent.url,
          lowestPrice: sgEvent.stats?.lowest_price,
          listingCount: sgEvent.stats?.listing_count,
          currency: 'USD',
          logoColor: '#1673e6',
        });
      } else {
        options.push({
          source: 'SeatGeek',
          displayName: 'SeatGeek',
          url: `https://seatgeek.com/search?search=${encodeURIComponent(event.artistName || event.name)}`,
          logoColor: '#1673e6',
        });
      }
    }
  } catch (e) {
    options.push({
      source: 'SeatGeek',
      displayName: 'SeatGeek',
      url: `https://seatgeek.com/search?search=${encodeURIComponent(event.artistName || event.name)}`,
      logoColor: '#1673e6',
    });
  }

  options.push({
    source: 'StubHub',
    displayName: 'StubHub',
    url: `https://www.stubhub.com/secure/search?q=${encodeURIComponent(`${event.artistName || event.name} ${event.city.split(',')[0]}`)}`,
    logoColor: '#4b2e83',
  });

  options.push({
    source: 'Viagogo',
    displayName: 'viagogo',
    url: `https://www.viagogo.com/search?q=${encodeURIComponent(`${event.artistName || event.name} ${event.city.split(',')[0]}`)}`,
    logoColor: '#2b7f75',
  });

  return options;
};
