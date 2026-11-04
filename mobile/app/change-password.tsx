import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Colors, Fonts, Spacing } from '../constants/theme';

export default function ChangePassword() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword;

  async function handleSave() {
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords don’t match', 'Make sure both new password fields match.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await auth.changePassword(currentPassword, newPassword);
      if (error) {
        Alert.alert('Could not change password', error);
        return;
      }
      Alert.alert('Password updated', 'Your password has been changed.', [
        { text: 'OK', onPress: () => router.back() },
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

        <Text style={styles.title}>Change password</Text>
        <Text style={styles.subtitle}>Enter your current password and choose a new one.</Text>

        <Input
          label="Current Password"
          placeholder="••••••••"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
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

        <Button title="Update Password" onPress={handleSave} loading={saving} disabled={!canSave} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  container: { flex: 1, padding: Spacing.lg },
  back: { marginBottom: Spacing.xl },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  title: { fontFamily: Fonts.bold, fontSize: 26, color: Colors.text.primary, marginBottom: Spacing.sm },
  subtitle: {
    fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary,
    lineHeight: 20, marginBottom: Spacing.xl,
  },
  input: { marginBottom: Spacing.lg },
});
