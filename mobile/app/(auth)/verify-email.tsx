import { useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import { Button } from '../../components/ui/Button';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';

const CODE_LENGTH = 6;

export default function VerifyEmail() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const inputs = useRef<Array<TextInput | null>>([]);

  function handleChange(text: string, index: number) {
    const clean = text.replace(/[^0-9]/g, '');
    const next = [...digits];
    next[index] = clean.slice(-1);
    setDigits(next);
    if (clean && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  }

  function handleKeyPress(e: any, index: number) {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  async function handleVerify() {
    const code = digits.join('');
    if (code.length !== CODE_LENGTH) {
      Alert.alert('Enter the full code', `Enter all ${CODE_LENGTH} digits sent to your email.`);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await auth.verifyEmail(code);
      if (error || !data?.emailVerified) {
        Alert.alert('Verification failed', error ?? 'Incorrect code');
        return;
      }
      if (user) setUser({ ...user, emailVerified: true });
      router.replace(user?.onboardingComplete ? '/(tabs)' : '/(onboarding)/step-1');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      const { data, error } = await auth.resendVerification();
      if (error) {
        Alert.alert('Could not resend', error);
        return;
      }
      setDevCode(data?.devVerificationCode ?? null);
      Alert.alert('Code sent', data?.emailSent ? 'Check your email for the new code.' : 'A new code was generated.');
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>✉️</Text>
        </View>
        <Text style={styles.title}>Verify Your Identity</Text>
        <Text style={styles.subtitle}>
          We sent a {CODE_LENGTH}-digit code to {user?.email ?? 'your email'}. Enter it below to secure your
          account.
        </Text>

        <View style={styles.codeRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(r) => { inputs.current[i] = r; }}
              style={styles.codeBox}
              value={d}
              onChangeText={(t) => handleChange(t, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
            />
          ))}
        </View>

        {devCode && (
          <View style={styles.devNotice}>
            <Text style={styles.devNoticeText}>
              📧 Email delivery isn't configured yet — for testing, your code is <Text style={styles.devCode}>{devCode}</Text>
            </Text>
          </View>
        )}

        <Button title="Verify & Continue" onPress={handleVerify} loading={loading} style={styles.verifyBtn} />

        <TouchableOpacity onPress={handleResend} disabled={resending} style={styles.resendRow}>
          <Text style={styles.resendText}>
            Didn't receive the code? <Text style={styles.resendLink}>{resending ? 'Sending…' : 'Resend Code'}</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  content: { flex: 1, padding: Spacing.xl, alignItems: 'center', justifyContent: 'center' },
  icon: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.purple,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl,
  },
  iconText: { fontSize: 36 },
  title: { fontFamily: Fonts.bold, fontSize: 26, color: Colors.text.primary, marginBottom: Spacing.sm, textAlign: 'center' },
  subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
  codeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  codeBox: {
    width: 44, height: 56, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white, fontFamily: Fonts.bold, fontSize: 22, color: Colors.text.primary,
  },
  devNotice: { backgroundColor: Colors.orange + '15', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.orange + '40' },
  devNoticeText: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.secondary, lineHeight: 18, textAlign: 'center' },
  devCode: { fontFamily: Fonts.bold, color: Colors.orange },
  verifyBtn: { width: '100%', marginBottom: Spacing.lg },
  resendRow: { padding: Spacing.sm },
  resendText: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary },
  resendLink: { fontFamily: Fonts.semiBold, color: Colors.purple },
});
