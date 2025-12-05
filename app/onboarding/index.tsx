import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useUser } from '../../context/UserContext';
import { Category, OnboardingStep, UserPreferences } from '../../types';
import { searchCities, LocationResult } from '../../services/location';
import { searchAttractions } from '../../services/ticketmaster';
import { registerForPushNotificationsAsync } from '../../services/notifications';
import Button from '../../components/Button';
import Slider from '@react-native-community/slider';
import { PRIMARY, PRIMARY_DARK } from '../../constants/colors';

const LOCATION_ILLUSTRATION = require('../../assets/images/onboarding-location.png');
const CATEGORY_ILLUSTRATION = require('../../assets/images/onboarding-category.png');
const FAVORITES_ILLUSTRATION = require('../../assets/images/onboarding-favorites.png');
const DONE_ILLUSTRATION = require('../../assets/images/onboarding-done.png');

interface CategoryOption {
  id: Category;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const CATEGORIES: CategoryOption[] = [
  { id: 'Music', icon: 'musical-notes', label: 'Music' },
  { id: 'Comedy', icon: 'happy', label: 'Comedy' },
  { id: 'Theater', icon: 'ticket', label: 'Theater' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { updateUser } = useUser();
  const [step, setStep] = useState<OnboardingStep>('location');

  // Location State
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationResult[]>([]);
  const [isLocSearching, setIsLocSearching] = useState(false);
  const [radius, setRadius] = useState(25);
  const [loadingLoc, setLoadingLoc] = useState(false);

  // Category State
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);

  // Favorites State
  const [favorites, setFavorites] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isArtistSearching, setIsArtistSearching] = useState(false);

