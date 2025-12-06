// Patterns that indicate a Wikipedia disambiguation page
const DISAMBIGUATION_PATTERNS = [
  'may refer to:',
  'most commonly refers to:',
  'can refer to:',
  'could refer to:',
  'might refer to:',
  'commonly refers to:',
  'is a disambiguation page',
  'may also refer to:',
];

// Check if text looks like a disambiguation page
const isDisambiguation = (text: string): boolean => {
  const lowerText = text.toLowerCase();
  return DISAMBIGUATION_PATTERNS.some(pattern => lowerText.includes(pattern));
};

// Fetch bio for a specific Wikipedia title
const fetchWikiBio = async (title: string): Promise<string | null> => {
  try {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      prop: 'extracts',
      exintro: 'true',
      explaintext: 'true',
      redirects: '1',
      titles: title,
      origin: '*',
    });

    const response = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`);
    
    if (!response.ok) return null;
    
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) return null;
    
    const data = await response.json();

    const pages = data?.query?.pages;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];
    if (pageId === '-1') return null;

    const extract = pages[pageId].extract;
    if (!extract || extract.length < 20) return null;

    // Check if this is a disambiguation page
    if (isDisambiguation(extract)) return null;

    return extract;
  } catch (error) {
    console.error('Wiki Bio Fetch Error:', error);
    return null;
  }
};

export const getArtistBio = async (artistName: string): Promise<string | null> => {
  if (!artistName) return null;

  // First, try the exact artist name
  let bio = await fetchWikiBio(artistName);
  if (bio) return bio;

  // If that failed or was a disambiguation page, try with "(band)" suffix
  bio = await fetchWikiBio(`${artistName} (band)`);
  if (bio) return bio;

  // Try with "(musician)" suffix
  bio = await fetchWikiBio(`${artistName} (musician)`);
  if (bio) return bio;

  // Try with "(singer)" suffix
  bio = await fetchWikiBio(`${artistName} (singer)`);
  if (bio) return bio;

  // Try with "(musical)" suffix for theater/Broadway shows
  bio = await fetchWikiBio(`${artistName} (musical)`);
  if (bio) return bio;

  // Try with "(comedian)" suffix
  bio = await fetchWikiBio(`${artistName} (comedian)`);
  if (bio) return bio;

  return null;
};
