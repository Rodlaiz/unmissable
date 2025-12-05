export const getArtistBio = async (artistName: string): Promise<string | null> => {
  if (!artistName) return null;

  try {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      prop: 'extracts',
      exintro: 'true',
      explaintext: 'true',
      redirects: '1',
      titles: artistName,
      origin: '*',
    });

    const response = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`);
    
    // Check if response is OK and is JSON
    if (!response.ok) return null;
    
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) return null;
    
    const data = await response.json();

    const pages = data?.query?.pages;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];
    if (pageId === '-1') return null;

    const extract = pages[pageId].extract;
    if (!extract || extract.length < 20 || extract.includes('may refer to:')) return null;

    return extract;
  } catch (error) {
    console.error('Wiki Bio Fetch Error:', error);
    return null;
  }
};
