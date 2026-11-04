import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth, saveToken } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Colors, Fonts, Spacing } from '../../constants/theme';

export default function SignUp() {
  const router = useRouter();
  const { setUser, setToken } = useAuthStore();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Enter your name';
    if (!email.trim() || !email.includes('@')) errs.email = 'Enter a valid email';
    if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (!termsAccepted) errs.terms = 'You must accept the Terms of Service and Privacy Policy';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSignUp() {
    if (!validate()) return;
    setLoading(true);
    try {
      const { data, error } = await auth.signUp(
        email.trim().toLowerCase(),
        password,
        fullName.trim(),
        termsAccepted
      );

      if (error || !data) {
        Alert.alert('Sign Up Failed', error ?? 'Something went wrong. Try again.');
        return;
      }

      await saveToken(data.token);
      setToken(data.token);
      setUser(data.user);

      if (data.devVerificationCode) {
        Alert.alert(
          'Email delivery not configured',
          `For testing, your verification code is ${data.devVerificationCode}.`
        );
      }

      router.replace('/(auth)/verify-email');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              Join thousands of ambitious Nigerians building their future.
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Full Name"
              placeholder="Philip Adetunji"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              error={errors.fullName}
            />
            <Input
              label="Email Address"
              placeholder="you@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
            />
            <Input
              label="Password"
              placeholder="Min. 8 characters"
              value={password}
              onChangeText={setPassword}
              isPassword
              error={errors.password}
            />
          </View>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setTermsAccepted((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
              {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.terms}>
              I agree to the{' '}
              <Text style={styles.link} onPress={() => router.push('/(auth)/terms')}>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text style={styles.link} onPress={() => router.push('/(auth)/terms')}>
                Privacy Policy
              </Text>
              .
            </Text>
          </TouchableOpacity>
          {errors.terms && <Text style={styles.errorText}>{errors.terms}</Text>}

          <Button title="Create Account" onPress={handleSignUp} loading={loading} style={styles.btn} />

          <View style={styles.signinRow}>
            <Text style={styles.signinText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')}>
              <Text style={styles.signinLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  flex: { flex: 1 },
  container: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  back: { marginBottom: Spacing.lg },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  header: { marginBottom: Spacing.xl },
  title: { fontFamily: Fonts.bold, fontSize: 28, color: Colors.text.primary, marginBottom: Spacing.sm },
  subtitle: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.text.secondary, lineHeight: 22 },
  form: { gap: Spacing.md, marginBottom: Spacing.lg },
  btn: { marginBottom: Spacing.md },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  checkboxChecked: { backgroundColor: Colors.purple, borderColor: Colors.purple },
  checkmark: { color: Colors.white, fontSize: 13, fontFamily: Fonts.bold },
  errorText: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.error, marginBottom: Spacing.sm },
  terms: {
    flex: 1, fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted, lineHeight: 18,
  },
  link: { color: Colors.purple },
  signinRow: { flexDirection: 'row', justifyContent: 'center' },
  signinText: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary },
  signinLink: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.purple },
});
