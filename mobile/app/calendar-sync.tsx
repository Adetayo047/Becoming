import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { auth, calendar } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Colors, Fonts, Spacing } from '../constants/theme';

export default function CalendarSync() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function refreshUser() {
    const { data } = await auth.me();
    if (data) setUser(data);
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const url = await calendar.connectUrl();
      const result = await WebBrowser.openAuthSessionAsync(url, 'becoming://calendar-connect');

      if (result.type === 'success' && result.url) {
        const status = new URL(result.url).searchParams.get('status');
        if (status === 'success') {
          await refreshUser();
          Alert.alert('Connected!', 'Your Google Calendar is now linked.');
        } else if (status === 'denied') {
          // user cancelled — nothing to do
        } else {
          Alert.alert(
            'Could not connect',
            status === 'expired'
              ? 'That took too long — try again.'
              : 'Calendar sync may not be fully configured yet.'
          );
        }
      }
    } catch {
      Alert.alert('Could not connect', 'Something went wrong opening the Google sign-in page.');
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await calendar.disconnect();
      await refreshUser();
    } finally {
      setDisconnecting(false);
    }
  }

  const connected = user?.googleCalendarConnected ?? false;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <Text style={styles.title}>Calendar Sync 📅</Text>
        <Text style={styles.subtitle}>
          Connect your Google Calendar so your daily tasks can get a reminder on your own calendar.
        </Text>

        <Card style={styles.statusCard} variant={connected ? 'default' : 'outlined'}>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: connected ? Colors.success : Colors.grey[400] }]} />
            <Text style={styles.statusText}>{connected ? 'Connected' : 'Not connected'}</Text>
          </View>
          {connected && <Text style={styles.statusSub}>{user?.email}'s Google Calendar</Text>}
        </Card>

        {connecting || disconnecting ? (
          <ActivityIndicator color={Colors.purple} style={styles.loading} />
        ) : connected ? (
          <Button title="Disconnect" variant="secondary" onPress={handleDisconnect} />
        ) : (
          <Button title="Connect Google Calendar" onPress={handleConnect} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  container: { flex: 1, padding: Spacing.lg },
  title: { fontFamily: Fonts.bold, fontSize: 24, color: Colors.text.primary, marginBottom: Spacing.sm },
  subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary, lineHeight: 20, marginBottom: Spacing.xl },
  statusCard: { padding: Spacing.md, marginBottom: Spacing.xl },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.text.primary },
  statusSub: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted, marginTop: 4, marginLeft: Spacing.md + Spacing.xs },
  loading: { marginTop: Spacing.md },
});
