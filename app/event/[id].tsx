import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Event } from '../../types';
import { useUser } from '../../context/UserContext';
import { getEventById } from '../../services/ticketmaster';
import { getResaleOptions, ResaleOption } from '../../services/resale';
import Button from '../../components/Button';
import { PRIMARY } from '../../constants/colors';
import { formatFullDate } from '../../utils/formatters';

export default function EventDetailScreen() {
  const { id, fromArtist } = useLocalSearchParams<{ id: string; fromArtist?: string }>();
  const router = useRouter();
  const hideArtistSection = fromArtist === 'true';
  const { user, updateUser } = useUser();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [resaleOptions, setResaleOptions] = useState<ResaleOption[]>([]);
  const [loadingResale, setLoadingResale] = useState(false);

  const isFollowing = event?.artistName ? user?.favorites.includes(event.artistName) : false;

  const toggleFollow = () => {
    if (!user || !event?.artistName) return;
    const artistName = event.artistName;
    const alreadyFollowing = user.favorites.includes(artistName);
    
    let newFavorites: string[];
    if (alreadyFollowing) {
      newFavorites = user.favorites.filter((f) => f !== artistName);
    } else {
      // Prevent duplicates by checking again before adding
      if (!user.favorites.includes(artistName)) {
        newFavorites = [...user.favorites, artistName];
      } else {
        return; // Already following, do nothing
      }
    }
    updateUser({ ...user, favorites: newFavorites });
  };

  useEffect(() => {
    const fetchDetails = async () => {
      if (!id) return;
      setLoading(true);
      const data = await getEventById(id);
      setEvent(data);
      setLoading(false);

      if (data && data.availability === 'SOLD_OUT') {
        setLoadingResale(true);
        const options = await getResaleOptions(data);
        setResaleOptions(options);
        setLoadingResale(false);
      }
    };
    fetchDetails();
  }, [id]);

  const openMaps = async () => {
    if (!event) return;
    const query = event.location
      ? `${event.location.lat},${event.location.lng}`
      : `${encodeURIComponent(event.venue)} ${encodeURIComponent(event.city)}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    await WebBrowser.openBrowserAsync(url);
  };

  const openTickets = async () => {
    if (event?.ticketUrl) {
      await WebBrowser.openBrowserAsync(event.ticketUrl);
    }
  };

  const openResale = async (url: string) => {
    await WebBrowser.openBrowserAsync(url);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color={PRIMARY} />
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500">Event not found</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-primary-600 font-semibold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isSoldOut = event.availability === 'SOLD_OUT';
  const isCanceled = event.availability === 'CANCELED';

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero Image */}
        <View className="relative h-80 w-full">
          <Image
            source={event.imageUrl}
            className={`w-full h-full ${isCanceled ? 'opacity-70' : ''}`}
            contentFit="cover"
            transition={300}
          />
          <View className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Header Actions */}
          <SafeAreaView className="absolute top-0 left-0 right-0">
            <View className="flex-row justify-between items-center px-4 py-2">
              <TouchableOpacity
                onPress={() => router.back()}
                className="p-2 bg-white/20 rounded-full"
              >
                <Ionicons name="chevron-back" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity className="p-2 bg-white/20 rounded-full">
                <Ionicons name="share-outline" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Title Overlay */}
          <View className="absolute bottom-0 left-0 right-0 p-6">
            <View className="flex-row gap-2 mb-3">
              <View className="bg-primary-600 px-3 py-1 rounded-full">
                <Text className="text-white text-xs font-bold uppercase">{event.category}</Text>
              </View>
              {isSoldOut && (
                <View className="bg-red-600 px-3 py-1 rounded-full">
                  <Text className="text-white text-xs font-bold uppercase">Sold Out</Text>
                </View>
              )}
              {isCanceled && (
                <View className="bg-gray-700 px-3 py-1 rounded-full">
                  <Text className="text-white text-xs font-bold uppercase">Canceled</Text>
                </View>
              )}
            </View>
            <Text
              className={`text-3xl font-bold text-white ${isCanceled ? 'line-through opacity-70' : ''}`}
              numberOfLines={3}
            >
              {event.name}
            </Text>
          </View>
        </View>

        <View className="px-6 py-6 gap-8">
          {/* Sold Out Banner */}
          {isSoldOut && (
            <View className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex-row items-start gap-3">
              <Ionicons name="alert-circle" size={20} color="#ea580c" />
              <View className="flex-1">
                <Text className="font-bold text-orange-900">Tickets Sold Out on Ticketmaster</Text>
                <Text className="text-sm text-orange-700 mt-1">
                  We found verified resale tickets for you below.
                </Text>
              </View>
            </View>
          )}

          {/* Canceled Banner */}
          {isCanceled && (
            <View className="bg-gray-100 border border-gray-200 rounded-2xl p-4 flex-row items-start gap-3">
              <Ionicons name="information-circle" size={20} color="#6b7280" />
              <View className="flex-1">
                <Text className="font-bold text-gray-900">Event Canceled</Text>
                <Text className="text-sm text-gray-600 mt-1">
                  This event has been canceled by the organizer.
                </Text>
              </View>
            </View>
          )}

          {/* Info Grid */}
          <View className="gap-5">
            <View className="flex-row items-start gap-4">
              <View className="p-3 bg-red-50 rounded-2xl">
                <Ionicons name="calendar" size={24} color="#dc2626" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-gray-900 text-lg">Date & Time</Text>
                <Text className="text-gray-600">{formatFullDate(event.date)}</Text>
              </View>
            </View>

            <TouchableOpacity onPress={openMaps} className="flex-row items-start gap-4">
              <View className="p-3 bg-blue-50 rounded-2xl">
                <Ionicons name="location" size={24} color="#2563eb" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-gray-900 text-lg">Location</Text>
                <Text className="text-gray-900 font-medium">{event.venue}</Text>
                <Text className="text-gray-500 text-sm">{event.city}</Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View className="h-px bg-gray-100" />

          {/* Artist Section - Only show if artist exists and not coming from artist page */}
          {event.artistName && !hideArtistSection && (
            <View>
              <View className="bg-gray-50 rounded-2xl p-4">
                <TouchableOpacity
                  onPress={() => router.push(`/artist/${encodeURIComponent(event.artistName!)}`)}
                  className="flex-row items-center mb-4"
                >
                  <View className="p-3 bg-purple-100 rounded-full mr-3">
                    <Ionicons name="person" size={24} color="#9333ea" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-gray-500 uppercase tracking-wide font-medium">Artist</Text>
                    <Text className="font-bold text-gray-900 text-lg">{event.artistName}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </TouchableOpacity>

                {isFollowing ? (
                  <TouchableOpacity
                    onPress={toggleFollow}
                    className="bg-white border border-gray-200 rounded-xl py-3 flex-row items-center justify-center"
                  >
                    <Ionicons name="checkmark" size={18} color="#374151" />
                    <Text className="text-gray-700 font-semibold ml-2">Following</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={toggleFollow}
                    className="bg-primary-600 rounded-xl py-3 flex-row items-center justify-center"
                  >
                    <Ionicons name="add" size={18} color="white" />
                    <Text className="text-white font-semibold ml-2">Follow</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View className="h-px bg-gray-100 mt-8" />
            </View>
          )}

          {/* About Section */}
          <View>
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="information-circle" size={20} color="#9ca3af" />
              <Text className="font-bold text-gray-900 text-lg">About Event</Text>
            </View>
            <Text className="text-gray-600 leading-relaxed text-sm">
              {event.description ||
                `Join us for ${event.name} at ${event.venue}. This is expected to be a fantastic event showcasing the best of ${event.category}. Don't miss out on what promises to be an unforgettable experience in ${event.city}.`}
            </Text>
          </View>

          {/* Resale Options List (Only if Sold Out) */}
          {isSoldOut && (
            <View className="gap-4">
              <Text className="font-bold text-gray-900 text-lg">Find Resale Tickets</Text>

              {loadingResale ? (
                <View className="py-6 items-center">
                  <ActivityIndicator size="small" color={PRIMARY} />
                </View>
              ) : (
                <View className="gap-3">
                  {resaleOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt.source}
                      onPress={() => openResale(opt.url)}
                      className="bg-white border border-gray-100 rounded-xl p-4 flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center gap-3">
                        <View
                          className="w-10 h-10 rounded-full items-center justify-center"
                          style={{ backgroundColor: opt.logoColor || '#333' }}
                        >
                          <Text className="text-white font-bold text-xs">{opt.source[0]}</Text>
                        </View>
                        <View>
                          <Text className="font-bold text-gray-900">{opt.displayName}</Text>
                          {opt.lowestPrice ? (
                            <Text className="text-green-600 text-sm font-semibold">from ${opt.lowestPrice}</Text>
                          ) : (
                            <Text className="text-gray-500 text-xs">Check availability</Text>
                          )}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <Text className="text-xs text-gray-400 text-center px-4">
                ⚠️ Resale prices may be above face value. Unmissable is not responsible for 3rd party transactions.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-8">
        {isSoldOut ? (
          <Button fullWidth onPress={() => resaleOptions[0] && openResale(resaleOptions[0].url)}>
            View Resale Options
          </Button>
        ) : isCanceled ? (
          <View className="w-full p-3 bg-gray-100 rounded-xl items-center">
            <Text className="text-gray-500 font-medium text-sm">Event Canceled</Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-4">
            <View className="flex-1">
              <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide">Price varies</Text>
              <Text className="font-bold text-gray-900 text-lg">Check availability</Text>
            </View>
            <Button onPress={openTickets}>Get Tickets</Button>
          </View>
        )}
      </View>
    </View>
  );
}
