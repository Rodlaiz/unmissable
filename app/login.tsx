import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import { registerForPushNotificationsAsync } from '../services/notifications';
import { defaultPreferences } from '../services/storage';
import Button from '../components/Button';
import Input from '../components/Input';
import { PRIMARY, PRIMARY_DARK } from '../constants/colors';

const LOGO = require('../assets/images/logo.png');

export default function LoginScreen() {
  const router = useRouter();
  const { user, updateUser } = useUser();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Animation for logo
  const logoScale = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.05,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Simulate API call - replace with your actual auth service
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Request notification permissions after successful login
      const pushToken = await registerForPushNotificationsAsync();

      // Create or update user with login status and push token
      const basePrefs = user || defaultPreferences;
      await updateUser({
        ...basePrefs,
        hasSeenLogin: true,
        pushToken: pushToken || undefined,
        notifications: {
          ...basePrefs.notifications,
          enabled: !!pushToken,
          dailyDigest: true,
          weeklySummary: false,
        },
      });

      // Navigate to onboarding if not completed, otherwise to main app
      if (user?.hasOnboarded) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    } catch (error) {
      Alert.alert('Login Failed', 'Please check your credentials and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setIsLoading(true);
    try {
      // Simulate social auth - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Request notification permissions
      const pushToken = await registerForPushNotificationsAsync();

      // Create or update user with login status and push token
      const basePrefs = user || defaultPreferences;
      await updateUser({
        ...basePrefs,
        hasSeenLogin: true,
        pushToken: pushToken || undefined,
        notifications: {
          ...basePrefs.notifications,
          enabled: !!pushToken,
          dailyDigest: true,
          weeklySummary: false,
        },
      });

      if (user?.hasOnboarded) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    } catch (error) {
      Alert.alert('Login Failed', `Failed to login with ${provider}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipLogin = async () => {
    // Request notification permissions even for guest users
    const pushToken = await registerForPushNotificationsAsync();

    // Create or update user with guest status and push token
    const basePrefs = user || defaultPreferences;
    await updateUser({
      ...basePrefs,
      hasSeenLogin: true,
      pushToken: pushToken || undefined,
      notifications: {
        ...basePrefs.notifications,
        enabled: !!pushToken,
        dailyDigest: true,
        weeklySummary: false,
      },
    });

    // Continue to onboarding or main app
    if (user?.hasOnboarded) {
      router.replace('/(tabs)');
    } else {
      router.replace('/onboarding');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 pt-8 pb-6">
            {/* Logo and Header */}
            <View className="items-center mb-8">
              <Animated.View style={{ transform: [{ scale: logoScale }] }}>
                <Image
                  source={LOGO}
                  style={{ width: 180, height: 180 }}
                  contentFit="contain"
                />
              </Animated.View>
              <Text className="text-3xl font-bold text-gray-900 mt-4">
                Welcome to Unmissable
              </Text>
              <Text className="text-base text-gray-500 mt-2 text-center">
                Sign in to get personalized event notifications
              </Text>
            </View>

            {/* Login Form */}
            <View className="space-y-4">
              {/* Email Input */}
              <View className="mb-4">
                <Input
                  label="Email"
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  error={errors.email}
                  icon={<Ionicons name="mail-outline" size={20} color="#9ca3af" />}
                />
              </View>

              {/* Password Input */}
              <View className="mb-6">
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Password</Text>
                <View className="relative">
                  <View className="absolute left-3 top-0 bottom-0 justify-center z-10">
                    <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" />
                  </View>
                  <TextInput
                    className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-12 py-3 text-gray-900 text-base"
                    placeholder="Enter your password"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errors.password) setErrors({ ...errors, password: undefined });
                    }}
                  />
                  <TouchableOpacity
                    className="absolute right-3 top-0 bottom-0 justify-center"
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#9ca3af"
                    />
                  </TouchableOpacity>
                </View>
                {errors.password && (
                  <Text className="mt-1 text-sm text-red-500">{errors.password}</Text>
                )}
              </View>

              {/* Forgot Password */}
              <TouchableOpacity className="self-end mb-6">
                <Text className="text-primary-600 font-medium">Forgot Password?</Text>
              </TouchableOpacity>

              {/* Login Button */}
              <Button
                variant="primary"
                fullWidth
                loading={isLoading}
                disabled={isLoading}
                onPress={handleLogin}
              >
                Sign In
              </Button>
            </View>

            {/* Divider */}
            <View className="flex-row items-center my-6">
              <View className="flex-1 h-px bg-gray-200" />
              <Text className="mx-4 text-gray-400 text-sm">or continue with</Text>
              <View className="flex-1 h-px bg-gray-200" />
            </View>

            {/* Social Login Buttons */}
            <View className="flex-row space-x-3 mb-6">
              <TouchableOpacity
                className="flex-1 flex-row items-center justify-center py-3.5 px-4 bg-white border border-gray-200 rounded-xl mr-2"
                onPress={() => handleSocialLogin('google')}
                disabled={isLoading}
              >
                <Ionicons name="logo-google" size={22} color="#EA4335" />
                <Text className="ml-2 font-semibold text-gray-700">Google</Text>
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  className="flex-1 flex-row items-center justify-center py-3.5 px-4 bg-black rounded-xl ml-2"
                  onPress={() => handleSocialLogin('apple')}
                  disabled={isLoading}
                >
                  <Ionicons name="logo-apple" size={22} color="white" />
                  <Text className="ml-2 font-semibold text-white">Apple</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Skip Login */}
            <TouchableOpacity
              className="py-3"
              onPress={handleSkipLogin}
              disabled={isLoading}
            >
              <Text className="text-center text-gray-500">
                Continue as Guest
              </Text>
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View className="flex-row justify-center mt-auto pt-6">
              <Text className="text-gray-500">Don't have an account? </Text>
              <TouchableOpacity>
                <Text className="text-primary-600 font-semibold">Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
