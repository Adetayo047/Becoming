import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { onboarding, accountability } from '../../lib/api';
import { useAuthStore, useOnboardingStore } from '../../lib/store';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StepIndicator } from '../../components/onboarding/StepIndicator';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';

export default function OnboardingStep3() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const { firstGoalTitle, firstGoalCategory, reset } = useOnboardingStore();
  const [loading, setLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [partnerEmail, setPartnerEmail] = useState('');
  const [inviteError, setInviteError] = useState('');

  async function handleInviteAndContinue() {
    if (!partnerEmail.trim()) return;
    setLoading(true);
    setInviteError('');
    try {
      const { error } = await accountability.invite(partnerEmail.trim());
      if (error) {
        setInviteError(error);
        return;
      }
      await completeOnboarding();
    } finally {
      setLoading(false);
    }
  }

  async function completeOnboarding() {
    setLoading(true);
    try {
      const { data, error } = await onboarding.complete({
        goalTitle: firstGoalTitle,
        goalCategory: firstGoalCategory,
      });

      if (error || !data) {
        Alert.alert('Error', error ?? 'Could not complete setup. Try again.');
        return;
      }

      setUser(data.user);
      reset();
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <StepIndicator total={3} current={3} />
          <Text style={styles.stepLabel}>Step 3 of 3</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.emoji}>🤝</Text>
            <Text style={styles.title}>Want an accountability partner?</Text>
            <Text style={styles.subtitle}>
              People with accountability partners are{' '}
              <Text style={styles.highlight}>65% more likely</Text> to achieve their goals.
              You can skip this and add one later.
            </Text>
          </View>

          <View style={styles.partnerCard}>
            <View style={styles.partnerAvatarRow}>
              <View style={[styles.avatar, { backgroundColor: Colors.purpleLight }]}>
                <Text style={styles.avatarText}>Y</Text>
              </View>
              <View style={styles.arrow}>
                <Text style={styles.arrowText}>↔</Text>
              </View>
              <View style={[styles.avatar, { backgroundColor: Colors.orangeLight }]}>
                <Text style={styles.avatarText}>?</Text>
              </View>
            </View>
            <Text style={styles.partnerTitle}>How it works</Text>
            {[
              '✅  They see your weekly progress',
              '💬  They can leave check-in notes',
              '🎉  They celebrate your wins',
            ].map((item) => (
              <Text key={item} style={styles.partnerItem}>{item}</Text>
            ))}
          </View>

          <View style={styles.quoteCard}>
            <Text style={styles.quote}>
              "Having someone check in on me changed everything. I didn't want to report back with nothing done."
            </Text>
            <Text style={styles.quoteAuthor}>— Beta user, Lagos</Text>
          </View>
        </View>

        <View style={styles.cta}>
          {loading ? (
            <ActivityIndicator color={Colors.purple} size="large" />
          ) : showInvite ? (
            <>
              <Input
                label="Partner's email"
                placeholder="friend@email.com"
                value={partnerEmail}
                onChangeText={(t) => { setPartnerEmail(t); setInviteError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                error={inviteError}
                containerStyle={styles.inviteInput}
              />
              <Button title="Send Invite & Continue" onPress={handleInviteAndContinue} disabled={!partnerEmail.trim()} />
              <Button
                title="← Back"
                onPress={() => setShowInvite(false)}
                variant="ghost"
                style={styles.skipBtn}
              />
            </>
          ) : (
            <>
              <Button title="Invite Partner" onPress={() => setShowInvite(true)} />
              <Button
                title="Skip for now →"
                onPress={completeOnboarding}
                variant="ghost"
                style={styles.skipBtn}
              />
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  back: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.purple },
  stepLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.muted },
  content: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  header: { marginBottom: Spacing.xl },
  emoji: { fontSize: 40, marginBottom: Spacing.md },
  title: { fontFamily: Fonts.bold, fontSize: 24, color: Colors.text.primary, lineHeight: 32, marginBottom: Spacing.sm },
  subtitle: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.text.secondary, lineHeight: 22 },
  highlight: { fontFamily: Fonts.semiBold, color: Colors.orange },
  partnerCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  partnerAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.white },
  arrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.grey[100], alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 16, color: Colors.text.muted },
  partnerTitle: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.text.primary, marginBottom: Spacing.md },
  partnerItem: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary, marginBottom: Spacing.sm, lineHeight: 20 },
  quoteCard: {
    backgroundColor: Colors.purple + '10',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.purple,
  },
  quote: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary, lineHeight: 20, fontStyle: 'italic', marginBottom: Spacing.sm },
  quoteAuthor: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.purple },
  cta: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cream,
    gap: Spacing.xs,
  },
  skipBtn: { paddingVertical: Spacing.sm },
  inviteInput: { marginBottom: Spacing.sm },
});
