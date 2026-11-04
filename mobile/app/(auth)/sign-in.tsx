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
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';

export default function SignIn() {
  const router = useRouter();
  const { setUser, setToken } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      Alert.alert('Missing Info', 'Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await auth.signIn(email.trim().toLowerCase(), password);

      if (error || !data) {
        Alert.alert('Sign In Failed', error ?? 'Invalid email or password.');
        return;
      }

      await saveToken(data.token);
      setToken(data.token);
      setUser(data.user);
      if (data.reactivated) {
        Alert.alert('Welcome back 👋', 'Your account is active again — your goals and history are right where you left them.');
      }

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
            <Text style={styles.title}>Welcome back 👋</Text>
            <Text style={styles.subtitle}>Sign in to continue building your future.</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Email Address"
              placeholder="you@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              label="Password"
              placeholder="Your password"
              value={password}
              onChangeText={setPassword}
              isPassword
            />
          </View>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            style={styles.forgotRow}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <Button title="Sign In" onPress={handleSignIn} loading={loading} style={styles.btn} />

          <View style={styles.signupRow}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/sign-up')}>
              <Text style={styles.signupLink}>Sign Up Free</Text>
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
  form: { gap: Spacing.md, marginBottom: Spacing.sm },
  forgotRow: { alignItems: 'flex-end', marginBottom: Spacing.lg },
  forgotText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.purple },
  btn: { marginBottom: Spacing.lg },
  signupRow: { flexDirection: 'row', justifyContent: 'center' },
  signupText: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary },
  signupLink: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.purple },
});
