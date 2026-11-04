import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Alert, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { accountability, ApiPartnership } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { shareAppInvite } from '../lib/invite';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Colors, Fonts, Spacing, Radius } from '../constants/theme';

export default function Accountability() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [partnerships, setPartnerships] = useState<ApiPartnership[]>([]);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pokingId, setPokingId] = useState<string | null>(null);
  const [pokeMessage, setPokeMessage] = useState('');
  const [sendingPoke, setSendingPoke] = useState(false);

  const load = useCallback(async () => {
    const { data } = await accountability.list();
    if (data) setPartnerships(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function handleInvite() {
    if (!email.trim()) return;
    setInviting(true);
    try {
      const { error, upgrade } = await accountability.invite(email.trim());
      if (upgrade) return;
      if (error?.includes('need to sign up first')) {
        Alert.alert(
          'Not on Becoming yet',
          `${email.trim()} doesn't have an account. Send them an invite to join — once they sign up, invite them here again.`,
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Share Invite', onPress: () => shareAppInvite(user?.email) },
          ]
        );
        return;
      }
      if (error) {
        Alert.alert('Could not send invite', error);
        return;
      }
      setEmail('');
      load();
    } finally {
      setInviting(false);
    }
  }

  async function handleAccept(id: string) {
    setBusyId(id);
    try {
      await accountability.accept(id);
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleSendPoke(id: string) {
    setSendingPoke(true);
    try {
      const { error } = await accountability.poke(id, pokeMessage.trim() || undefined);
      if (error) {
        Alert.alert('Could not poke', error);
        return;
      }
      setPokingId(null);
      setPokeMessage('');
      Alert.alert('Sent! 👊', 'Your partner has been nudged.');
    } finally {
      setSendingPoke(false);
    }
  }

  function handleRemove(id: string, name: string) {
    Alert.alert('Remove partnership', `End your accountability partnership with ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);
          try {
            await accountability.remove(id);
            load();
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.purple} />}
      >
        <Text style={styles.title}>Accountability Partners 🤝</Text>
        <Text style={styles.subtitle}>
          Invite someone by the email they use on Becoming — they'll see your active goals and recent progress.
          Not on Becoming yet? Share an invite first.
        </Text>

        <Card style={styles.inviteCard} variant="outlined">
          <Input
            label="Invite by email"
            placeholder="friend@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            containerStyle={styles.inviteInput}
          />
          <Button title="Send Invite" onPress={handleInvite} loading={inviting} disabled={!email.trim()} />
          <Button
            title="Share Invite to Join Becoming"
            variant="ghost"
            onPress={() => shareAppInvite(user?.email)}
            style={styles.shareBtn}
          />
        </Card>

        {loading ? (
          <ActivityIndicator color={Colors.purple} style={styles.loading} />
        ) : partnerships.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🤝</Text>
            <Text style={styles.emptyTitle}>No partners yet</Text>
            <Text style={styles.emptySub}>Invite someone you trust to keep you honest.</Text>
          </View>
        ) : (
          partnerships.map((p) => (
            <Card key={p.id} style={styles.partnerCard} variant="default">
              <TouchableOpacity
                style={styles.partnerHeader}
                disabled={p.status !== 'active'}
                onPress={() => router.push(`/partner/${p.id}`)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{p.partner.fullName?.[0]?.toUpperCase() || '?'}</Text>
                </View>
                <View style={styles.partnerInfo}>
                  <Text style={styles.partnerName}>{p.partner.fullName || p.partner.email}</Text>
                  <Text style={styles.partnerEmail}>{p.partner.email}</Text>
                </View>
                {p.status === 'pending' ? (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingText}>{p.iInvited ? 'Invited' : 'Pending'}</Text>
                  </View>
                ) : (
                  <Text style={styles.openPartner}>💬 Open ›</Text>
                )}
              </TouchableOpacity>

              {p.status === 'active' && (
                <View style={styles.stats}>
                  <Text style={styles.statText}>🎯 {p.activeGoals} active goal{p.activeGoals === 1 ? '' : 's'}</Text>
                  <Text style={styles.statText}>✅ {p.tasksCompletedRecently} tasks done (14 days)</Text>
                </View>
              )}

              <View style={styles.actions}>
                {p.status === 'pending' && !p.iInvited && (
                  <Button
                    title="Accept"
                    size="sm"
                    onPress={() => handleAccept(p.id)}
                    loading={busyId === p.id}
                    style={styles.actionBtn}
                  />
                )}
                {p.status === 'active' && (
                  <Button
                    title="👊 Poke"
                    size="sm"
                    variant="secondary"
                    onPress={() => setPokingId(pokingId === p.id ? null : p.id)}
                    style={styles.actionBtn}
                  />
                )}
                <Button
                  title={p.status === 'pending' ? (p.iInvited ? 'Cancel Invite' : 'Decline') : 'Remove'}
                  size="sm"
                  variant="secondary"
                  onPress={() => handleRemove(p.id, p.partner.fullName || p.partner.email)}
                  loading={busyId === p.id}
                  style={styles.actionBtn}
                />
              </View>

              {pokingId === p.id && (
                <View style={styles.pokeForm}>
                  <TextInput
                    style={styles.pokeInput}
                    placeholder={`Optional message for ${p.partner.fullName?.split(' ')[0] || 'them'}…`}
                    placeholderTextColor={Colors.grey[400]}
                    value={pokeMessage}
                    onChangeText={setPokeMessage}
                    maxLength={140}
                  />
                  <Button
                    title={sendingPoke ? 'Sending…' : 'Send'}
                    size="sm"
                    onPress={() => handleSendPoke(p.id)}
                    disabled={sendingPoke}
                  />
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  title: { fontFamily: Fonts.bold, fontSize: 24, color: Colors.text.primary, marginBottom: Spacing.sm },
  subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary, lineHeight: 20, marginBottom: Spacing.lg },
  inviteCard: { padding: Spacing.lg, marginBottom: Spacing.xl },
  inviteInput: { marginBottom: Spacing.md },
  shareBtn: { marginTop: Spacing.sm },
  loading: { marginTop: Spacing.xxl },
  empty: { alignItems: 'center', paddingTop: Spacing.xxl },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 17, color: Colors.text.primary, marginBottom: Spacing.xs },
  emptySub: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.muted, textAlign: 'center' },
  partnerCard: { padding: Spacing.md, marginBottom: Spacing.md },
  partnerHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.purpleLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.white },
  partnerInfo: { flex: 1 },
  partnerName: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.text.primary },
  partnerEmail: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted },
  openPartner: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.purple },
  pendingBadge: { backgroundColor: Colors.orange + '20', paddingVertical: 3, paddingHorizontal: Spacing.sm, borderRadius: Radius.full },
  pendingText: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.orangeDark },
  stats: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm },
  statText: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.secondary },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { flex: 1 },
  pokeForm: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, alignItems: 'center' },
  pokeInput: {
    flex: 1, backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.primary,
  },
});
