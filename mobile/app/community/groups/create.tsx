import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { community } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Colors, Fonts, Spacing } from '../../../constants/theme';

export default function CreateGroup() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [emailsText, setEmailsText] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const memberEmails = emailsText
        .split(/[,\n]/)
        .map((e) => e.trim())
        .filter(Boolean);

      const { data, error, upgrade } = await community.groups.create(name.trim(), memberEmails);
      if (upgrade) return;
      if (error || !data) {
        Alert.alert('Could not create group', error ?? 'Try again.');
        return;
      }
      if (data.skippedEmails && data.skippedEmails.length > 0) {
        Alert.alert(
          'Group created',
          `These emails don't have a Becoming account yet, so they weren't added: ${data.skippedEmails.join(', ')}`
        );
      }
      router.replace(`/community/groups/${data.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Start a Mastermind Group</Text>
        <Text style={styles.subtitle}>Get matched with a few like-minded peers for weekly progress syncs.</Text>

        <Input
          label="Group Name"
          placeholder="e.g. The Deep Work Collective"
          value={name}
          onChangeText={setName}
          containerStyle={styles.input}
        />
        <Input
          label="Invite members by email"
          placeholder="One per line, or comma-separated"
          value={emailsText}
          onChangeText={setEmailsText}
          multiline
          numberOfLines={4}
          autoCapitalize="none"
          keyboardType="email-address"
          containerStyle={styles.input}
        />
        <Text style={styles.hint}>They need an existing Becoming account — otherwise we'll skip them and let you know.</Text>

        <Button title="Create Group" onPress={handleCreate} loading={creating} disabled={!name.trim()} style={styles.createBtn} />
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
  subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary, lineHeight: 20, marginBottom: Spacing.xl },
  input: { marginBottom: Spacing.md },
  hint: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted, marginBottom: Spacing.xl },
  createBtn: { marginTop: Spacing.md },
});
