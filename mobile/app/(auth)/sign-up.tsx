import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
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
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Enter your name';
    if (!email.trim() || !email.includes('@')) errs.email = 'Enter a valid email';
    if (password.length < 8) errs.password = 'Password must be at least 8 characters';
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
        fullName.trim()
      );

      if (error || !data) {
        Alert.alert('Sign Up Failed', error ?? 'Something went wrong. Try again.');
        return;
      }

      await saveToken(data.token);
      setToken(data.token);
      setUser(data.user);

      // Navigate based on onboarding status
      if (!data.user.onboardingComplete) {
        router.replace('/(onboarding)/step-1');
      } else {
        router.replace('/(tabs)');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

          <Button title="Create Account" onPress={handleSignUp} loading={loading} style={styles.btn} />

          <Text style={styles.terms}>
            By creating an account, you agree to our{' '}
            <Text style={styles.link}>Terms of Service</Text> and{' '}
            <Text style={styles.link}>Privacy Policy</Text>.
          </Text>

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
  terms: {
    fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted,
    textAlign: 'center', lineHeight: 18, marginBottom: Spacing.lg,
  },
  link: { color: Colors.purple },
  signinRow: { flexDirection: 'row', justifyContent: 'center' },
  signinText: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary },
  signinLink: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.purple },
});
