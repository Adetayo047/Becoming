import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, RefreshControl, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { accountability, ApiPartnerDetail, ApiPartnerMessage } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function initial(name?: string | null) {
  return name?.trim()?.[0]?.toUpperCase() || '?';
}

// Partner detail — from the Stitch accountability_partner design: sync rate
// and streak, the encouragement history between you, and a message bar.
export default function PartnerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<ApiPartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [poking, setPoking] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const { data: d } = await accountability.get(id);
    if (d) setData(d);
    setLoading(false);
    setRefreshing(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    const { error } = await accountability.sendMessage(id, draft.trim());
    setSending(false);
    if (error) {
      Alert.alert('Could not send', error);
      return;
    }
    setDraft('');
    load();
  }

  async function handlePoke() {
    setPoking(true);
    const { error } = await accountability.poke(id);
    setPoking(false);
    if (error) {
      Alert.alert('Could not poke', error);
      return;
    }
    Alert.alert('Sent! 👊', `${firstName} has been nudged.`);
    load();
  }

  async function toggleLike(m: ApiPartnerMessage) {
    setData((d) => d && { ...d, messages: d.messages.map((x) => (x.id === m.id ? { ...x, liked: !m.liked } : x)) });
    await accountability.likeMessage(id, m.id, !m.liked);
  }

  function handleEnd() {
    Alert.alert('End partnership?', `You and ${firstName} will no longer see each other's progress.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'End Partnership',
        style: 'destructive',
        onPress: async () => {
          await accountability.remove(id);
          router.back();
        },
      },
    ]);
  }

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.purple} style={{ marginTop: Spacing.xxl }} />
      </SafeAreaView>
    );
  }

  const name = data.partner.fullName || data.partner.email;
  const firstName = name.split(' ')[0];
  const messages = showAll ? data.messages : data.messages.slice(0, 5);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.purple} />}
        >
          <Card style={styles.profileCard}>
            <View style={styles.bigAvatar}>
              <Text style={styles.bigAvatarText}>{initial(name)}</Text>
              <View style={styles.checkBadge}><Text style={styles.checkBadgeText}>✓</Text></View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              <Text style={styles.status}>
                🎯 {data.activeGoals} active goal{data.activeGoals === 1 ? '' : 's'} · {data.tasksCompletedThisWeek} done this week
              </Text>
            </View>
          </Card>

          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <View style={styles.statTop}>
                <Text style={styles.statIcon}>📈</Text>
                {data.syncChange !== null && (
                  <View style={styles.changePill}>
                    <Text style={styles.changeText}>{data.syncChange >= 0 ? '+' : ''}{data.syncChange}%</Text>
                  </View>
                )}
              </View>
              <Text style={styles.statLabel}>SYNC RATE</Text>
              <Text style={styles.statValue}>
                {data.syncRate === null ? '—' : `${data.syncRate}%`}
                <Text style={styles.statUnit}> week</Text>
              </Text>
            </Card>
            <View style={[styles.statCard, styles.streakCard]}>
              <Text style={styles.streakLabel}>STREAK</Text>
              <Text style={styles.streakValue}>{data.currentStreak}</Text>
              <Text style={styles.streakSub}>Day{data.currentStreak === 1 ? '' : 's'} consistent</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Encouragement</Text>
            {data.messages.length > 5 && (
              <TouchableOpacity onPress={() => setShowAll(!showAll)}>
                <Text style={styles.viewHistory}>{showAll ? 'Show less' : 'View history'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {data.messages.length === 0 ? (
            <Text style={styles.emptyText}>No messages yet. Send {firstName} a check-in note or a word of encouragement below.</Text>
          ) : (
            messages.map((m, i) => (
              <View key={m.id} style={[styles.msgRow, m.mine && styles.msgRowMine]}>
                {!m.mine && (
                  <View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{initial(m.sender.fullName)}</Text></View>
                )}
                <View style={[styles.bubble, m.mine ? styles.bubbleMine : i % 2 === 1 && styles.bubbleAccent]}>
                  {m.kind === 'poke' && <Text style={[styles.pokeTag, m.mine && styles.pokeTagMine]}>👊 POKE</Text>}
                  <Text style={[styles.msgText, m.mine && styles.msgTextMine]}>"{m.body}"</Text>
                  <View style={styles.msgFooter}>
                    <Text style={[styles.msgTime, m.mine && styles.msgTimeMine]}>{m.mine ? 'You · ' : ''}{timeAgo(m.createdAt)}</Text>
                    {m.mine ? (
                      m.liked && <Text style={styles.likedMine}>❤️ {firstName} loved this</Text>
                    ) : (
                      <TouchableOpacity onPress={() => toggleLike(m)} style={[styles.heart, m.liked && styles.heartOn]} hitSlop={8}>
                        <Text style={styles.heartText}>{m.liked ? '❤️' : '🤍'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}

          <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Manage Partnership</Text>
          <Card style={styles.manageCard} padding="none">
            <TouchableOpacity style={styles.manageRow} onPress={() => router.push('/accountability')}>
              <View style={[styles.manageIcon, { backgroundColor: Colors.orange + '25' }]}><Text>➕</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.manageTitle}>Invite New Partner</Text>
                <Text style={styles.manageSub}>Add another person to your circle</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.manageRow} onPress={handleEnd}>
              <View style={[styles.manageIcon, { backgroundColor: Colors.error + '18' }]}><Text>💔</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.manageTitle, { color: Colors.error }]}>End Partnership</Text>
                <Text style={styles.manageSub}>Revoke all shared access</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </Card>
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            value={draft}
            onChangeText={setDraft}
            placeholder={`Send ${firstName} a note…`}
            placeholderTextColor={Colors.text.muted}
            maxLength={280}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending || !draft.trim()}>
            {sending ? <ActivityIndicator color={Colors.purple} size="small" /> : <Text style={[styles.sendIcon, !draft.trim() && { opacity: 0.4 }]}>➤</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.pokeBtn} onPress={handlePoke} disabled={poking}>
            {poking ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.pokeIcon}>👊</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, marginBottom: Spacing.md },
  bigAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md, borderWidth: 3, borderColor: Colors.orangeLight },
  bigAvatarText: { fontFamily: Fonts.bold, fontSize: 26, color: Colors.white },
  checkBadge: { position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.white },
  checkBadgeText: { color: Colors.white, fontSize: 11, fontFamily: Fonts.bold },
  name: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.text.primary },
  status: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  statCard: { flex: 1, padding: Spacing.md, borderRadius: Radius.lg },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  statIcon: { fontSize: 20 },
  changePill: { backgroundColor: Colors.surfaceContainer, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  changeText: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.purple },
  statLabel: { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.onSurfaceVariant, letterSpacing: 0.8 },
  statValue: { fontFamily: Fonts.bold, fontSize: 24, color: Colors.text.primary },
  statUnit: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary },
  streakCard: { backgroundColor: Colors.purple },
  streakLabel: { fontFamily: Fonts.semiBold, fontSize: 11, color: 'rgba(255,255,255,0.8)', letterSpacing: 0.8 },
  streakValue: { fontFamily: Fonts.bold, fontSize: 34, color: Colors.white, marginTop: Spacing.xs },
  streakSub: { fontFamily: Fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: Spacing.md },
  sectionTitle: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.text.primary, marginBottom: Spacing.md },
  viewHistory: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.purple },
  emptyText: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.muted, lineHeight: 20 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md },
  msgRowMine: { justifyContent: 'flex-end' },
  smallAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.purpleLight, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  smallAvatarText: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.white },
  bubble: { flexShrink: 1, maxWidth: '85%', backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, borderLeftWidth: 0, borderColor: Colors.orange },
  bubbleAccent: { borderLeftWidth: 3 },
  bubbleMine: { backgroundColor: Colors.purple },
  pokeTag: { fontFamily: Fonts.semiBold, fontSize: 10, color: Colors.orangeDark, letterSpacing: 0.6, marginBottom: 2 },
  pokeTagMine: { color: Colors.orangeLight },
  msgText: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.text.primary, lineHeight: 22 },
  msgTextMine: { color: Colors.white },
  msgFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  msgTime: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted },
  msgTimeMine: { color: 'rgba(255,255,255,0.75)' },
  likedMine: { fontFamily: Fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.9)', marginLeft: Spacing.sm },
  heart: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceContainerLow, marginLeft: Spacing.sm },
  heartOn: { backgroundColor: Colors.orange + '35' },
  heartText: { fontSize: 14 },
  manageCard: { overflow: 'hidden' },
  manageRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
  manageIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  manageTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.text.primary },
  manageSub: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted },
  chevron: { fontSize: 22, color: Colors.text.muted, marginLeft: Spacing.sm },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.md },
  composer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border },
  composerInput: { flex: 1, maxHeight: 100, backgroundColor: Colors.surfaceContainer, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: 10, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary },
  sendBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { fontSize: 20, color: Colors.purple },
  pokeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center' },
  pokeIcon: { fontSize: 20 },
});
