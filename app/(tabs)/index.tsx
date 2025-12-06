import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { Event, Category } from '../../types';
import { searchEvents } from '../../services/ticketmaster';
import { EventCard } from '../../components/EventCard';
import { PRIMARY, PRIMARY_LIGHT } from '../../constants/colors';
import { formatDateTime } from '../../utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FilterType = 'All' | Category;

// Stable seeded random for "selling fast" section
const seededShuffle = <T,>(array: T[], seed: number): T[] => {
  const result = [...array];
  let currentSeed = seed;
  for (let i = result.length - 1; i > 0; i--) {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const j = Math.floor((currentSeed / 233280) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export default function HomeScreen() {
  const router = useRouter();
  const { user, updateUser } = useUser();
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const bannerScrollRef = useRef<FlatList>(null);

  // Memoize location to prevent unnecessary re-fetches when only favorites change
  const userLocation = user?.location;

  const fetchFeedData = useCallback(async () => {
    if (!userLocation) return;

    try {
      const locationParams = {
        city: userLocation.city,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        radiusKm: userLocation.radiusKm,
      };

      let rawEvents: Event[] = [];

      if (activeFilter === 'All') {
        const [music, comedy, theater] = await Promise.all([
          searchEvents(locationParams, searchQuery, undefined, 'date,asc', 'Music', 12),
          searchEvents(locationParams, searchQuery, undefined, 'date,asc', 'Comedy', 12),
          searchEvents(locationParams, searchQuery, undefined, 'date,asc', 'Theater', 12),
        ]);
        rawEvents = [...music, ...comedy, ...theater];
        rawEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      } else {
        rawEvents = await searchEvents(locationParams, searchQuery, undefined, 'date,asc', activeFilter, 40);
      }

      // Deduplicate by name
      const uniqueEvents: Event[] = [];
      const seenNames = new Set<string>();

      rawEvents.forEach((e) => {
        const normalizedName = e.name.trim().toLowerCase();
        if (!seenNames.has(normalizedName)) {
          seenNames.add(normalizedName);
          uniqueEvents.push(e);
        }
      });

      setAllEvents(uniqueEvents);
    } catch (e) {
      console.error('Failed to load feed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userLocation, activeFilter, searchQuery]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(fetchFeedData, 500);
    return () => clearTimeout(timer);
  }, [fetchFeedData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeedData();
  };

  // Memoize categories to prevent unnecessary re-renders when only favorites change
  const userCategories = user?.categories;

  const buckets = useMemo(() => {
    if (!userCategories) return { thisWeekend: [], recommended: [], sellingFast: [], justAnnounced: [], upcoming: [] };

    const filtered = activeFilter === 'All' ? allEvents : allEvents.filter((e) => e.category === activeFilter);

    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    const thisWeekend = filtered.filter((e) => {
      const d = new Date(e.date);
      return d >= now && d <= sevenDaysFromNow;
    });

    const recommended = filtered.filter((e) => userCategories.includes(e.category));
    // Use seeded shuffle based on date for stable "random" order
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const sellingFast = seededShuffle(filtered, seed).slice(0, 5);
    const justAnnounced = [...filtered].reverse().slice(0, 8);
    const upcoming = filtered;

    return { thisWeekend, recommended, sellingFast, justAnnounced, upcoming };
  }, [allEvents, activeFilter, userCategories]);

  // Auto-scroll banner carousel
  useEffect(() => {
    if (buckets.justAnnounced.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => {
        const nextIndex = (prev + 1) % buckets.justAnnounced.length;
        bannerScrollRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        return nextIndex;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [buckets.justAnnounced.length]);

  const handleEventPress = (eventId: string) => {
    router.push(`/event/${eventId}`);
  };

  const handleFavorite = (event: Event) => {
    if (!user || !event.artistName) return;
    const artistName = event.artistName;
    const isFavorited = user.favorites.includes(artistName);
    
    let newFavorites: string[];
    if (isFavorited) {
      newFavorites = user.favorites.filter((f) => f !== artistName);
    } else {
      // Prevent duplicates by checking again before adding
      if (!user.favorites.includes(artistName)) {
        newFavorites = [...user.favorites, artistName];
      } else {
        return; // Already favorited, do nothing
      }
    }
    updateUser({ ...user, favorites: newFavorites });
  };

  const isEventFavorited = (event: Event): boolean => {
    if (!user || !event.artistName) return false;
    return user.favorites.includes(event.artistName);
  };

  const canFavorite = (event: Event): boolean => {
    return !!event.artistName;
  };

  const BANNER_WIDTH = SCREEN_WIDTH - 32; // Full width minus padding

  const renderFeaturedCarousel = () => {
    if (buckets.justAnnounced.length === 0) return null;

    return (
      <View className="py-2">
        <View className="px-5 flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <Ionicons name="flash" size={20} color="#eab308" />
            <Text className="text-lg font-bold text-gray-900 tracking-tight">Just Announced</Text>
          </View>
        </View>
        <FlatList
          ref={bannerScrollRef}
          horizontal
          data={buckets.justAnnounced}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          snapToInterval={BANNER_WIDTH + 12}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: 16 }}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / (BANNER_WIDTH + 12));
            setCurrentBannerIndex(index);
          }}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handleEventPress(item.id)}
              style={{ width: BANNER_WIDTH, marginRight: 12 }}
              className="relative h-52 rounded-2xl overflow-hidden shadow-lg"
            >
              <Image
                source={item.imageUrl || 'https://via.placeholder.com/400x200'}
                className="absolute inset-0 w-full h-full"
                contentFit="cover"
                transition={300}
              />
              <View className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <View className="absolute bottom-0 left-0 right-0 p-4">
                <Text className="text-xl font-bold text-white mb-1" numberOfLines={2}>
                  {item.artistName || item.name}
                </Text>
                <View className="flex-row items-center gap-2">
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="calendar-outline" size={14} color="#d1d5db" />
                    <Text className="text-gray-300 text-sm">{formatDateTime(item.date)}</Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-1 mt-1">
                  <Ionicons name="location-outline" size={14} color="#d1d5db" />
                  <Text className="text-gray-300 text-sm" numberOfLines={1}>{item.venue}</Text>
                </View>
              </View>
              {/* Favorite button */}
              {canFavorite(item) && (
                <TouchableOpacity
                  onPress={() => handleFavorite(item)}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/30 items-center justify-center"
                >
                  <Ionicons
                    name={isEventFavorited(item) ? 'heart' : 'heart-outline'}
                    size={20}
                    color={isEventFavorited(item) ? '#ef4444' : 'white'}
                  />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
          getItemLayout={(_, index) => ({ length: BANNER_WIDTH + 12, offset: (BANNER_WIDTH + 12) * index, index })}
        />
        {/* Pagination dots */}
        {buckets.justAnnounced.length > 1 && (
          <View className="flex-row justify-center gap-1.5 mt-3">
            {buckets.justAnnounced.map((_, idx) => (
              <View
                key={idx}
                className={`h-1.5 rounded-full ${
                  idx === currentBannerIndex ? 'w-4 bg-primary-600' : 'w-1.5 bg-gray-300'
                }`}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderSection = (title: string, icon: React.ReactNode, events: Event[]) => {
    if (events.length === 0) return null;

    return (
      <View className="py-2">
        <View className="px-5 flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            {icon}
            <Text className="text-lg font-bold text-gray-900 tracking-tight">{title}</Text>
          </View>
          {events.length > 3 && (
            <TouchableOpacity>
              <Text className="text-xs font-semibold text-primary-600">See All</Text>
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          horizontal
          data={events}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 20, paddingRight: 4 }}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              layout="horizontal"
              onPress={() => handleEventPress(item.id)}
              onFavorite={canFavorite(item) ? () => handleFavorite(item) : undefined}
              isFavorited={isEventFavorited(item)}
            />
          )}
          getItemLayout={(_, index) => ({ length: 296, offset: 296 * index, index })} // 280px width + 16px margin
          initialNumToRender={3}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={true}
        />
      </View>
    );
  };

  const filters: FilterType[] = ['All', 'Music', 'Comedy', 'Theater'];

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="bg-white border-b border-gray-100 shadow-sm">
        <View className="flex-row items-center justify-center h-14 px-4">
          <Image source={require('../../assets/images/logo.png')} className="h-8 w-40" contentFit="contain" />
        </View>

        {/* Search */}
        <View className="px-4 pb-2">
          <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2.5">
            <Ionicons name="search" size={20} color="#9ca3af" />
            <TextInput
              placeholder="Search artists, venues..."
              placeholderTextColor="#9ca3af"
              className="flex-1 ml-2 text-base text-gray-900"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 pb-3" contentContainerStyle={{ gap: 8 }}>
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter}
              onPress={() => setActiveFilter(filter)}
              className={`px-5 py-2 rounded-full ${
                activeFilter === filter ? 'bg-primary-600 shadow-md' : 'bg-white border border-gray-200'
              }`}
            >
              <Text className={`text-sm font-semibold ${activeFilter === filter ? 'text-white' : 'text-gray-600'}`}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text className="text-gray-400 text-sm mt-4">Curating your feed...</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
          showsVerticalScrollIndicator={false}
        >
          <View className="pt-4 pb-8">
            {/* Featured Carousel for Just Announced */}
            {renderFeaturedCarousel()}
            {renderSection(
              'This Weekend',
              <Ionicons name="calendar" size={20} color={PRIMARY} />,
              buckets.thisWeekend
            )}
            {renderSection(
              'Selling Fast',
              <Ionicons name="ticket" size={20} color="#f97316" />,
              buckets.sellingFast
            )}
            {renderSection(
              'Recommended for You',
              <Ionicons name="star" size={20} color={PRIMARY_LIGHT} />,
              buckets.recommended
            )}

            {/* Upcoming Near You - Vertical List */}
            {buckets.upcoming.length > 0 && (
              <View className="px-4 mt-4">
                <View className="flex-row items-center gap-2 mb-4">
                  <Ionicons name="location" size={20} color="#16a34a" />
                  <Text className="text-lg font-bold text-gray-900">Upcoming Near You</Text>
                </View>
                {buckets.upcoming.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    layout="vertical"
                    onPress={() => handleEventPress(event.id)}
                    onFavorite={canFavorite(event) ? () => handleFavorite(event) : undefined}
                    isFavorited={isEventFavorited(event)}
                  />
                ))}
              </View>
            )}

            {buckets.upcoming.length === 0 && (
              <View className="py-20 px-6">
                <Text className="text-center text-gray-400">
                  No events found for "{activeFilter}" in this area.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
