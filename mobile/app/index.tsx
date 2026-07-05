import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../lib/store';
import { Colors } from '../constants/theme';

export default function Index() {
  const router = useRouter();
  const { user, token, loading } = useAuthStore();

  useEffect(() => {
    if (loading) return;

    if (!token) {
      router.replace('/(auth)/welcome');
      return;
    }

    if (user && !user.onboardingComplete) {
      router.replace('/(onboarding)/step-1');
      return;
    }

    router.replace('/(tabs)');
  }, [token, user, loading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.purple} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream, alignItems: 'center', justifyContent: 'center' },
});
