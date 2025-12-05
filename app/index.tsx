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

  // Redirect based on onboarding status
  if (user?.hasOnboarded) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/onboarding" />;
}
