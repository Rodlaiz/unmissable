import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  AppState,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useUser } from '../../context/UserContext';
import { Category } from '../../types';
import { searchCities, LocationResult } from '../../services/location';
import { clearUserPreferences } from '../../services/storage';
import { registerForPushNotificationsAsync } from '../../services/notifications';
import { PRIMARY } from '../../constants/colors';

const PROFILE_IMAGE = require('../../assets/images/profile-default.png');
const CATEGORIES: Category[] = ['Music', 'Comedy', 'Theater'];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, updateUser, logout } = useUser();
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [locQuery, setLocQuery] = useState(user?.location.city || '');
  const [locSuggestions, setLocSuggestions] = useState<LocationResult[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<LocationResult | null>(null);
  const [isLocSearching, setIsLocSearching] = useState(false);
  const [systemNotificationsEnabled, setSystemNotificationsEnabled] = useState<boolean | null>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Check system notification permission status
  const checkNotificationPermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    const isEnabled = status === 'granted';
    setSystemNotificationsEnabled(isEnabled);
    
    // Sync app state with system state
    if (user && user.notifications?.enabled !== isEnabled) {
      updateUser({
        ...user,
        notifications: {
          ...user.notifications!,
          enabled: isEnabled,
        },
      });
    }
  };

  // Check permission on mount and when app comes to foreground
  useEffect(() => {
    checkNotificationPermission();
    
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkNotificationPermission();
      }
    });
    
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (isEditingLocation && locQuery.length > 2 && !selectedLoc) {
        setIsLocSearching(true);
        const results = await searchCities(locQuery);
        setLocSuggestions(results);
        setIsLocSearching(false);
      } else {
        setLocSuggestions([]);
      }
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [locQuery, isEditingLocation, selectedLoc]);

  const toggleNotifications = async () => {
    if (!user) return;
    
    const currentlyEnabled = user.notifications?.enabled;
    
    if (!currentlyEnabled) {
      // User wants to enable notifications - request permission
      setIsRequestingPermission(true);
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        
        if (existingStatus === 'denied') {
          // Permission was previously denied, need to go to settings
          Alert.alert(
            'Notifications Disabled',
            'You previously denied notification permissions. Please enable them in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
          return;
        }
        
        // Request permission
        await registerForPushNotificationsAsync();
        const { status } = await Notifications.getPermissionsAsync();
        const granted = status === 'granted';
        
        setSystemNotificationsEnabled(granted);
        updateUser({
          ...user,
          notifications: {
            ...user.notifications!,
            enabled: granted,
          },
        });
        
        if (!granted) {
          Alert.alert(
            'Permission Required',
            'To receive notifications about your favorite artists, please enable notifications in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }
      } finally {
        setIsRequestingPermission(false);
      }
    } else {
      // User wants to disable - we can't revoke permission, but we can disable in-app
      Alert.alert(
        'Disable Notifications',
        'To fully disable notifications, you need to turn them off in your device settings. Do you want to open settings?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: () => Linking.openSettings() 
          },
          {
            text: 'Disable In-App Only',
            onPress: () => {
              updateUser({
                ...user,
                notifications: {
                  ...user.notifications!,
                  enabled: false,
                },
              });
            },
          },
        ]
      );
    }
  };

  const toggleCategory = (cat: Category) => {
    if (!user) return;
    const currentCats = user.categories;
    const newCats = currentCats.includes(cat)
      ? currentCats.filter((c) => c !== cat)
      : [...currentCats, cat];

    updateUser({
      ...user,
      categories: newCats,
    });
  };

  const togglePreference = (key: 'dailyDigest' | 'weeklySummary') => {
    if (!user) return;
    updateUser({
      ...user,
      notifications: {
        ...user.notifications!,
        [key]: !user.notifications?.[key],
      },
    });
  };

  const handleSaveLocation = () => {
    if (!user) return;

    if (selectedLoc) {
      updateUser({
        ...user,
        location: {
          ...user.location,
          city: selectedLoc.name,
          country: selectedLoc.country,
          displayLabel: `${selectedLoc.name}, ${selectedLoc.country}`,
          latitude: selectedLoc.latitude,
          longitude: selectedLoc.longitude,
        },
      });
      setIsEditingLocation(false);
    } else if (locQuery && locQuery !== user.location.city) {
      updateUser({
        ...user,
        location: {
          ...user.location,
          city: locQuery,
          country: '',
          displayLabel: locQuery,
          latitude: null,
          longitude: null,
        },
      });
      setIsEditingLocation(false);
    } else {
      setIsEditingLocation(false);
    }
  };

  const handleSelectLoc = (loc: LocationResult) => {
    setSelectedLoc(loc);
    setLocQuery(loc.name);
    setLocSuggestions([]);
  };

  const handleCancelLocation = () => {
    if (user) {
      setLocQuery(user.location.city);
    }
    setIsEditingLocation(false);
    setLocSuggestions([]);
    setSelectedLoc(null);
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const handleResetOnboarding = () => {
    Alert.alert(
      'Reset & Redo Onboarding',
      'This will clear all your preferences and take you back to the login screen. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await clearUserPreferences();
            logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* Profile Header Image */}
        <View className="items-center justify-center pb-4">
          <View className="relative w-28 h-28 mb-2">
            <View className="absolute inset-0 bg-primary-200 rounded-full opacity-40" />
            <Image source={PROFILE_IMAGE} className="w-full h-full" contentFit="contain" />
          </View>
          <Text className="text-lg font-bold text-gray-900">Your Preferences</Text>
          <Text className="text-gray-500 text-sm">Manage your location and interests</Text>
        </View>

        {/* Push Notifications Card */}
        <TouchableOpacity
          onPress={toggleNotifications}
          disabled={isRequestingPermission}
          className="bg-white rounded-2xl p-4 shadow-sm mb-4"
        >
          <View className="flex-row items-center justify-between">
            <Text className="font-medium text-gray-900">Enable Push Notifications</Text>
            {isRequestingPermission ? (
              <ActivityIndicator size="small" color={PRIMARY} />
            ) : (
              <View
                className={`w-12 h-7 rounded-full flex-row items-center p-1 ${
                  user.notifications?.enabled ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <View
                  className={`bg-white w-5 h-5 rounded-full shadow-md ${
                    user.notifications?.enabled ? 'ml-5' : 'ml-0'
                  }`}
                />
              </View>
            )}
          </View>
          {systemNotificationsEnabled === false && user.notifications?.enabled && (
            <Text className="text-xs text-orange-600 mt-2">
              ⚠️ Notifications are disabled in system settings
            </Text>
          )}
        </TouchableOpacity>

        {/* Detailed Notifications */}
        {user.notifications?.enabled && (
          <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="font-medium text-gray-900">Live Alerts</Text>
                <Text className="text-sm text-gray-500">Events in {user.location.city}</Text>
              </View>
              <View className="w-2 h-2 rounded-full bg-green-500" />
            </View>
          </View>
        )}

        {/* Location */}
        <View className="bg-white rounded-2xl p-4 shadow-sm mb-4 z-10">
          <Text className="text-xs font-semibold text-gray-500 uppercase mb-2">My Location</Text>

          {isEditingLocation ? (
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <View className="flex-1 flex-row items-center bg-gray-100 rounded-xl px-3 py-2.5">
                  <TextInput
                    value={locQuery}
                    onChangeText={(text) => {
                      setLocQuery(text);
                      setSelectedLoc(null);
                    }}
                    autoFocus
                    className="flex-1 text-base text-gray-900"
                    placeholder="Search city..."
                    placeholderTextColor="#9ca3af"
                  />
                  {isLocSearching && <ActivityIndicator size="small" color="#9ca3af" />}
                </View>
                <TouchableOpacity
                  onPress={handleSaveLocation}
                  disabled={!selectedLoc && locQuery.length < 2}
                  className={`p-2 rounded-full ${selectedLoc || locQuery.length >= 2 ? 'bg-primary-100' : 'bg-gray-100 opacity-50'}`}
                >
                  <Ionicons name="checkmark" size={20} color={selectedLoc || locQuery.length >= 2 ? PRIMARY : '#9ca3af'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCancelLocation} className="p-2 bg-gray-100 rounded-full">
                  <Ionicons name="close" size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>

              {locSuggestions.length > 0 && (
                <View className="bg-white rounded-xl border border-gray-100 overflow-hidden max-h-48">
                  {locSuggestions.map((loc) => (
                    <TouchableOpacity
                      key={loc.id}
                      onPress={() => handleSelectLoc(loc)}
                      className="px-4 py-3 border-b border-gray-50"
                    >
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
          ) : (
            <View className="flex-row justify-between items-center">
              <TouchableOpacity
                onPress={() => {
                  setLocQuery('');
                  setIsEditingLocation(true);
                }}
                className="flex-row items-center gap-2"
              >
                <Text className="text-gray-900 font-medium">Change Location</Text>
                <Ionicons name="pencil" size={12} color="#9ca3af" />
              </TouchableOpacity>
              <View className="items-end">
                <View className="bg-primary-50 px-3 py-1 rounded-full">
                  <Text className="text-primary-600 text-sm font-medium">{user.location.city}</Text>
                </View>
                {user.location.displayLabel && user.location.displayLabel !== user.location.city && (
                  <Text className="text-[10px] text-gray-400 mt-1" numberOfLines={1}>
                    {user.location.displayLabel}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Favorite Genres & Preferences */}
        <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <Text className="font-bold text-gray-900 mb-4">Interests & Digests</Text>

          <View className="gap-3">
            {CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat} onPress={() => toggleCategory(cat)} className="flex-row items-center gap-3">
                <View
                  className={`w-6 h-6 rounded items-center justify-center ${
                    user.categories.includes(cat) ? 'bg-primary-600' : 'border-2 border-gray-200'
                  }`}
                >
                  {user.categories.includes(cat) && <Ionicons name="checkmark" size={16} color="white" />}
                </View>
                <Text className="text-gray-700 font-medium">{cat}</Text>
              </TouchableOpacity>
            ))}

            <View className="border-t border-gray-100 my-2" />

            <TouchableOpacity
              onPress={() => togglePreference('dailyDigest')}
              className="flex-row items-center gap-3"
            >
              <View
                className={`w-6 h-6 rounded items-center justify-center ${
                  user.notifications?.dailyDigest ? 'bg-primary-600' : 'border-2 border-gray-200'
                }`}
              >
                {user.notifications?.dailyDigest && <Ionicons name="checkmark" size={16} color="white" />}
              </View>
              <Text className="text-gray-700 font-medium">Daily Digest</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => togglePreference('weeklySummary')}
              className="flex-row items-center gap-3"
            >
              <View
                className={`w-6 h-6 rounded items-center justify-center ${
                  user.notifications?.weeklySummary ? 'bg-primary-600' : 'border-2 border-gray-200'
                }`}
              >
                {user.notifications?.weeklySummary && <Ionicons name="checkmark" size={16} color="white" />}
              </View>
              <Text className="text-gray-700 font-medium">Weekly Summary</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout */}
        <View className="bg-white rounded-2xl p-4 shadow-sm flex-row items-center justify-between mb-4">
          <View>
            <Text className="font-bold text-gray-900">Account</Text>
            <TouchableOpacity onPress={handleLogout} className="mt-1">
              <Text className="text-red-600 font-medium text-sm">Sign out of Unmissable</Text>
            </TouchableOpacity>
          </View>
          <View className="w-2 h-2 rounded-full bg-gray-300" />
        </View>

        {/* Reset Onboarding */}
        <TouchableOpacity
          onPress={handleResetOnboarding}
          className="bg-white rounded-2xl p-4 shadow-sm flex-row items-center justify-between mb-4"
        >
          <View>
            <Text className="font-bold text-gray-900">Reset App</Text>
            <Text className="text-gray-500 text-sm">Clear all data & redo onboarding</Text>
          </View>
          <Ionicons name="refresh-outline" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <Text className="text-center text-xs text-gray-400 py-4">Unmissable v1.0.4</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
