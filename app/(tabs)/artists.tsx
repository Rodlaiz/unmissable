import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { ArtistProfile, Event } from '../../types';
import { getArtistDetails, searchEvents, searchAttractions } from '../../services/ticketmaster';
import Card from '../../components/Card';
import { PRIMARY } from '../../constants/colors';
import { normalizeString, formatDateTime } from '../../utils/formatters';

const ArtistSkeleton = () => (
  <View className="bg-white rounded-2xl border border-gray-100 p-3 flex-row items-center gap-4 mb-3">
    <View className="w-16 h-16 rounded-full bg-gray-200" />
    <View className="flex-1 gap-2">
      <View className="h-4 bg-gray-200 rounded w-1/3" />
      <View className="h-3 bg-gray-200 rounded w-1/2" />
    </View>
    <View className="w-5 h-5 bg-gray-200 rounded-full" />
  </View>
);

export default function ArtistsScreen() {
  const router = useRouter();
  const { user, updateUser } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [apiSuggestions, setApiSuggestions] = useState<string[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [artistData, setArtistData] = useState<Record<string, ArtistProfile>>({});
  const fetchingRef = useRef<Set<string>>(new Set());

  const targetArtists = useMemo(
    () => (user?.favorites?.length ? user.favorites : ['Taylor Swift', 'Bad Bunny', 'The Weeknd']),
    [user?.favorites]
  );

  useEffect(() => {
    if (!user) return;

    const missing = targetArtists.filter((name) => !artistData[name]);
    if (missing.length === 0) return;

    const locationParams = {
      city: user.location.city,
      latitude: user.location.latitude,
      longitude: user.location.longitude,
      radiusKm: 500,
    };

    // Phase 1: Quickly fetch and display artist metadata (no events yet)
    const fetchArtistMetadata = async (name: string) => {
      if (fetchingRef.current.has(name)) return;
      fetchingRef.current.add(name);

      try {
        const meta = await getArtistDetails(name);
        if (!meta) return;

        // Immediately show artist with loading state for events
        const initialProfile: ArtistProfile = {
          id: meta.id,
          name: meta.name,
          image: meta.imageUrl || `https://ui-avatars.com/api/?name=${name}&background=random`,
          bannerUrl: meta.bannerUrl,
          genre: 'Music',
          nextEvent: null,
          status: 'none',
        };
        
        setArtistData((prev) => ({ ...prev, [name]: initialProfile }));

        // Phase 2: Fetch events in background (single request first)
        let events = await searchEvents(locationParams, undefined, meta.id);
        let status: 'local' | 'global' | 'none' = events.length > 0 ? 'local' : 'none';

        // Only do secondary searches if no local events found
        if (events.length === 0) {
          // Try global search only (skip the local name search to reduce API calls)
          const globalEvents = await searchEvents(undefined, undefined, meta.id);
          if (globalEvents.length > 0) {
            status = 'global';
            events = [globalEvents[0]];
          }
        }

        // Update with event data
        const updatedProfile: ArtistProfile = {
          ...initialProfile,
          genre: events[0]?.category || 'Music',
          nextEvent: events.length > 0 ? events[0] : null,
          status,
        };
        
        setArtistData((prev) => ({ ...prev, [name]: updatedProfile }));
      } catch (e) {
        console.error(`Error fetching ${name}`, e);
      } finally {
        fetchingRef.current.delete(name);
      }
    };

    // Fetch all missing artists (they'll batch naturally due to rate limiting in ticketmaster service)
    missing.forEach((name) => {
      fetchArtistMetadata(name);
    });
  }, [targetArtists, user]);

  // Banner Rotation
  const loadedArtists = Object.values(artistData) as ArtistProfile[];
  useEffect(() => {
    if (loadedArtists.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % loadedArtists.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [loadedArtists.length]);

  // API Search for Adding
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length > 2) {
        setIsSearchingApi(true);
        try {
          const results = await searchAttractions(searchQuery);
          const newResults = results.filter((name) => !user?.favorites?.includes(name));
          setApiSuggestions(newResults);
        } catch (e) {
          console.error(e);
        } finally {
          setIsSearchingApi(false);
        }
      } else {
        setApiSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, user?.favorites]);

  const handleAddArtist = (artistName: string) => {
    if (user && !user.favorites.includes(artistName)) {
      updateUser({
        ...user,
        favorites: [...user.favorites, artistName],
      });
      setSearchQuery('');
      setApiSuggestions([]);
    }
  };

  const handleArtistPress = (artistName: string) => {
    router.push(`/artist/${encodeURIComponent(artistName)}`);
  };

  const validLoadedArtists = loadedArtists.filter((a) => targetArtists.includes(a.name));
  const bannerArtist = validLoadedArtists[currentBannerIndex % validLoadedArtists.length] || validLoadedArtists[0];
  const showBanner = validLoadedArtists.length > 0 && searchQuery === '' && !!bannerArtist;

  const visibleArtists = targetArtists.filter((name) => name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <Text className="text-2xl font-bold text-gray-900 mb-4">My Artists</Text>

        {/* Banner */}
        {showBanner && bannerArtist && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handleArtistPress(bannerArtist.name)}
            className="relative h-64 w-full rounded-3xl overflow-hidden shadow-lg mb-6"
          >
            <Image
              source={bannerArtist.bannerUrl || bannerArtist.image}
              className="absolute inset-0 w-full h-full"
              contentFit="cover"
              transition={300}
            />
            <View className="absolute inset-0 bg-black/40" />
            <View className="absolute bottom-0 left-0 right-0 p-6">
              <Text className="text-3xl font-bold text-white mb-1">{bannerArtist.name}</Text>
              <View className="flex-row items-center gap-1.5">
                {bannerArtist.status === 'local' ? (
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name="location" size={16} color="#86efac" />
                    <Text className="text-green-300 font-medium text-sm">Playing Nearby</Text>
                  </View>
                ) : bannerArtist.status === 'global' ? (
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name="calendar" size={16} color="#93c5fd" />
                    <Text className="text-blue-300 font-medium text-sm">On Tour</Text>
                  </View>
                ) : (
                  <Text className="text-gray-200 text-sm">{bannerArtist.genre}</Text>
                )}
              </View>
            </View>
            {validLoadedArtists.length > 1 && (
              <View className="absolute top-4 right-4 flex-row gap-1.5 bg-black/20 px-2 py-1.5 rounded-full">
                {validLoadedArtists.map((_, idx) => (
                  <View
                    key={idx}
                    className={`h-1.5 rounded-full ${
                      idx === currentBannerIndex % validLoadedArtists.length ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                    }`}
                  />
                ))}
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Search */}
        <View className="flex-row items-center bg-white rounded-xl px-3 py-2.5 mb-4 border border-gray-100">
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            placeholder="Search artists or add new..."
            placeholderTextColor="#9ca3af"
            className="flex-1 ml-2 text-base text-gray-900"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Add New Section */}
        {searchQuery.length > 2 && (
          <View className="mb-6">
            <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 mb-3">Add New Artist</Text>
            {isSearchingApi ? (
              <View className="p-4 items-center">
                <ActivityIndicator size="small" color={PRIMARY} />
              </View>
            ) : apiSuggestions.length > 0 ? (
              apiSuggestions.map((name) => (
                <TouchableOpacity
                  key={name}
                  onPress={() => handleAddArtist(name)}
                  className="flex-row items-center justify-between p-3 bg-white rounded-xl border border-dashed border-gray-300 mb-2"
                >
                  <Text className="font-medium text-gray-700">{name}</Text>
                  <View className="bg-gray-100 p-1.5 rounded-full">
                    <Ionicons name="add" size={16} color="#6b7280" />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text className="text-sm text-gray-400 px-1">No new artists found matching "{searchQuery}"</Text>
            )}
          </View>
        )}

        {/* Artist List */}
        {visibleArtists.length === 0 && searchQuery !== '' && apiSuggestions.length === 0 && !isSearchingApi && (
          <View className="py-10">
            <Text className="text-center text-gray-400">No artists found.</Text>
          </View>
        )}

        {visibleArtists.map((name) => {
          const artist = artistData[name];

          if (!artist) {
            return <ArtistSkeleton key={name} />;
          }

          return (
            <Card key={name} noPadding onPress={() => handleArtistPress(artist.name)} className="mb-3">
              <View className="flex-row items-center p-3 gap-4">
                <Image
                  source={artist.image}
                  className="w-16 h-16 rounded-full bg-gray-100 border border-gray-100"
                  contentFit="cover"
                  transition={200}
                />
                <View className="flex-1 min-w-0">
                  <View className="flex-row justify-between items-start">
                    <Text className="font-semibold text-gray-900" numberOfLines={1}>
                      {artist.name}
                    </Text>
                    {artist.status !== 'none' && (
                      <View
                        className={`px-2 py-0.5 rounded-full ${
                          artist.status === 'local' ? 'bg-green-100' : 'bg-blue-100'
                        }`}
                      >
                        <Text
                          className={`text-[10px] font-bold uppercase tracking-wide ${
                            artist.status === 'local' ? 'text-green-700' : 'text-blue-700'
                          }`}
                        >
                          {artist.status === 'local' ? 'Nearby' : 'Touring'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={1}>
                    {artist.status === 'none'
                      ? 'No upcoming shows'
                      : artist.nextEvent
                      ? `${formatDateTime(artist.nextEvent.date)} in ${artist.nextEvent.city}`
                      : artist.genre}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </View>
            </Card>
          );
        })}

        {/* Empty State */}
        {targetArtists.length === 0 && (
          <View className="items-center justify-center py-12 px-4">
            <View className="bg-gray-100 p-4 rounded-full mb-4">
              <Ionicons name="disc" size={32} color="#9ca3af" />
            </View>
            <Text className="text-lg font-bold text-gray-900 mb-2">No Artists Tracked</Text>
            <Text className="text-gray-500 text-center max-w-xs mb-6">Add artists to see them here.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
