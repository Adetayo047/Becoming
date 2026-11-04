import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { auth, getToken, ApiUser } from '../lib/api';
import { useAuthStore } from '../lib/store';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const router = useRouter();
  const { setUser, setToken, setLoading } = useAuthStore();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    async function restoreSession() {
      try {
        const token = await getToken();
        if (!token) return;

        setToken(token);
        const { data: user, error } = await auth.me();
        if (user && !error) {
          setUser(user as ApiUser);
        }
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Deep-links a tapped push notification (e.g. the Wake-Up Call) to its
  // actionUrl even when the app was fully closed or backgrounded — tapping
  // the row inside the in-app Notification Hub already does this via its
  // own onPress; this covers a tap on the OS notification itself.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const actionUrl = response.notification.request.content.data?.actionUrl as string | undefined;
      if (actionUrl) router.push(actionUrl as any);
    });

    // The app can also be launched BY tapping a notification (cold start) —
    // addNotificationResponseReceivedListener alone misses that case.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const actionUrl = response?.notification.request.content.data?.actionUrl as string | undefined;
      if (actionUrl) router.push(actionUrl as any);
    });

    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
