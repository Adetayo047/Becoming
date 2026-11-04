import { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { usePrefsStore } from '../../lib/store';
import { Colors, Shadow } from '../../constants/theme';

// Floating entry point to the voice conversation — tap it anywhere in the
// app and it goes straight into listening mode (see app/wake-up-call.tsx),
// no "incoming call" ceremony. Visibility is a per-device UI preference
// (usePrefsStore, AsyncStorage-backed) toggled in Settings, not account
// state worth syncing across devices.
export function QuickTalkButton() {
  const router = useRouter();
  const { quickTalkEnabled, hydrated, hydrate } = usePrefsStore();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  if (!hydrated || !quickTalkEnabled) return null;

  return (
    <TouchableOpacity
      style={styles.button}
      activeOpacity={0.85}
      onPress={() => router.push('/wake-up-call')}
      accessibilityLabel="Talk to your AI Architect"
    >
      <Text style={styles.icon}>🎙️</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 16,
    bottom: 96, // clears the 80px tab bar + a little breathing room
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  icon: { fontSize: 24 },
});
