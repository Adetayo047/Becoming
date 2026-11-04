import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { auth, notifications, AiPersonality, ProgressVisibility } from '../lib/api';
import { useAuthStore, usePrefsStore } from '../lib/store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TimePickerField } from '../components/ui/TimePickerField';
import { Colors, Fonts, Spacing, Radius, PERSONALITY_META } from '../constants/theme';

const FREQUENCIES: { key: 'sparse' | 'balanced' | 'high_intensity'; label: string }[] = [
  { key: 'sparse', label: 'Sparse' },
  { key: 'balanced', label: 'Balanced' },
  { key: 'high_intensity', label: 'High Intensity' },
];

const PERSONALITIES = Object.entries(PERSONALITY_META) as [AiPersonality, typeof PERSONALITY_META[AiPersonality]][];

const VISIBILITIES: { key: ProgressVisibility; label: string; sub: string }[] = [
  { key: 'only_me', label: 'Only Me', sub: 'Nobody else can see your progress' },
  { key: 'trusted', label: 'Trusted Connections', sub: 'Your accountability partner can see it' },
  { key: 'community', label: 'The Community', sub: "You're discoverable in Community suggestions" },
];

export default function NotificationsSettings() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [toggling, setToggling] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const { quickTalkEnabled, setQuickTalkEnabled } = usePrefsStore();

  async function handleFrequency(freq: 'sparse' | 'balanced' | 'high_intensity') {
    setSavingPrefs(true);
    try {
      const { data } = await auth.updateMe({ nudgeFrequency: freq });
      if (data) setUser(data);
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleStoicMode(value: boolean) {
    setSavingPrefs(true);
    try {
      const { data } = await auth.updateMe({ stoicMode: value });
      if (data) setUser(data);
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handlePersonality(personality: AiPersonality) {
    setSavingPrefs(true);
    try {
      const { data } = await auth.updateMe({ aiPersonality: personality });
      if (data) setUser(data);
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleFocusHours(start: string, end: string) {
    setSavingPrefs(true);
    try {
      const { data } = await auth.updateMe({ focusHoursStart: start, focusHoursEnd: end });
      if (data) setUser(data);
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleVisibility(visibility: ProgressVisibility) {
    setSavingPrefs(true);
    try {
      const { data } = await auth.updateMe({ progressVisibility: visibility });
      if (data) setUser(data);
    } finally {
      setSavingPrefs(false);
    }
  }

  // getTimezoneOffset() is minutes WEST of UTC (e.g. -60 for UTC+1, Lagos) —
  // negate it so the server can do `localTime = utcNow + utcOffsetMinutes`.
  function currentUtcOffsetMinutes() {
    return -new Date().getTimezoneOffset();
  }

  async function handleWakeUpCallToggle(value: boolean) {
    setSavingPrefs(true);
    try {
      const { data, error, upgrade } = await auth.updateMe({
        wakeUpCallEnabled: value,
        wakeUpCallTime: user?.wakeUpCallTime ?? '07:00',
        utcOffsetMinutes: currentUtcOffsetMinutes(),
      });
      if (upgrade) return;
      if (error) {
        Alert.alert('Could not update', error);
        return;
      }
      if (data) setUser(data);
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleWakeUpCallTime(time: string) {
    setSavingPrefs(true);
    try {
      const { data } = await auth.updateMe({ wakeUpCallTime: time, utcOffsetMinutes: currentUtcOffsetMinutes() });
      if (data) setUser(data);
    } finally {
      setSavingPrefs(false);
    }
  }

  async function registerForPush(): Promise<string | null> {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Enable notifications in your device settings to get reminders.');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId || projectId === 'YOUR_EAS_PROJECT_ID') {
      Alert.alert(
        'One more setup step',
        'Push notifications need a real EAS project (run `eas init` in the mobile/ folder) before a device token can be issued. Your preference is saved — this will start working once that\'s set up.'
      );
      return null;
    }

    try {
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
      return data;
    } catch {
      Alert.alert('Could not get a push token', 'Try again once the EAS project is fully configured.');
      return null;
    }
  }

  async function handleToggle(value: boolean) {
    setToggling(true);
    try {
      let pushToken: string | undefined;
      if (value) {
        const token = await registerForPush();
        if (token) pushToken = token;
      }
      const { data, error } = await auth.updateMe({ notificationsEnabled: value, ...(pushToken && { pushToken }) });
      if (error || !data) {
        Alert.alert('Could not update setting', error ?? 'Try again.');
        return;
      }
      setUser(data);
    } finally {
      setToggling(false);
    }
  }

  async function handleSendTest() {
    setSendingTest(true);
    try {
      const { error } = await notifications.sendTest();
      if (error) {
        Alert.alert('Could not send test notification', error);
        return;
      }
      Alert.alert('Sent!', 'Check your device for the notification.');
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/notification-hub')}>
          <Text style={styles.historyLink}>History →</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Smart Nudges 🔔</Text>
        <Text style={styles.subtitle}>Get a nudge when you complete all of today's tasks.</Text>

        <Card style={styles.row} variant="default">
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>Daily celebration alerts</Text>
            <Text style={styles.rowSub}>Notify me when I finish everything for the day</Text>
          </View>
          {toggling ? (
            <ActivityIndicator color={Colors.purple} />
          ) : (
            <Switch
              value={user?.notificationsEnabled ?? false}
              onValueChange={handleToggle}
              trackColor={{ true: Colors.purple, false: Colors.grey[300] }}
              thumbColor={Colors.white}
            />
          )}
        </Card>

        <Card style={styles.row} variant="default">
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>Stoic Mode</Text>
            <Text style={styles.rowSub}>Discipline & resilience focused nudges</Text>
          </View>
          {savingPrefs ? (
            <ActivityIndicator color={Colors.purple} />
          ) : (
            <Switch
              value={user?.stoicMode ?? false}
              onValueChange={handleStoicMode}
              trackColor={{ true: Colors.orange, false: Colors.grey[300] }}
              thumbColor={Colors.white}
            />
          )}
        </Card>

        <Text style={styles.inputLabel}>Nudge Frequency</Text>
        <View style={styles.freqRow}>
          {FREQUENCIES.map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => handleFrequency(f.key)}
              style={[styles.freqChip, user?.nudgeFrequency === f.key && styles.freqChipActive]}
            >
              <Text style={[styles.freqChipText, user?.nudgeFrequency === f.key && styles.freqChipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          title="Send test notification"
          onPress={handleSendTest}
          loading={sendingTest}
          variant="secondary"
          style={styles.testBtn}
        />

        <Text style={styles.sectionTitle}>AI Personality</Text>
        <Text style={styles.sectionSub}>Choose how your AI coach communicates progress and insights to you.</Text>
        <View style={styles.personalityGrid}>
          {PERSONALITIES.map(([key, meta]) => {
            const active = user?.aiPersonality === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => handlePersonality(key)}
                style={[styles.personalityCard, active && styles.personalityCardActive]}
                activeOpacity={0.8}
              >
                <Text style={styles.personalityEmoji}>{meta.emoji}</Text>
                <Text style={[styles.personalityLabel, active && styles.personalityLabelActive]}>{meta.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>PREVIEW</Text>
          <Text style={styles.previewText}>
            "{PERSONALITY_META[user?.aiPersonality ?? 'encouraging'].preview}"
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Focus Hours</Text>
        <Text style={styles.sectionSub}>Push alerts are muted during this window (still logged in your Notification Hub).</Text>
        <View style={styles.focusRow}>
          <TimePickerField
            label="Start Time"
            value={user?.focusHoursStart ?? ''}
            onChange={(v) => handleFocusHours(v, user?.focusHoursEnd ?? '06:00')}
            containerStyle={styles.focusField}
          />
          <TimePickerField
            label="End Time"
            value={user?.focusHoursEnd ?? ''}
            onChange={(v) => handleFocusHours(user?.focusHoursStart ?? '22:00', v)}
            containerStyle={styles.focusField}
          />
        </View>

        <Text style={styles.sectionTitle}>Privacy</Text>
        <Text style={styles.sectionSub}>Who can see my progress?</Text>
        {VISIBILITIES.map((v) => {
          const active = user?.progressVisibility === v.key;
          return (
            <TouchableOpacity key={v.key} onPress={() => handleVisibility(v.key)} activeOpacity={0.8}>
              <Card style={{ ...styles.row, ...(active ? styles.rowActive : {}) }} variant="default">
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>{v.label}</Text>
                  <Text style={styles.rowSub}>{v.sub}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active && <View style={styles.radioDot} />}
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}

        <Text style={styles.sectionTitle}>Wake-Up Call 📞</Text>
        <Text style={styles.sectionSub}>
          The AI Architect calls you in-app at this time each day to plan your goals out loud.
        </Text>
        <Card style={styles.row} variant="default">
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>Enable Wake-Up Call</Text>
            <Text style={styles.rowSub}>Sends a notification that opens the call screen</Text>
          </View>
          {savingPrefs ? (
            <ActivityIndicator color={Colors.purple} />
          ) : (
            <Switch
              value={user?.wakeUpCallEnabled ?? false}
              onValueChange={handleWakeUpCallToggle}
              trackColor={{ true: Colors.purple, false: Colors.grey[300] }}
              thumbColor={Colors.white}
            />
          )}
        </Card>
        {user?.wakeUpCallEnabled && (
          <>
            <TimePickerField
              label="Call Time"
              value={user?.wakeUpCallTime ?? ''}
              onChange={handleWakeUpCallTime}
              containerStyle={{ marginBottom: Spacing.md }}
            />
            <TouchableOpacity onPress={() => router.push('/wake-up-call')} style={styles.previewCallBtn}>
              <Text style={styles.previewCallBtnText}>▶ Preview the call now</Text>
            </TouchableOpacity>
          </>
        )}

        <Card style={styles.row} variant="default">
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>Quick-Talk Button 🎙️</Text>
            <Text style={styles.rowSub}>A floating button on every screen — tap it anytime to talk, on demand</Text>
          </View>
          <Switch
            value={quickTalkEnabled}
            onValueChange={setQuickTalkEnabled}
            trackColor={{ true: Colors.purple, false: Colors.grey[300] }}
            thumbColor={Colors.white}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  historyLink: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.purple },
  container: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  title: { fontFamily: Fonts.bold, fontSize: 24, color: Colors.text.primary, marginBottom: Spacing.sm },
  subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary, lineHeight: 20, marginBottom: Spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, marginBottom: Spacing.lg },
  rowBody: { flex: 1, marginRight: Spacing.md },
  rowLabel: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.text.primary },
  rowSub: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted, marginTop: 2 },
  testBtn: { marginTop: Spacing.sm },
  inputLabel: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.primary, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  freqRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  freqChip: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  freqChipActive: { backgroundColor: Colors.purple, borderColor: Colors.purple },
  freqChipText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.secondary },
  freqChipTextActive: { color: Colors.white },

  sectionTitle: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.text.primary, marginTop: Spacing.xl, marginBottom: 4 },
  sectionSub: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.muted, marginBottom: Spacing.md, lineHeight: 18 },

  personalityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  personalityCard: {
    width: '31%', alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white, gap: 6,
  },
  personalityCardActive: { borderColor: Colors.purple, backgroundColor: Colors.purple + '10' },
  personalityEmoji: { fontSize: 22 },
  personalityLabel: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.text.secondary },
  personalityLabelActive: { color: Colors.purple, fontFamily: Fonts.semiBold },
  previewCard: { backgroundColor: Colors.purple + '10', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  previewLabel: { fontFamily: Fonts.semiBold, fontSize: 10, color: Colors.purple, letterSpacing: 0.6, marginBottom: 4 },
  previewText: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.primary, fontStyle: 'italic', lineHeight: 19 },

  focusRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm },
  focusField: { flex: 1 },

  rowActive: { borderWidth: 1.5, borderColor: Colors.purple },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: Colors.purple },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.purple },
  previewCallBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  previewCallBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.purple },
});
