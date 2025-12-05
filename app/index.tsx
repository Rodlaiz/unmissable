import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useUser } from '../context/UserContext';
import { PRIMARY } from '../constants/colors';

export default function Index() {
  const { user, isLoading } = useUser();

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  // If user has completed onboarding, go to main app
  if (user?.hasOnboarded) {
    return <Redirect href="/(tabs)" />;
  }

  // If user has seen login but hasn't onboarded, continue to onboarding
  if (user?.hasSeenLogin && !user.hasOnboarded) {
    return <Redirect href="/onboarding" />;
  }

  // New users go to login screen first
  return <Redirect href="/login" />;
}
