import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Event } from '../types';
import { formatDateTime } from '../utils/formatters';

/**
 * Status badge for events (Sold Out, Canceled, etc.)
 */
export const StatusBadge: React.FC<{ status: Event['availability'] }> = ({ status }) => {
  if (status === 'SOLD_OUT') {
    return (
      <View className="bg-red-600 px-2.5 py-1 rounded-full">
        <Text className="text-[10px] font-bold text-white uppercase tracking-wide">Sold Out</Text>
      </View>
    );
  }
  if (status === 'CANCELED' || status === 'POSTPONED') {
    return (
      <View className="bg-gray-800 px-2.5 py-1 rounded-full">
        <Text className="text-[10px] font-bold text-white uppercase tracking-wide">{status}</Text>
      </View>
    );
  }
  return null;
};

export interface EventCardProps {
  event: Event;
  layout: 'horizontal' | 'vertical';
  onPress: () => void;
  onFavorite?: () => void;
  isFavorited?: boolean;
}

/**
 * Animated heart button for favoriting
 */
const HeartButton: React.FC<{
  onPress: () => void;
  isFavorited: boolean;
  size: number;
  containerClass: string;
}> = ({ onPress, isFavorited, size, containerClass }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    // Animate the heart
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      className={containerClass}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.7}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Ionicons
          name={isFavorited ? 'heart' : 'heart-outline'}
          size={size}
          color={isFavorited ? '#ef4444' : '#374151'}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

/**
 * Event card component used in feeds and search results.
 * Supports horizontal (carousel) and vertical (list) layouts.
 */
export const EventCard: React.FC<EventCardProps> = ({ event, layout, onPress, onFavorite, isFavorited = false }) => {
  const isCanceled = event.availability === 'CANCELED';

  if (layout === 'horizontal') {
    return (
      <View className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 w-[280px] mr-4">
        <Pressable onPress={onPress}>
          <View className="h-40 w-full relative">
            <Image
              source={event.imageUrl}
              className={`w-full h-full ${isCanceled ? 'opacity-70' : ''}`}
              contentFit="cover"
              transition={200}
            />
            <View className="absolute top-3 left-3 flex-col gap-1">
              <View className="bg-white/90 px-2.5 py-1 rounded-full">
                <Text className="text-[10px] font-bold text-gray-900 uppercase tracking-wide">{event.category}</Text>
              </View>
              <StatusBadge status={event.availability} />
            </View>
          </View>
          <View className="p-4">
            <Text
              className={`font-bold text-gray-900 text-lg leading-tight mb-2 ${isCanceled ? 'line-through text-gray-400' : ''}`}
              numberOfLines={2}
            >
              {event.name}
            </Text>
            <View className="flex-row items-center mb-1">
              <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
              <Text className="text-xs text-gray-500 font-medium ml-1.5">{formatDateTime(event.date)}</Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="location-outline" size={14} color="#9ca3af" />
              <Text className="text-xs text-gray-500 ml-1.5" numberOfLines={1}>
                {event.venue}, {event.city.split(',')[0]}
              </Text>
            </View>
          </View>
        </Pressable>
        {onFavorite && (
          <HeartButton
            onPress={onFavorite}
            isFavorited={isFavorited}
            size={20}
            containerClass="absolute top-3 right-3 bg-white/90 p-2 rounded-full"
          />
        )}
      </View>
    );
  }

  // Vertical layout
  return (
    <View className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex-row h-32 mb-3">
      <Pressable onPress={onPress} className="flex-row flex-1">
        <View className="w-32 h-full">
          <Image
            source={event.imageUrl}
            className={`w-full h-full ${isCanceled ? 'opacity-70' : ''}`}
            contentFit="cover"
            transition={200}
          />
        </View>
        <View className="flex-1 p-3 pl-4 justify-center">
          <View className="flex-row justify-between items-start mb-1">
            <Text className="text-[10px] font-bold text-primary-600 uppercase tracking-wide">{event.category}</Text>
            {event.availability !== 'ON_SALE' && (
              <Text
                className={`text-[10px] font-bold uppercase tracking-wide ${event.availability === 'SOLD_OUT' ? 'text-red-600' : 'text-gray-500'}`}
              >
                {event.availability.replace('_', ' ')}
              </Text>
            )}
          </View>
          <Text
            className={`font-bold text-gray-900 text-base leading-tight mb-2 ${isCanceled ? 'line-through text-gray-400' : ''}`}
            numberOfLines={2}
          >
            {event.name}
          </Text>
          <View className="flex-row items-center mb-1">
            <Ionicons name="calendar-outline" size={12} color="#9ca3af" />
            <Text className="text-xs text-gray-500 font-medium ml-1.5">{formatDateTime(event.date)}</Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="location-outline" size={12} color="#9ca3af" />
            <Text className="text-xs text-gray-500 ml-1.5" numberOfLines={1}>
              {event.venue}, {event.city.split(',')[0]}
            </Text>
          </View>
        </View>
      </Pressable>
      {onFavorite && (
        <HeartButton
          onPress={onFavorite}
          isFavorited={isFavorited}
          size={16}
          containerClass="absolute top-2 left-[104px] bg-white/90 p-1.5 rounded-full"
        />
      )}
    </View>
  );
};

export default EventCard;
