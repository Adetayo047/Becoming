import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ai, reminders, ApiReminders } from '../lib/api';
import { todayKey } from '../components/planner/dates';
import { Colors, Fonts, Spacing, Radius } from '../constants/theme';

function to12h(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// Smart Reminders (Stitch: ai_insight_smart_reminders) — today's mantra, a
// schedule tip from the user's real peak hours, upcoming nudges, routine stats.
export default function SmartRemindersScreen() {
  const router = useRouter();
  const [data, setData] = useState<ApiReminders | null>(null);
  const [mantra, setMantra] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [{ data: r }, { data: m }] = await Promise.all([reminders.get(todayKey()), ai.motivation(todayKey())]);
    if (r) setData(r);
    if (m) setMantra(m.message);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.brand}>Smart Reminders</Text>
        <TouchableOpacity onPress={() => router.push('/notifications-settings')} hitSlop={12}>
          <Text style={styles.bell}>🔔</Text>
        </TouchableOpacity>
      </View>

      {!data ? (
        <ActivityIndicator color={Colors.purple} style={{ marginTop: Spacing.xxl }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.purple} />}
        >
          <Text style={styles.mantraLabel}>TODAY'S MANTRA</Text>
          <Text style={styles.mantra}>"{mantra ?? 'Small steps every day. Big change tomorrow.'}"</Text>
          <View style={styles.mantraDots}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>

          {data.insight && !dismissed ? (
            <View style={styles.insightCard}>
              <View style={styles.insightChip}><Text style={styles.insightChipText}>⚡ ARCHITECT INSIGHT</Text></View>
              <View style={styles.insightHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>{data.insight.title}</Text>
                  <Text style={styles.insightSub}>Your peak: {data.peakWindow}</Text>
                </View>
                <View style={styles.insightIcon}><Text style={{ fontSize: 20 }}>🧠</Text></View>
              </View>
              <View style={styles.quote}>
                <Text style={styles.quoteText}>"{data.insight.body}"</Text>
              </View>
              <View style={styles.insightActions}>
                <TouchableOpacity style={styles.adjustBtn} onPress={() => router.push('/ai-day-planner')}>
                  <Text style={styles.adjustText}>Adjust Schedule →</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dismissBtn} onPress={() => setDismissed(true)}>
                  <Text style={styles.dismissText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : data.peakWindow ? (
            <View style={styles.peakCard}>
              <Text style={styles.peakText}>🧠 Your peak window is <Text style={styles.peakStrong}>{data.peakWindow}</Text>. Schedule deep work there.</Text>
            </View>
          ) : null}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Nudges</Text>
            <TouchableOpacity onPress={() => router.push('/planner')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          {data.nudges.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No more scheduled blocks today</Text>
              <Text style={styles.emptyBody}>
                {data.unscheduled > 0
                  ? `${data.unscheduled} task${data.unscheduled === 1 ? ' has' : 's have'} no time yet. Give them a slot and the nudges appear here.`
                  : 'Plan your day with time blocks and your nudges appear here.'}
              </Text>
              <TouchableOpacity style={styles.planBtn} onPress={() => router.push('/ai-day-planner')}>
                <Text style={styles.planText}>✨ Plan My Day</Text>
              </TouchableOpacity>
            </View>
          ) : (
            data.nudges.map((n) => (
              <View key={n.taskId} style={styles.nudgeCard}>
                <View style={[styles.nudgeIcon, { backgroundColor: n.deepWork ? Colors.orange + '2A' : Colors.surfaceContainer }]}>
                  <Text style={{ fontSize: 18 }}>{n.deepWork ? '🎯' : '📖'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nudgeTitleRow}>
                    <Text style={styles.nudgeTitle} numberOfLines={1}>{n.title}</Text>
                    {n.deepWork && <View style={styles.nudgeDot} />}
                  </View>
                  <Text style={styles.nudgeLine}>"{n.line}"</Text>
                  <View style={styles.nudgeMeta}>
                    {n.deepWork && <Text style={styles.nudgePriority}>★ Deep Work</Text>}
                    <Text style={styles.nudgeTime}>🕒 {to12h(n.time)}</Text>
                  </View>
                </View>
              </View>
            ))
          )}

          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: Colors.surfaceContainer }]}>
              <Text style={styles.statIcon}>✓✓</Text>
              <Text style={styles.statValue}>{data.stats.routineIntegrity === null ? '—' : `${data.stats.routineIntegrity}%`}</Text>
              <Text style={styles.statLabel}>Routine Integrity</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: Colors.orange + '1A' }]}>
              <Text style={styles.statIcon}>🏅</Text>
              <Text style={styles.statValue}>{data.stats.streak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  back: { fontSize: 24, color: Colors.purple },
  brand: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.purple },
  bell: { fontSize: 20 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
  mantraLabel: { fontFamily: Fonts.semiBold, fontSize: 12, letterSpacing: 1.5, color: Colors.purple, textAlign: 'center', marginTop: Spacing.sm },
  mantra: { fontFamily: Fonts.bold, fontSize: 22, lineHeight: 30, fontStyle: 'italic', color: Colors.text.primary, textAlign: 'center', marginTop: Spacing.sm },
  mantraDots: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: Spacing.sm, marginBottom: Spacing.xl },
  dot: { width: 6, height: 4, borderRadius: 2, backgroundColor: Colors.grey[300] },
  dotActive: { width: 28, backgroundColor: Colors.orange },
  insightCard: { backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.xl, padding: Spacing.lg, paddingTop: Spacing.xl, marginBottom: Spacing.xl, marginTop: Spacing.sm },
  insightChip: { position: 'absolute', top: -12, left: -6, backgroundColor: Colors.purpleDark, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  insightChipText: { fontFamily: Fonts.semiBold, fontSize: 11, letterSpacing: 0.6, color: Colors.white },
  insightHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md },
  insightTitle: { fontFamily: Fonts.semiBold, fontSize: 22, color: Colors.text.primary },
  insightSub: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary, marginTop: 2 },
  insightIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },
  quote: { borderLeftWidth: 4, borderLeftColor: Colors.purple, backgroundColor: Colors.surfaceContainer, borderRadius: Radius.sm, padding: Spacing.md, marginBottom: Spacing.lg },
  quoteText: { fontFamily: Fonts.medium, fontSize: 16, lineHeight: 24, fontStyle: 'italic', color: Colors.text.primary },
  insightActions: { flexDirection: 'row', gap: Spacing.sm },
  adjustBtn: { flex: 1, backgroundColor: Colors.purpleDark, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  adjustText: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.white },
  dismissBtn: { width: 56, backgroundColor: Colors.surfaceContainerHigh, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  dismissText: { fontSize: 18, color: Colors.text.secondary },
  peakCard: { backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.xl },
  peakText: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: Colors.text.secondary },
  peakStrong: { fontFamily: Fonts.semiBold, color: Colors.purple },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontFamily: Fonts.semiBold, fontSize: 22, color: Colors.text.primary },
  viewAll: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.purple },
  emptyCard: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.lg },
  emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.text.primary, marginBottom: 4 },
  emptyBody: { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 19, color: Colors.text.secondary, textAlign: 'center', marginBottom: Spacing.md },
  planBtn: { backgroundColor: Colors.orange + '26', borderRadius: Radius.full, paddingHorizontal: Spacing.lg, paddingVertical: 10 },
  planText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.orangeDark },
  nudgeCard: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  nudgeIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  nudgeTitleRow: { flexDirection: 'row', alignItems: 'center' },
  nudgeTitle: { flexShrink: 1, fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.text.primary },
  nudgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.orange, marginLeft: 6 },
  nudgeLine: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21, color: Colors.text.primary, marginTop: 4 },
  nudgeMeta: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  nudgePriority: { fontFamily: Fonts.medium, fontSize: 12, color: '#815600' },
  nudgeTime: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.secondary },
  statsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  statCard: { flex: 1, borderRadius: Radius.lg, padding: Spacing.lg },
  statIcon: { fontSize: 16, color: Colors.purple, marginBottom: Spacing.sm },
  statValue: { fontFamily: Fonts.semiBold, fontSize: 24, color: Colors.text.primary },
  statLabel: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary, marginTop: 2 },
});
