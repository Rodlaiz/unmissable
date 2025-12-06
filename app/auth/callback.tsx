import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase, syncUserProfile } from '../../services/supabase';
import { useUser } from '../../context/UserContext';
import { PRIMARY } from '../../constants/colors';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { user, isLoading: userLoading } = useUser();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Wait a moment for the auth state to be processed
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if we have a session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          router.replace('/login');
          return;
        }

        if (session?.user) {
          // Sync user profile to Supabase users table
          await syncUserProfile(session.user);
          setIsProcessing(false);
        } else {
          // No session, redirect to login
          router.replace('/login');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        router.replace('/login');
      }
    };

    handleCallback();
  }, []);

  // Once we have a session and user context is loaded, navigate
  useEffect(() => {
    if (!isProcessing && !userLoading && user) {
      if (user.hasOnboarded) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    }
  }, [isProcessing, userLoading, user]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color={PRIMARY} />
      <Text className="mt-4 text-gray-500">Completing sign in...</Text>
    </View>
  );
}
