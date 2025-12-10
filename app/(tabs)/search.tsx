import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { searchAttractions, searchEvents } from '../../services/ticketmaster';
import { useUser } from '../../context/UserContext';
import { Event } from '../../types';
import { PRIMARY } from '../../constants/colors';
import { buildLocationParams } from '../../utils/location';

export default function SearchScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [query, setQuery] = useState('');
  const [artistResults, setArtistResults] = useState<string[]>([]);
  const [eventResults, setEventResults] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'artists' | 'events'>('artists');

  useEffect(() => {
    if (query.length < 2) {
      setArtistResults([]);
      setEventResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (activeTab === 'artists') {
          const results = await searchAttractions(query);
          setArtistResults(results);
        } else {
          const locationParams = user ? buildLocationParams(user) : undefined;
          const results = await searchEvents(locationParams, query, undefined, 'relevance,desc', undefined, 20);
          setEventResults(results);
        }
      } catch (e) {
        console.error('Search error', e);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, activeTab, user]);

  const handleArtistPress = (artistName: string) => {
    router.push(`/artist/${encodeURIComponent(artistName)}`);
  };

  const handleEventPress = (eventId: string) => {
    router.push(`/event/${eventId}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <View className="bg-white border-b border-gray-100 pb-3">
        <View className="px-4 pt-4 pb-3">
          <Text className="text-2xl font-bold text-gray-900">Search</Text>
        </View>

        {/* Search Input */}
        <View className="px-4 pb-3">
          <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2.5">
            <Ionicons name="search" size={20} color="#9ca3af" />
            <TextInput
              placeholder="Search artists, events, venues..."
              placeholderTextColor="#9ca3af"
              className="flex-1 ml-2 text-base text-gray-900"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={20} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row px-4">
          <TouchableOpacity
            onPress={() => setActiveTab('artists')}
            className={`flex-1 py-2.5 items-center border-b-2 ${
              activeTab === 'artists' ? 'border-primary-600' : 'border-transparent'
            }`}
          >
            <Text className={`font-semibold ${activeTab === 'artists' ? 'text-primary-600' : 'text-gray-500'}`}>
              Artists
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('events')}
            className={`flex-1 py-2.5 items-center border-b-2 ${
              activeTab === 'events' ? 'border-primary-600' : 'border-transparent'
            }`}
          >
            <Text className={`font-semibold ${activeTab === 'events' ? 'text-primary-600' : 'text-gray-500'}`}>
              Events
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Results */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : query.length < 2 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="search-outline" size={64} color="#d1d5db" />
          <Text className="text-gray-400 text-center mt-4">Start typing to search for artists or events</Text>
        </View>
      ) : activeTab === 'artists' ? (
        <FlatList
          data={artistResults}
          keyExtractor={(item) => item}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View className="items-center py-8">
              <Text className="text-gray-400">No artists found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleArtistPress(item)}
              className="flex-row items-center bg-white rounded-xl p-4 mb-3 border border-gray-100"
            >
              <View className="w-12 h-12 rounded-full bg-primary-100 items-center justify-center mr-4">
                <Ionicons name="person" size={24} color={PRIMARY} />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-gray-900">{item}</Text>
                <Text className="text-sm text-gray-500">Artist</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={eventResults}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View className="items-center py-8">
              <Text className="text-gray-400">No events found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleEventPress(item.id)}
              className="flex-row items-center bg-white rounded-xl p-4 mb-3 border border-gray-100"
            >
              <View className="w-12 h-12 rounded-xl bg-gray-100 items-center justify-center mr-4">
                <Ionicons name="ticket" size={24} color={PRIMARY} />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-gray-900" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-sm text-gray-500" numberOfLines={1}>
                  {item.venue} • {item.city}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
