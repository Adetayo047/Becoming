import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Colors, Fonts, Spacing } from '../../constants/theme';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  // Password reset requires email infrastructure — show confirmation UI
  // and handle on the backend when email service is wired up
  function handleReset() {
    if (!email.trim()) {
      Alert.alert('Enter your email address');
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.sentIcon}>
            <Text style={styles.sentEmoji}>📬</Text>
          </View>
          <Text style={styles.sentTitle}>Check your email</Text>
          <Text style={styles.sentSub}>
            If an account exists for{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
            {'\n'}you'll receive a reset link shortly.
          </Text>
          <Button
            title="Back to Sign In"
            onPress={() => router.replace('/(auth)/sign-in')}
            style={styles.btn}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.subtitle}>
          Enter your email and we'll send you a link to reset your password.
        </Text>

        <Input
          label="Email Address"
          placeholder="you@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          containerStyle={styles.input}
        />

        <Button title="Send Reset Link" onPress={handleReset} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  container: { flex: 1, padding: Spacing.lg },
  back: { marginBottom: Spacing.xl },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  title: { fontFamily: Fonts.bold, fontSize: 28, color: Colors.text.primary, marginBottom: Spacing.sm },
  subtitle: {
    fontFamily: Fonts.regular, fontSize: 15, color: Colors.text.secondary,
    lineHeight: 22, marginBottom: Spacing.xl,
  },
  input: { marginBottom: Spacing.lg },
  sentIcon: { alignItems: 'center', marginBottom: Spacing.xl, marginTop: Spacing.xxxl },
  sentEmoji: { fontSize: 64 },
  sentTitle: {
    fontFamily: Fonts.bold, fontSize: 24, color: Colors.text.primary,
    textAlign: 'center', marginBottom: Spacing.md,
  },
  sentSub: {
    fontFamily: Fonts.regular, fontSize: 15, color: Colors.text.secondary,
    textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xxl,
  },
  emailHighlight: { fontFamily: Fonts.semiBold, color: Colors.purple },
  btn: { marginTop: 'auto' },
});
