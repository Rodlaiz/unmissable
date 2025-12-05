import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
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
    const justAnnounced = [...filtered].reverse().slice(0, 5);
    const upcoming = filtered;

    return { thisWeekend, recommended, sellingFast, justAnnounced, upcoming };
  }, [allEvents, activeFilter, userCategories]);

  const handleEventPress = (eventId: string) => {
    router.push(`/event/${eventId}`);
  };

  const handleFavorite = (event: Event) => {
    if (!user || !event.artistName) return;
    const artistName = event.artistName;
    const isFavorited = user.favorites.includes(artistName);
    const newFavorites = isFavorited
      ? user.favorites.filter((f) => f !== artistName)
      : [...user.favorites, artistName];
    updateUser({ ...user, favorites: newFavorites });
  };

  const isEventFavorited = (event: Event): boolean => {
    if (!user || !event.artistName) return false;
    return user.favorites.includes(event.artistName);
  };

  const canFavorite = (event: Event): boolean => {
    return !!event.artistName;
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
        <View className="flex-row items-center justify-between h-14 px-4">
          <View className="w-12" />
          <Image source={require('../../assets/images/logo.png')} className="h-8 w-40" contentFit="contain" />
          <TouchableOpacity className="w-12 items-end">
            <Ionicons name="notifications-outline" size={22} color="#374151" />
          </TouchableOpacity>
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
            {renderSection(
              'Just Announced',
              <Ionicons name="flash" size={20} color="#eab308" />,
              buckets.justAnnounced
            )}
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
