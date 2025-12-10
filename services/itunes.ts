interface Album {
  id: string;
  title: string;
  year: string;
  thumbnail: string;
}

export const getArtistDiscography = async (artistName: string): Promise<Album[]> => {
  if (!artistName) return [];

  try {
    const params = new URLSearchParams({
      term: artistName,
      media: 'music',
      entity: 'album',
      limit: '200',
    });

    const res = await fetch(`https://itunes.apple.com/search?${params.toString()}`);
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.results) return [];

    const uniqueAlbums = new Map<string, Album>();
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetArtistNorm = normalize(artistName);

    data.results.forEach((item: any) => {
      const itemArtistNorm = normalize(item.artistName);
      if (!itemArtistNorm.includes(targetArtistNorm)) return;

      let cleanTitle = item.collectionName;
      cleanTitle = cleanTitle
        .replace(/\s*[\(\[][^\)\]]*(deluxe|edition|expanded|tour|remaster|bonus|live|version|anniversary|fan|special)[^\)\]]*[\)\]]/gi, '')
        .trim();

      const key = cleanTitle.toLowerCase();
      const highResUrl = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '400x400bb') : item.artworkUrl100;
      const year = item.releaseDate ? item.releaseDate.substring(0, 4) : 'Unknown';

      if (!uniqueAlbums.has(key)) {
        uniqueAlbums.set(key, {
          id: item.collectionId.toString(),
          title: cleanTitle,
          year: year,
          thumbnail: highResUrl,
        });
      }
    });

    return Array.from(uniqueAlbums.values()).sort((a, b) => {
      const yearA = parseInt(a.year) || 0;
      const yearB = parseInt(b.year) || 0;
      return yearB - yearA;
    });
  } catch (error) {
    console.error('iTunes Discography Fetch Error:', error);
    return [];
  }
};
