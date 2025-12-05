import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { UserProvider, useUser } from '../context/UserContext';
import ErrorBoundary from '../components/ErrorBoundary';
import { PRIMARY } from '../constants/colors';
import { usePushNotifications } from '../hooks/usePushNotifications';

function RootLayoutNav() {
  const { user, authUser, isLoading } = useUser();

  // Register for push notifications when user is authenticated
  usePushNotifications(authUser?.id);

  // Show loading screen while checking user state
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="event/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="artist/[id]" options={{ headerShown: false, gestureEnabled: true }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <UserProvider>
        <RootLayoutNav />
      </UserProvider>
    </ErrorBoundary>
  );
}
