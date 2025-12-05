export interface LocationResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
  country_code: string;
}

const GEO_API_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export const searchCities = async (query: string): Promise<LocationResult[]> => {
  if (!query || query.length < 2) return [];

  try {
    const params = new URLSearchParams({
      name: query,
      count: '5',
      language: 'en',
      format: 'json',
    });

    const res = await fetch(`${GEO_API_URL}?${params.toString()}`);
    if (!res.ok) throw new Error('Geocoding failed');

    const data = await res.json();
    if (!data.results) return [];

    return data.results.map((item: any) => ({
      id: item.id,
      name: item.name,
      latitude: item.latitude,
      longitude: item.longitude,
      country: item.country,
      admin1: item.admin1,
      country_code: item.country_code,
    }));
  } catch (error) {
    console.error('Location Search Error:', error);
    return [];
  }
};
