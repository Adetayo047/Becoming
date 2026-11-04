import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { insights as insightsApi, ApiInsights } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { ProgressRing } from '../components/ui/ProgressRing';
import { todayKey } from '../components/planner/dates';
import { Colors, Fonts, Spacing, Radius } from '../constants/theme';

const INSIGHT_STYLE = [
  { icon: '✨', border: Colors.purple },
  { icon: '🔁', border: Colors.orange },
  { icon: '📈', border: Colors.grey[600] },
];

const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

// Premium Insights (Stitch: becoming_premium_insights) — Plus only. Patterns
// from the last 30 days: peak completion windows, goal resilience, AI habit logic.
export default function InsightsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isPlus = user?.tier === 'plus';
  const [data, setData] = useState<ApiInsights | null>(null);
  const [loading, setLoading] = useState(isPlus);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isPlus) return;
    const { data: d } = await insightsApi.get(todayKey());
    if (d) setData(d);
    setLoading(false);
    setRefreshing(false);
  }, [isPlus]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const maxWindow = data ? Math.max(1, ...data.windows.map((w) => w.count)) : 1;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.brand}>Becoming+</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={isPlus ? <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.purple} /> : undefined}
      >
        <View style={styles.hero}>
          <View style={styles.heroChip}><Text style={styles.heroChipText}>⚡ BECOMING+ EXCLUSIVE</Text></View>
          <Text style={styles.heroTitle}>Pattern Recognition at the speed of growth.</Text>
          <Text style={styles.heroBody}>
            {data
              ? `Our AI analysed your last 30 days: ${data.stats.totalTasks} task${data.stats.totalTasks === 1 ? '' : 's'} across ${data.stats.activeDays} active day${data.stats.activeDays === 1 ? '' : 's'}.`
              : 'Our AI analyses your last 30 days of activity to find when you perform best and how you handle setbacks.'}
          </Text>
        </View>

        {!isPlus ? (
          <View style={styles.lockedCard}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.lockedTitle}>Premium Insights are part of Plus</Text>
            <Text style={styles.lockedBody}>See your peak performance hours, your goal resilience score and AI habit patterns drawn from your own activity.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/billing')}>
              <Text style={styles.primaryText}>See Plans</Text>
            </TouchableOpacity>
          </View>
        ) : loading || !data ? (
          <ActivityIndicator color={Colors.purple} style={{ marginTop: Spacing.xl }} />
        ) : (
          <>
            {/* Peak performance windows */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Peak Performance Windows</Text>
                <Text style={styles.cardIcon}>📊</Text>
              </View>
              <Text style={styles.cardSub}>When you actually tick tasks off.</Text>
              {data.peakStart === null ? (
                <Text style={styles.empty}>Complete a few tasks and your peak hours will show here.</Text>
              ) : (
                <View style={styles.chart}>
                  {data.windows.map((w) => {
                    const peak = w.start === data.peakStart;
                    return (
                      <View key={w.start} style={styles.barCol}>
                        <Text style={[styles.barCount, peak && styles.barCountPeak]}>{w.count || ''}</Text>
                        <View style={[styles.bar, { height: 8 + (w.count / maxWindow) * 110 }, peak && styles.barPeak]} />
                        <Text style={[styles.barLabel, peak && styles.barLabelPeak]}>{hourLabel(w.start)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Goal resilience */}
            <View style={styles.darkCard}>
              <Text style={styles.darkTitle}>Goal Resilience</Text>
              <Text style={styles.darkSub}>How you bounce back after a missed day.</Text>
              <View style={styles.ringWrap}>
                <ProgressRing
                  percent={data.resilience.score}
                  size={150}
                  strokeWidth={10}
                  color={Colors.orange}
                  trackColor="rgba(255,255,255,0.12)"
                  label={String(data.resilience.score)}
                  labelSize={40}
                />
                <Text style={styles.resLabel}>{data.resilience.label.toUpperCase()}</Text>
              </View>
              <View style={styles.resStats}>
                {[
                  { v: `${data.resilience.bounceRate}%`, l: 'Bounce-back' },
                  { v: `${data.resilience.completionRate}%`, l: 'Completion' },
                  { v: String(data.resilience.activeDays), l: 'Active days' },
                ].map((s) => (
                  <View key={s.l} style={styles.resStat}>
                    <Text style={styles.resStatValue}>{s.v}</Text>
                    <Text style={styles.resStatLabel}>{s.l}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Habit logic */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Personalized Habit Logic</Text>
              <Text style={styles.aiChip}>• AI</Text>
            </View>
            {data.insights.map((ins, i) => {
              const st = INSIGHT_STYLE[i % INSIGHT_STYLE.length];
              return (
                <View key={ins.title} style={[styles.insightCard, { borderLeftColor: st.border }]}>
                  <View style={styles.insightIcon}><Text>{st.icon}</Text></View>
                  <Text style={styles.insightTitle}>{ins.title}</Text>
                  <Text style={styles.insightBody}>{ins.body}</Text>
                </View>
              );
            })}

            {/* Apply */}
            <View style={styles.card}>
              <Text style={styles.accelTitle}>Ready to accelerate?</Text>
              <Text style={styles.cardSub}>
                {data.stats.peakWindow
                  ? `Let AI plan tomorrow around your ${data.stats.peakWindow} peak.`
                  : 'Let AI plan your day around your goals.'}
              </Text>
              <TouchableOpacity style={[styles.primaryBtn, { alignSelf: 'flex-start', paddingHorizontal: Spacing.lg }]} onPress={() => router.push('/ai-day-planner')}>
                <Text style={styles.primaryText}>Automate Schedule ✨</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  back: { fontSize: 24, color: Colors.purple },
  brand: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.purple },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
  hero: { backgroundColor: Colors.purple, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.lg },
  heroChip: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, marginBottom: Spacing.md },
  heroChipText: { fontFamily: Fonts.semiBold, fontSize: 10, letterSpacing: 0.8, color: Colors.white },
  heroTitle: { fontFamily: Fonts.bold, fontSize: 30, lineHeight: 36, color: Colors.white, marginBottom: Spacing.sm },
  heroBody: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.85)' },
  lockedCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center' },
  lockIcon: { fontSize: 36, marginBottom: Spacing.sm },
  lockedTitle: { fontFamily: Fonts.semiBold, fontSize: 18, color: Colors.text.primary, textAlign: 'center', marginBottom: Spacing.xs },
  lockedBody: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: Colors.text.secondary, textAlign: 'center', marginBottom: Spacing.lg },
  card: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontFamily: Fonts.semiBold, fontSize: 18, color: Colors.text.primary, flex: 1 },
  cardIcon: { fontSize: 20 },
  cardSub: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary, marginTop: 2, marginBottom: Spacing.md },
  empty: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.muted, fontStyle: 'italic' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160 },
  barCol: { flex: 1, alignItems: 'center' },
  barCount: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.text.muted, marginBottom: 4 },
  barCountPeak: { color: Colors.purple, fontFamily: Fonts.bold },
  bar: { width: 22, borderRadius: 6, backgroundColor: Colors.surfaceContainerHigh },
  barPeak: { backgroundColor: Colors.purple },
  barLabel: { fontFamily: Fonts.regular, fontSize: 10, color: Colors.text.muted, marginTop: 6 },
  barLabelPeak: { color: Colors.purple, fontFamily: Fonts.bold },
  darkCard: { backgroundColor: '#1C1B23', borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.xl },
  darkTitle: { fontFamily: Fonts.semiBold, fontSize: 18, color: Colors.white },
  darkSub: { fontFamily: Fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  ringWrap: { alignItems: 'center', marginVertical: Spacing.lg },
  resLabel: { fontFamily: Fonts.semiBold, fontSize: 12, letterSpacing: 1.5, color: Colors.orange, marginTop: Spacing.sm },
  resStats: { flexDirection: 'row', justifyContent: 'space-between' },
  resStat: { flex: 1, alignItems: 'center' },
  resStatValue: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.white },
  resStatLabel: { fontFamily: Fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontFamily: Fonts.bold, fontSize: 22, color: Colors.text.primary, flex: 1 },
  aiChip: { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.purple, letterSpacing: 0.8 },
  insightCard: { backgroundColor: Colors.white, borderRadius: Radius.lg, borderLeftWidth: 4, padding: Spacing.lg, marginBottom: Spacing.md },
  insightIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surfaceContainer, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  insightTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary, marginBottom: 4 },
  insightBody: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: Colors.text.secondary },
  accelTitle: { fontFamily: Fonts.bold, fontSize: 22, color: Colors.text.primary },
  primaryBtn: { backgroundColor: Colors.purple, borderRadius: Radius.full, paddingVertical: 12, paddingHorizontal: Spacing.xl, alignItems: 'center' },
  primaryText: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.white },
});
