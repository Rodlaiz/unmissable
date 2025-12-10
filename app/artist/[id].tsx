import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { useFavorites } from '../../hooks/useFavorites';
import { Event } from '../../types';
import { getArtistDetails, searchEvents } from '../../services/ticketmaster';
import { getArtistBio } from '../../services/wikipedia';
import { getArtistDiscography } from '../../services/itunes';
import { trackTicketIntent } from '../../services/supabase';
import Button from '../../components/Button';
import { PRIMARY } from '../../constants/colors';
import { normalizeString, getDateParts } from '../../utils/formatters';
import { buildExtendedLocationParams } from '../../utils/location';

interface ArtistFullProfile {
  id: string;
  name: string;
  imageUrl: string;
  bannerUrl?: string;
  bio?: string;
  externalLinks?: Record<string, { url: string }[]>;
}

interface Album {
  id: string;
  title: string;
  year: string;
  thumbnail: string;
}

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const artistName = decodeURIComponent(id || '');
  const router = useRouter();
  const { user, authUser } = useUser();
  const { isFavorited, toggleFavorite } = useFavorites();

  const [profile, setProfile] = useState<ArtistFullProfile | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [localEvents, setLocalEvents] = useState<Event[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [isValidArtist, setIsValidArtist] = useState(false);

  // Derive isFollowing directly from useFavorites hook
  const isFollowing = isFavorited(artistName);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const fetchData = async () => {
      try {
        const meta = await getArtistDetails(artistName);

        if (meta && isMounted) {
          // Check if this is a real Ticketmaster artist (not a mock fallback)
          const isReal = !meta.id.startsWith('mock-');
          setIsValidArtist(isReal);

          const wikiBio = await getArtistBio(meta.name);
          const fallbackBio = `Get ready to see ${meta.name} live! Explore upcoming events, tickets, and tour dates near you on Unmissable.`;

          setProfile({
            id: meta.id,
            name: meta.name,
            imageUrl: meta.imageUrl,
            bannerUrl: meta.bannerUrl,
            externalLinks: meta.externalLinks,
            bio: wikiBio || fallbackBio,
          });

          const locParams = user ? buildExtendedLocationParams(user, 500) : undefined;

          const [localData, globalData, discographyData] = await Promise.all([
            // Local Events
            (async () => {
              if (!locParams) return [];
              let local = await searchEvents(locParams, undefined, meta.id, 'date,asc');
              if (local.length === 0) {
                const localByName = await searchEvents(locParams, meta.name, undefined, 'date,asc');
                local = localByName.filter((e) => {
                  const normName = normalizeString(e.name);
                  const normArtist = e.artistName ? normalizeString(e.artistName) : '';
                  const normTarget = normalizeString(meta.name);
                  return normName.includes(normTarget) || normArtist.includes(normTarget);
                });
              }
              return local;
            })(),

            // Global Events
            searchEvents(undefined, undefined, meta.id, 'date,asc'),

            // Discography
            getArtistDiscography(meta.name),
          ]);

          if (isMounted) {
            setLocalEvents(localData);
            const localIds = new Set(localData.map((e) => e.id));
            const filteredGlobal = globalData.filter((e) => !localIds.has(e.id));
            setEvents(filteredGlobal);
            setAlbums(discographyData);
          }
        }
      } catch (e) {
        console.error('Failed to fetch artist details', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [artistName, user?.location]);

  const toggleFollow = () => {
    if (!profile || !isValidArtist) {
      toggleFavorite(artistName);
    } else {
      toggleFavorite(artistName, { artistId: profile.id });
    }
  };

  const handleEventPress = async (event: Event) => {
    // For sold out events, go to event detail to show resale options
    if (event.availability === 'SOLD_OUT') {
      router.push(`/event/${event.id}?fromArtist=true`);
      return;
    }
    // For canceled events, do nothing
    if (event.availability === 'CANCELED') {
      return;
    }
    // For available events, open ticket URL directly
    if (event.ticketUrl) {
      // Track ticket intent in Supabase
      if (authUser && !user?.isGuest) {
        trackTicketIntent(authUser.id, event.id, event.name, event.ticketUrl).catch((err) => {
          console.error('Failed to track ticket intent:', err);
        });
      }
      await WebBrowser.openBrowserAsync(event.ticketUrl);
    }
  };

  const openLink = async (url?: string) => {
    if (url) await WebBrowser.openBrowserAsync(url);
  };

  const renderEventRow = (event: Event, isLocal = false) => {
    const { month, day, year } = getDateParts(event.date);
    const currentYear = new Date().getFullYear();
    const showYear = year > currentYear;
    const isSoldOut = event.availability === 'SOLD_OUT';
    const isCanceled = event.availability === 'CANCELED';

    return (
      <TouchableOpacity
        key={event.id}
        onPress={() => handleEventPress(event)}
        className={`bg-white rounded-2xl p-4 flex-row items-center justify-between mb-3 border ${
          isLocal ? 'border-green-200' : 'border-gray-100'
        }`}
      >
        <View className="flex-row items-center gap-4 flex-1 min-w-0">
          <View
            className={`items-center justify-center rounded-xl w-14 h-14 ${isLocal ? 'bg-green-100' : 'bg-gray-50'}`}
          >
            <Text className={`text-[10px] font-bold tracking-wider ${isLocal ? 'text-green-700' : 'text-primary-600'}`}>
              {month}
            </Text>
            <Text className="text-xl font-bold text-gray-900 leading-none">{day}</Text>
          </View>
          <View className="flex-1 min-w-0">
            <Text
              className={`font-bold text-gray-900 ${isCanceled ? 'line-through text-gray-400' : ''}`}
              numberOfLines={1}
            >
              {event.venue}
            </Text>
            <View className="flex-row items-center">
              <Text className="text-sm text-gray-500" numberOfLines={1}>
                {event.city}
              </Text>
              {showYear && (
                <View className="ml-2 bg-gray-100 px-1.5 py-0.5 rounded">
                  <Text className="text-[10px] font-medium text-gray-600">{year}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {isCanceled ? (
          <View className="px-3 py-1 bg-gray-100 rounded-full">
            <Text className="font-bold text-xs text-gray-500 uppercase">Canceled</Text>
          </View>
        ) : isSoldOut ? (
          <View className="flex-row items-center px-3 py-1.5 bg-orange-50 rounded-full border border-orange-200">
            <Text className="font-bold text-xs text-orange-700 uppercase">Find Resale</Text>
            <Ionicons name="chevron-forward" size={14} color="#c2410c" />
          </View>
        ) : (
          <View className={`px-4 py-2 rounded-full ${isLocal ? 'bg-green-600' : 'bg-primary-50'}`}>
            <Text className={`font-semibold text-xs ${isLocal ? 'text-white' : 'text-primary-700'}`}>Tickets</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text className="text-gray-500 mt-4">Loading artist...</Text>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500">Artist not found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-primary-600 font-semibold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const links = profile.externalLinks || {};
  const bioText = profile.bio || '';
  const isBioLong = bioText.length > 300;
  const displayBio = isBioExpanded ? bioText : isBioLong ? bioText.slice(0, 300) + '...' : bioText;

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero Image */}
        <View className="relative w-full h-96">
          <Image source={profile.imageUrl} className="w-full h-full" contentFit="cover" transition={300} />
          <View className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />

          {/* Back Button */}
          <SafeAreaView className="absolute top-0 left-0 right-0">
            <TouchableOpacity
              onPress={() => router.back()}
              className="m-4 p-2 bg-black/40 rounded-full w-10"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
            >
              <Ionicons name="chevron-back" size={24} color="white" />
            </TouchableOpacity>
          </SafeAreaView>

          <View className="absolute bottom-6 left-6 right-6">
            <Text className="text-4xl font-bold text-white mb-2">{profile.name}</Text>
          </View>
        </View>

        <View className="px-5 -mt-6 z-10">
          {/* Follow/Unfollow Button - only show for valid Ticketmaster artists */}
          {isValidArtist && (
            <View className="mb-6">
              {isFollowing ? (
                <Button 
                  variant="secondary" 
                  fullWidth 
                  onPress={toggleFollow}
                  icon={<Ionicons name="checkmark" size={16} color="#374151" />}
                >
                  Following
                </Button>
              ) : (
                <Button 
                  fullWidth 
                  onPress={toggleFollow}
                  icon={<Ionicons name="add" size={16} color="white" />}
                >
                  Follow
                </Button>
              )}
            </View>
          )}

          {/* Bio */}
          <View className="mb-8">
            <Text className="text-gray-600 leading-relaxed text-sm">{displayBio}</Text>
            {isBioLong && (
              <TouchableOpacity onPress={() => setIsBioExpanded(!isBioExpanded)} className="mt-2">
                <Text className="text-primary-600 font-semibold text-sm">
                  {isBioExpanded ? 'Read Less' : 'Read More'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Discography */}
          {albums.length > 0 && (
            <View className="mb-8">
              <View className="flex-row items-center gap-2 mb-4">
                <Ionicons name="disc" size={20} color="#1f2937" />
                <Text className="text-lg font-bold text-gray-900">Discography</Text>
              </View>

              <FlatList
                horizontal
                data={albums}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View className="w-32 mr-4">
                    <View className="w-32 h-32 rounded-lg overflow-hidden bg-gray-100 mb-2">
                      <Image source={item.thumbnail} className="w-full h-full" contentFit="cover" transition={200} />
                    </View>
                    <Text className="font-semibold text-sm text-gray-900" numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text className="text-xs text-gray-500">{item.year}</Text>
                  </View>
                )}
              />
            </View>
          )}

          {/* Near You Section */}
          {localEvents.length > 0 && (
            <View className="mb-8">
              <View className="flex-row items-center gap-2 mb-3 bg-green-50 px-3 py-1 rounded-full self-start border border-green-100">
                <Ionicons name="location" size={16} color="#15803d" />
                <Text className="text-sm font-bold text-green-700">Near You</Text>
              </View>
              <View className="bg-green-50/30 p-3 rounded-3xl border border-green-100/50">
                {localEvents.map((event) => renderEventRow(event, true))}
              </View>
            </View>
          )}

          {/* Upcoming Shows */}
          <View className="mb-8">
            <Text className="text-lg font-bold text-gray-900 mb-4">Upcoming Shows</Text>
            {events.length === 0 ? (
              <View className="p-6 bg-white rounded-2xl items-center border border-gray-100">
                <Text className="text-gray-400">No other upcoming shows found.</Text>
              </View>
            ) : (
              <View>{events.slice(0, 5).map((event) => renderEventRow(event))}</View>
            )}
          </View>

          {/* Listen & Follow */}
          <View>
            <Text className="text-lg font-bold text-gray-900 mb-4">Listen & Follow</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-4">
                {links.homepage?.[0]?.url && (
                  <TouchableOpacity
                    onPress={() => openLink(links.homepage?.[0]?.url)}
                    className="w-14 h-14 bg-gray-100 rounded-full items-center justify-center"
                  >
                    <Ionicons name="globe" size={24} color="#4b5563" />
                  </TouchableOpacity>
                )}
                {links.twitter?.[0]?.url && (
                  <TouchableOpacity
                    onPress={() => openLink(links.twitter?.[0]?.url)}
                    className="w-14 h-14 bg-blue-50 rounded-full items-center justify-center"
                  >
                    <Ionicons name="logo-twitter" size={24} color="#1d9bf0" />
                  </TouchableOpacity>
                )}
                {links.instagram?.[0]?.url && (
                  <TouchableOpacity
                    onPress={() => openLink(links.instagram?.[0]?.url)}
                    className="w-14 h-14 bg-pink-50 rounded-full items-center justify-center"
                  >
                    <Ionicons name="logo-instagram" size={24} color="#e4405f" />
                  </TouchableOpacity>
                )}
                {links.facebook?.[0]?.url && (
                  <TouchableOpacity
                    onPress={() => openLink(links.facebook?.[0]?.url)}
                    className="w-14 h-14 bg-blue-50 rounded-full items-center justify-center"
                  >
                    <Ionicons name="logo-facebook" size={24} color="#1877f2" />
                  </TouchableOpacity>
                )}
                {links.youtube?.[0]?.url && (
                  <TouchableOpacity
                    onPress={() => openLink(links.youtube?.[0]?.url)}
                    className="w-14 h-14 bg-red-50 rounded-full items-center justify-center"
                  >
                    <Ionicons name="logo-youtube" size={24} color="#ff0000" />
                  </TouchableOpacity>
                )}
                {links.spotify?.[0]?.url && (
                  <TouchableOpacity
                    onPress={() => openLink(links.spotify?.[0]?.url)}
                    className="w-14 h-14 bg-green-50 rounded-full items-center justify-center"
                  >
                    <Ionicons name="musical-notes" size={24} color="#1db954" />
                  </TouchableOpacity>
                )}
                {Object.keys(links).length === 0 && (
                  <Text className="text-gray-400 text-sm italic">No social links available.</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