  // Notification State
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);

  // Animation refs for done screen
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const burstAnim = useRef(new Animated.Value(0)).current;

  // Start animations when reaching 'done' step
  useEffect(() => {
    if (step === 'done') {
      // Bounce animation for thumb
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -15,
            duration: 500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 500,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Burst animation for lines
      Animated.loop(
        Animated.timing(burstAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      ).start();
    }
  }, [step]);

  // Debounced City Search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (locationQuery.length > 2 && !selectedLocation) {
        setIsLocSearching(true);
        const results = await searchCities(locationQuery);
        setLocationSuggestions(results);
        setIsLocSearching(false);
      } else {
        setLocationSuggestions([]);
      }
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [locationQuery, selectedLocation]);

  // Debounced Artist Search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length > 2) {
        setIsArtistSearching(true);
        const results = await searchAttractions(searchQuery);
        setSuggestions(results.filter((r) => !favorites.includes(r)));
        setIsArtistSearching(false);
      } else {
        setSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, favorites]);

  const handleLocate = async () => {
    setLoadingLoc(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoadingLoc(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setSelectedLocation({
        id: 0,
        name: 'Current Location',
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        country: '',
        country_code: '',
      });
      setLocationQuery('Current Location');
    } catch (error) {
      console.error('Location error:', error);
    } finally {
      setLoadingLoc(false);
    }
  };

  const selectCity = (loc: LocationResult) => {
    setSelectedLocation(loc);
    setLocationQuery(loc.name);
    setLocationSuggestions([]);
  };

  const toggleCategory = (cat: Category) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories((prev) => prev.filter((c) => c !== cat));
    } else {
      setSelectedCategories((prev) => [...prev, cat]);
    }
  };

  const addFavorite = (name: string) => {
    if (!favorites.includes(name)) {
      setFavorites([...favorites, name]);
    }
    setSearchQuery('');
    setSuggestions([]);
  };

  const removeFavorite = (name: string) => {
    setFavorites(favorites.filter((f) => f !== name));
  };

  const requestNotifications = async () => {
    setRequestingPermission(true);
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        setNotificationsEnabled(true);
      }
    } catch (e) {
      console.error('Notification error:', e);
    } finally {
      setRequestingPermission(false);
    }
  };

  const handleNext = async () => {
    if (step === 'location' && (selectedLocation || locationQuery)) {
      setStep('categories');
    } else if (step === 'categories' && selectedCategories.length > 0) {
      setStep('favorites');
    } else if (step === 'favorites') {
      setStep('done');
    } else if (step === 'done') {
      const prefs: UserPreferences = {
        hasOnboarded: true,
        location: {
          city: selectedLocation ? selectedLocation.name : locationQuery,
          displayLabel: selectedLocation ? `${selectedLocation.name}, ${selectedLocation.country}` : locationQuery,
          latitude: selectedLocation?.latitude || null,
          longitude: selectedLocation?.longitude || null,
          radiusKm: radius,
        },
        categories: selectedCategories,
        favorites,
        notifications: {
          enabled: notificationsEnabled,
          dailyDigest: true,
          weeklySummary: false,
        },
      };
      await updateUser(prefs);
      router.replace('/(tabs)');
    }
  };

  const renderProgressDots = () => {
    const steps: OnboardingStep[] = ['location', 'categories', 'favorites', 'done'];
    const stepIndex = steps.indexOf(step);

    return (
      <View className="flex-row justify-center gap-2 pt-6 pb-8">
        {steps.map((s, i) => (
          <View
            key={s}
            className={`h-1.5 rounded-full ${i <= stepIndex ? 'w-6 bg-primary-600' : 'w-1.5 bg-gray-300'}`}
          />
        ))}
      </View>
    );
  };

  const renderLocation = () => (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      <View className="items-center mb-6">
        <Image source={LOCATION_ILLUSTRATION} className="w-40 h-40" contentFit="contain" />
        <Text className="text-2xl font-bold text-gray-900 mt-4">Where are you?</Text>
        <Text className="text-gray-500 text-center">We'll show you events happening nearby.</Text>
      </View>

      <Button variant="secondary" fullWidth onPress={handleLocate} loading={loadingLoc} icon={<Ionicons name="location" size={16} color="#374151" />}>
        Use Current Location
      </Button>

      <View className="flex-row items-center py-4">
        <View className="flex-1 h-px bg-gray-200" />
        <Text className="px-4 text-gray-400 text-xs uppercase tracking-wider">Or enter city</Text>
        <View className="flex-1 h-px bg-gray-200" />
      </View>

      <View className="relative z-10">
        <View className="flex-row items-center bg-white rounded-xl px-3 py-2.5 border border-gray-200">
          {selectedLocation ? (
            <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
          ) : (
            <Ionicons name="search" size={20} color="#9ca3af" />
          )}
          <TextInput
            placeholder="e.g. Paris, London, New York"
            placeholderTextColor="#9ca3af"
            className="flex-1 ml-2 text-base text-gray-900"
            value={locationQuery}
            onChangeText={(text) => {
              setLocationQuery(text);
              if (selectedLocation) setSelectedLocation(null);
            }}
          />
          {isLocSearching && <ActivityIndicator size="small" color="#9ca3af" />}
        </View>

        {locationSuggestions.length > 0 && !selectedLocation && (
          <View className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-100 overflow-hidden shadow-lg z-20">
            {locationSuggestions.map((loc) => (
              <TouchableOpacity key={loc.id} onPress={() => selectCity(loc)} className="px-4 py-3 border-b border-gray-50">
                <Text className="font-medium text-gray-900">{loc.name}</Text>
                <Text className="text-xs text-gray-500">
                  {loc.admin1 ? `${loc.admin1}, ` : ''}
                  {loc.country}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View className="mt-6">
        <View className="flex-row justify-between mb-2">
          <Text className="text-sm font-medium text-gray-700">Search Radius</Text>
          <Text className="text-sm font-medium text-primary-600">{radius} km</Text>
        </View>
        <View className="h-10 justify-center">
          <View className="h-2 bg-gray-200 rounded-full" />
          <View className="absolute left-0 right-0">
            <View 
              className="h-2 bg-primary-600 rounded-full" 
              style={{ width: `${((radius - 5) / 95) * 100}%` }} 
            />
          </View>
          <TextInput
            className="absolute left-0 right-0 opacity-0 h-10"
            value={String(radius)}
            onChangeText={(text) => {
              const val = parseInt(text) || 5;
              setRadius(Math.min(100, Math.max(5, val)));
            }}
            keyboardType="numeric"
          />
          <TouchableOpacity 
            className="absolute h-6 w-6 bg-primary-600 rounded-full border-2 border-white shadow-md"
            style={{ left: `${((radius - 5) / 95) * 100}%`, marginLeft: -12, top: -2 }}
            onPress={() => {}}
          />
        </View>
        <View className="flex-row justify-between mt-1">
          <Text className="text-xs text-gray-400">5km</Text>
          <Text className="text-xs text-gray-400">100km</Text>
        </View>
        <View className="flex-row justify-around mt-2">
          {[10, 25, 50, 100].map((val) => (
            <TouchableOpacity 
              key={val} 
              onPress={() => setRadius(val)}
              className={`px-3 py-1 rounded-full ${radius === val ? 'bg-primary-100' : 'bg-gray-100'}`}
            >
              <Text className={`text-sm ${radius === val ? 'text-primary-600 font-semibold' : 'text-gray-600'}`}>{val}km</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderCategories = () => (
    <View className="flex-1 px-6 pt-6 pb-24">
      <View className="items-center mb-6">
        <Image source={CATEGORY_ILLUSTRATION} className="w-32 h-32" contentFit="contain" />
        <Text className="text-2xl font-bold text-gray-900 mt-3">What are you into?</Text>
        <Text className="text-gray-500 text-center">Pick at least one category to get started.</Text>
      </View>

      <View className="flex-1 gap-3">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategories.includes(cat.id);

          return (
            <TouchableOpacity
              key={cat.id}
              onPress={() => toggleCategory(cat.id)}
              className={`
                flex-1 flex-row items-center px-5 rounded-2xl border-2
                ${isSelected ? 'border-primary-600 bg-primary-50' : 'border-transparent bg-white'}
              `}
            >
              <View
                className={`
                  rounded-full p-4 mr-4
                  ${isSelected ? 'bg-primary-200' : 'bg-gray-100'}
                `}
              >
                <Ionicons name={cat.icon} size={28} color={isSelected ? PRIMARY : '#6b7280'} />
              </View>
              <Text className={`font-bold text-lg flex-1 ${isSelected ? 'text-primary-900' : 'text-gray-600'}`}>
                {cat.label}
              </Text>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={24} color={PRIMARY} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderFavorites = () => (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View className="items-center mb-6">
          <Image source={FAVORITES_ILLUSTRATION} className="w-40 h-40" contentFit="contain" />
          <Text className="text-2xl font-bold text-gray-900 mt-4">Any favorites?</Text>
          <Text className="text-gray-500 text-center">Add artists you don't want to miss.</Text>
        </View>

        <View className="relative z-10">
          <View className="flex-row items-center bg-white rounded-xl px-3 py-2.5 border border-gray-200">
            <Ionicons name="search" size={20} color="#9ca3af" />
            <TextInput
              placeholder="Add artists, comedians, or shows..."
              placeholderTextColor="#9ca3af"
              className="flex-1 ml-2 text-base text-gray-900"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {isArtistSearching && <ActivityIndicator size="small" color="#9ca3af" />}
          </View>

          {searchQuery.length > 2 && (
            <View className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-100 overflow-hidden shadow-lg z-20 max-h-48">
              {isArtistSearching ? (
                <View className="px-4 py-3">
                  <Text className="text-gray-400 text-sm">Searching...</Text>
                </View>
              ) : suggestions.length > 0 ? (
                <ScrollView nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
                  {suggestions.map((item) => (
                    <TouchableOpacity key={item} onPress={() => addFavorite(item)} className="px-4 py-3 flex-row items-center justify-between border-b border-gray-50">
                      <Text className="text-gray-700">{item}</Text>
                      <Text className="text-xs text-primary-600 font-medium">Add</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <View className="px-4 py-3">
                  <Text className="text-gray-400 text-sm">No matches found</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View className="flex-row flex-wrap gap-2 mt-4 min-h-[100px]">
          {favorites.length === 0 && (
            <Text className="text-sm text-gray-400 w-full text-center py-4 italic">No favorites added yet. You can skip this.</Text>
          )}
          {favorites.map((fav) => (
            <View key={fav} className="flex-row items-center px-3 py-1.5 rounded-full bg-primary-100">
              <Text className="text-primary-800 text-sm font-medium">{fav}</Text>
              <TouchableOpacity onPress={() => removeFavorite(fav)} className="ml-2">
                <Ionicons name="close" size={12} color={PRIMARY_DARK} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderDone = () => {
    // Create 8 burst lines around the thumb
    const burstLines = [...Array(8)].map((_, i) => {
      const angle = (i * 45) * (Math.PI / 180);
      const startRadius = 70;
      const endRadius = 100;
      
      return (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: 4,
            height: 25,
            backgroundColor: '#000',
            borderRadius: 2,
            opacity: burstAnim.interpolate({
              inputRange: [0, 0.15, 1],
              outputRange: [0, 0.3, 0],
            }),
            transform: [
              { rotate: `${i * 45}deg` },
              {
                translateY: burstAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-startRadius, -endRadius],
                }),
              },
              {
                scaleY: burstAnim.interpolate({
                  inputRange: [0, 0.15, 1],
                  outputRange: [0.3, 1, 0.3],
                }),
              },
            ],
          }}
        />
      );
    });

    return (
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 100, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <View className="relative w-64 h-64 items-center justify-center mt-8">
          {/* Burst lines container */}
          <View className="absolute inset-0 items-center justify-center">
            {burstLines}
          </View>
          
          {/* Animated thumb image */}
          <Animated.View
            style={{
              transform: [{ translateY: bounceAnim }],
            }}
          >
            <Image source={DONE_ILLUSTRATION} className="w-40 h-40" contentFit="contain" />
          </Animated.View>
        </View>

        <Text className="text-3xl font-bold text-gray-900 mt-4">You're all set!</Text>
        <Text className="text-gray-500 text-center max-w-xs mt-2 mb-8">
          We've found some events in {selectedLocation?.name || locationQuery} you might like.
        </Text>

        <TouchableOpacity
          onPress={requestNotifications}
          disabled={notificationsEnabled || requestingPermission}
          className={`w-full p-4 rounded-xl flex-row items-start gap-3 border ${
            notificationsEnabled ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-100'
          }`}
        >
          <View className={`p-1.5 rounded-full ${notificationsEnabled ? 'bg-green-200' : 'bg-blue-200'}`}>
            {requestingPermission ? (
              <ActivityIndicator size="small" color={notificationsEnabled ? '#15803d' : '#1d4ed8'} />
          ) : (
            <Ionicons name={notificationsEnabled ? 'checkmark' : 'notifications'} size={16} color={notificationsEnabled ? '#15803d' : '#1d4ed8'} />
          )}
        </View>
        <View className="flex-1">
          <Text className={`font-semibold text-sm ${notificationsEnabled ? 'text-green-900' : 'text-blue-900'}`}>
            {notificationsEnabled ? 'Notifications Enabled' : 'Enable Notifications'}
          </Text>
          <Text className={`text-xs mt-1 ${notificationsEnabled ? 'text-green-700' : 'text-blue-700'}`}>
            {notificationsEnabled ? 'You will be notified about upcoming events.' : "Don't miss out when your favorite artists announce a tour."}
          </Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1">
        {step === 'location' && renderLocation()}
        {step === 'categories' && renderCategories()}
        {step === 'favorites' && renderFavorites()}
        {step === 'done' && renderDone()}
      </View>

      {/* Bottom Button */}
      <View className="px-6">
        <Button
          fullWidth
          onPress={handleNext}
          disabled={
            (step === 'location' && !selectedLocation && locationQuery.length < 2) ||
            (step === 'categories' && selectedCategories.length === 0)
          }
          icon={step === 'done' ? <Ionicons name="arrow-forward" size={16} color="white" /> : undefined}
          iconPosition="right"
        >
          {step === 'done'
            ? "Let's Go"
            : step === 'favorites'
            ? favorites.length > 0
              ? 'Continue'
              : 'Skip for now'
            : 'Next Step'}
        </Button>
      </View>

      {renderProgressDots()}
    </SafeAreaView>
  );
}
