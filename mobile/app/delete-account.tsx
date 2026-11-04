import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, KeyboardAvoidingView, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth, removeToken } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { Button } from '../components/ui/Button';
import { Colors, Fonts, Spacing, Radius } from '../constants/theme';

const LOSSES = [
  'Your yearly, monthly and weekly plans, goals and milestones.',
  'Streaks, badges and your Growth Passport history.',
  'Accountability partnerships, community posts and groups.',
  'Weekly reviews, reflections and your AI coach history.',
];

// Account deletion (Stitch: account_deletion_flow) — keep, delete for good
// (password-confirmed), or deactivate instead and keep everything.
export default function DeleteAccountScreen() {
  const router = useRouter();
  const { signOut } = useAuthStore();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  // The password box opens below the fold — bring it above the keyboard.
  const revealConfirm = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
  // The keyboard shrinks the view after it opens — scroll again once it's up.
  useEffect(() => {
    if (!confirming) return;
    const sub = Keyboard.addListener('keyboardDidShow', revealConfirm);
    return () => sub.remove();
  }, [confirming]);

  async function leave(message: string) {
    await removeToken();
    signOut();
    Alert.alert(message);
  }

  async function handleDelete() {
    if (!password) return;
    setBusy(true);
    const { error } = await auth.deleteAccount(password);
    setBusy(false);
    if (error) {
      Alert.alert('Could not delete account', error);
      return;
    }
    leave('Your account and all its data have been deleted.');
  }

  function handleDeactivate() {
    Alert.alert(
      'Deactivate your account?',
      "Your goals and history are kept, and all reminders and wake-up calls stop. Sign in again any time to pick up where you left off.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          onPress: async () => {
            setBusy(true);
            const { error } = await auth.deactivate();
            setBusy(false);
            if (error) {
              Alert.alert('Could not deactivate', error);
              return;
            }
            leave('Your account is deactivated. Sign in any time to come back.');
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.brand}>Becoming</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>💔</Text>
          </View>
          <Text style={styles.title}>Pausing Your Journey?</Text>
          <Text style={styles.subtitle}>
            We're sorry to see you go. Deleting your account will permanently remove all your growth data, goals, and history.
          </Text>

          <View style={styles.lossCard}>
            <Text style={styles.lossLabel}>WHAT YOU'LL LOSE FOREVER:</Text>
            {LOSSES.map((l) => (
              <View key={l} style={styles.lossRow}>
                <View style={styles.lossIcon}><Text style={styles.lossIconText}>✕</Text></View>
                <Text style={styles.lossText}>{l}</Text>
              </View>
            ))}
          </View>

          {confirming ? (
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Confirm with your password</Text>
              <Text style={styles.confirmSub}>This can't be undone.</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={Colors.text.muted}
                secureTextEntry
                autoFocus
                onFocus={revealConfirm}
                onSubmitEditing={handleDelete}
              />
              <TouchableOpacity
                style={[styles.deleteForever, (!password || busy) && styles.disabled]}
                onPress={handleDelete}
                disabled={!password || busy}
              >
                <Text style={styles.deleteForeverText}>{busy ? 'Deleting…' : 'Permanently Delete'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setConfirming(false); setPassword(''); }} style={styles.cancelLink}>
                <Text style={styles.cancelLinkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Button title="Keep My Account ↗" onPress={() => router.back()} style={styles.keepBtn} />
              <Button title="Delete My Account" variant="secondary" onPress={() => { setConfirming(true); revealConfirm(); }} disabled={busy} />
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Need a break without losing data? You can{' '}
              <Text style={styles.footerLink} onPress={busy ? undefined : handleDeactivate}>Deactivate Instead</Text>.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { fontSize: 24, color: Colors.purple },
  brand: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.purple },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, alignItems: 'stretch' },
  iconCircle: { alignSelf: 'center', width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.surfaceContainer, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg, marginBottom: Spacing.lg },
  icon: { fontSize: 40 },
  title: { fontFamily: Fonts.bold, fontSize: 26, color: Colors.text.primary, textAlign: 'center', marginBottom: Spacing.sm },
  subtitle: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.text.secondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
  lossCard: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.xl },
  lossLabel: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.purple, letterSpacing: 0.8, marginBottom: Spacing.md },
  lossRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md },
  lossIcon: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: Colors.error, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md, marginTop: 1 },
  lossIconText: { fontSize: 11, color: Colors.error, fontFamily: Fonts.bold },
  lossText: { flex: 1, fontFamily: Fonts.regular, fontSize: 15, color: Colors.text.primary, lineHeight: 22 },
  keepBtn: { marginBottom: Spacing.md },
  confirmCard: { backgroundColor: Colors.white, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.error + '40', padding: Spacing.lg },
  confirmTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary },
  confirmSub: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.error, marginTop: 2, marginBottom: Spacing.md },
  input: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.text.primary, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, backgroundColor: Colors.surfaceContainerLow, marginBottom: Spacing.md },
  deleteForever: { backgroundColor: Colors.error, borderRadius: Radius.full, paddingVertical: 14, alignItems: 'center' },
  deleteForeverText: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.white },
  disabled: { opacity: 0.5 },
  cancelLink: { alignItems: 'center', paddingTop: Spacing.md },
  cancelLinkText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.secondary },
  footer: { backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.xl },
  footerText: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary, textAlign: 'center', lineHeight: 19 },
  footerLink: { fontFamily: Fonts.semiBold, color: Colors.purple },
});
