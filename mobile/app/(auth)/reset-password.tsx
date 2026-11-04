import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Colors, Fonts, Spacing } from '../../constants/theme';

export default function ResetPassword() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = token.trim().length > 0 && newPassword.length >= 8 && newPassword === confirmPassword;

  async function handleReset() {
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords don’t match', 'Make sure both password fields match.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await auth.resetPassword(token.trim(), newPassword);
      if (error) {
        Alert.alert('Could not reset password', error);
        return;
      }
      Alert.alert('Password reset', 'You can now sign in with your new password.', [
        { text: 'Sign In', onPress: () => router.replace('/(auth)/sign-in') },
      ]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>Paste the reset code you were sent, then choose a new password.</Text>

        <Input
          label="Reset Code"
          placeholder="Paste your reset code"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          containerStyle={styles.input}
        />
        <Input
          label="New Password"
          placeholder="At least 8 characters"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          containerStyle={styles.input}
        />
        <Input
          label="Confirm New Password"
          placeholder="••••••••"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          containerStyle={styles.input}
        />

        <Button title="Reset Password" onPress={handleReset} loading={saving} disabled={!canSave} />
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
});
