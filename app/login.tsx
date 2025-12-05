import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useUser } from '../context/UserContext';
import { registerForPushNotificationsAsync } from '../services/notifications';
import Button from '../components/Button';
import Input from '../components/Input';

const LOGO = require('../assets/images/logo.png');

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

export default function LoginScreen() {
  const router = useRouter();
  const { 
    user, 
    updateUser, 
    signIn, 
    signUp, 
    signInWithApple, 
    signInWithGoogle,
    continueAsGuest,
    forgotPassword,
  } = useUser();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signIn');
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const [successMessage, setSuccessMessage] = useState('');

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
    const newErrors: { email?: string; password?: string; confirmPassword?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (authMode !== 'forgotPassword') {
      if (!password) {
        newErrors.password = 'Password is required';
      } else if (password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }

      if (authMode === 'signUp') {
        if (!confirmPassword) {
          newErrors.confirmPassword = 'Please confirm your password';
        } else if (password !== confirmPassword) {
          newErrors.confirmPassword = 'Passwords do not match';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAuthSuccess = async () => {
    // Request notification permissions after successful login
    const pushToken = await registerForPushNotificationsAsync();

    // Update user with push token if we got one
    if (user && pushToken) {
      await updateUser({
        ...user,
        pushToken: pushToken,
        notifications: {
          ...user.notifications,
          enabled: true,
          dailyDigest: true,
          weeklySummary: false,
        },
      });
    }

    // Navigate based on onboarding status
    if (user?.hasOnboarded) {
      router.replace('/(tabs)');
    } else {
      router.replace('/onboarding');
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setSuccessMessage('');
    
    try {
      if (authMode === 'forgotPassword') {
        const result = await forgotPassword(email);
        if (result.success) {
          setSuccessMessage('Password reset email sent! Check your inbox.');
          // After a delay, switch back to sign in mode
          setTimeout(() => {
            setAuthMode('signIn');
            setSuccessMessage('');
          }, 3000);
        } else {
          Alert.alert('Error', result.error || 'Failed to send reset email.');
        }
      } else if (authMode === 'signIn') {
        const result = await signIn(email, password);
        if (result.success) {
          await handleAuthSuccess();
        } else {
          Alert.alert('Sign In Failed', result.error || 'Please check your credentials.');
        }
      } else if (authMode === 'signUp') {
        const result = await signUp(email, password);
        if (result.success) {
          if (result.error?.includes('check your email')) {
            // Email confirmation required
            setSuccessMessage(result.error);
            setTimeout(() => {
              setAuthMode('signIn');
              setSuccessMessage('');
            }, 5000);
          } else {
            await handleAuthSuccess();
          }
        } else {
          Alert.alert('Sign Up Failed', result.error || 'Please try again.');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithApple();
      if (result.success) {
        await handleAuthSuccess();
      } else if (result.error !== 'Sign in was cancelled.') {
        Alert.alert('Apple Sign In Failed', result.error || 'Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to sign in with Apple.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.success && result.error) {
        // result.error contains the OAuth URL
        await WebBrowser.openBrowserAsync(result.error);
      } else if (!result.success) {
        Alert.alert('Google Sign In Failed', result.error || 'Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to sign in with Google.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipLogin = async () => {
    setIsLoading(true);
    try {
      await continueAsGuest();
      
      // Request notification permissions for guest users too
      const pushToken = await registerForPushNotificationsAsync();
      
      if (user && pushToken) {
        await updateUser({
          ...user,
          pushToken: pushToken,
          notifications: {
            ...user.notifications,
            enabled: true,
            dailyDigest: true,
            weeklySummary: false,
          },
        });
      }

      // Navigate to onboarding or main app
      if (user?.hasOnboarded) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to continue as guest.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchAuthMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setErrors({});
    setSuccessMessage('');
  };

  const getSubmitButtonText = () => {
    if (authMode === 'signIn') return 'Sign In';
    if (authMode === 'signUp') return 'Create Account';
    return 'Send Reset Link';
  };

  const getHeaderText = () => {
    if (authMode === 'signIn') return 'Sign in to get personalized event notifications';
    if (authMode === 'signUp') return 'Create an account to track your favorite artists';
    return 'Enter your email to reset your password';
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
            <View className="items-center mb-6">
              <Animated.View style={{ transform: [{ scale: logoScale }] }}>
                <Image
                  source={LOGO}
                  style={{ width: 260, height: 75 }}
                  contentFit="contain"
                />
              </Animated.View>
              <Text className="text-base text-gray-500 mt-4 text-center">
                {getHeaderText()}
              </Text>
            </View>

            {/* Success Message */}
            {successMessage && (
              <View className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <Text className="text-green-700 text-center">{successMessage}</Text>
              </View>
            )}

            {/* Auth Form */}
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

              {/* Password Input - Hidden in forgot password mode */}
              {authMode !== 'forgotPassword' && (
                <View className="mb-4">
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
              )}

              {/* Confirm Password - Only in sign up mode */}
              {authMode === 'signUp' && (
                <View className="mb-4">
                  <Text className="text-sm font-medium text-gray-700 mb-1.5">Confirm Password</Text>
                  <View className="relative">
                    <View className="absolute left-3 top-0 bottom-0 justify-center z-10">
                      <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" />
                    </View>
                    <TextInput
                      className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-12 py-3 text-gray-900 text-base"
                      placeholder="Confirm your password"
                      placeholderTextColor="#9ca3af"
                      secureTextEntry={!showPassword}
                      value={confirmPassword}
                      onChangeText={(text) => {
                        setConfirmPassword(text);
                        if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined });
                      }}
                    />
                  </View>
                  {errors.confirmPassword && (
                    <Text className="mt-1 text-sm text-red-500">{errors.confirmPassword}</Text>
                  )}
                </View>
              )}

              {/* Forgot Password Link - Only in sign in mode */}
              {authMode === 'signIn' && (
                <TouchableOpacity 
                  className="self-end mb-6"
                  onPress={() => switchAuthMode('forgotPassword')}
                >
                  <Text className="text-primary-600 font-medium">Forgot Password?</Text>
                </TouchableOpacity>
              )}

              {/* Back to Sign In - In forgot password mode */}
              {authMode === 'forgotPassword' && (
                <TouchableOpacity 
                  className="self-start mb-6"
                  onPress={() => switchAuthMode('signIn')}
                >
                  <Text className="text-primary-600 font-medium">← Back to Sign In</Text>
                </TouchableOpacity>
              )}

              {/* Submit Button */}
              <View className={authMode === 'signIn' ? '' : 'mb-6'}>
                <Button
                  variant="primary"
                  fullWidth
                  loading={isLoading}
                  disabled={isLoading}
                  onPress={handleSubmit}
                >
                  {getSubmitButtonText()}
                </Button>
              </View>
            </View>

            {/* Social Login - Only in sign in and sign up modes */}
            {authMode !== 'forgotPassword' && (
              <>
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
                    onPress={handleGoogleLogin}
                    disabled={isLoading}
                  >
                    <Ionicons name="logo-google" size={22} color="#EA4335" />
                    <Text className="ml-2 font-semibold text-gray-700">Google</Text>
                  </TouchableOpacity>

                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      className="flex-1 flex-row items-center justify-center py-3.5 px-4 bg-black rounded-xl ml-2"
                      onPress={handleAppleLogin}
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
              </>
            )}

            {/* Sign Up / Sign In Link */}
            <View className="flex-row justify-center mt-auto pt-6">
              {authMode === 'signIn' ? (
                <>
                  <Text className="text-gray-500">Don't have an account? </Text>
                  <TouchableOpacity onPress={() => switchAuthMode('signUp')}>
                    <Text className="text-primary-600 font-semibold">Sign Up</Text>
                  </TouchableOpacity>
                </>
              ) : authMode === 'signUp' ? (
                <>
                  <Text className="text-gray-500">Already have an account? </Text>
                  <TouchableOpacity onPress={() => switchAuthMode('signIn')}>
                    <Text className="text-primary-600 font-semibold">Sign In</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
