import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { profileStats, ApiProfileStats, ApiHistoryPoint } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { Card } from '../components/ui/Card';
import { ProgressRing } from '../components/ui/ProgressRing';
import { Colors, Fonts, Spacing, Radius } from '../constants/theme';

export default function GrowthPassport() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<ApiProfileStats | null>(null);
  const [history, setHistory] = useState<ApiHistoryPoint[]>([]);
  const [chartTab, setChartTab] = useState<'progress' | 'consistency'>('progress');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([profileStats.get(), profileStats.history(6)]).then(([statsRes, historyRes]) => {
      if (statsRes.data) setStats(statsRes.data);
      if (historyRes.data) setHistory(historyRes.data.history);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.purple} style={{ marginTop: Spacing.xxl }} />
      </SafeAreaView>
    );
  }

  const memberSince = stats?.memberSince
    ? new Date(stats.memberSince).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })
    : '';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Growth Passport</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(stats?.fullName ?? user?.fullName)?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <Text style={styles.heroName}>{stats?.fullName ?? user?.fullName}</Text>
          <Text style={styles.heroSince}>Becoming since {memberSince}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>⭐ Level {stats?.level} Strategist</Text>
          </View>
        </View>

        <Card style={styles.statCard} variant="default">
          <Text style={styles.statIcon}>🏁</Text>
          <Text style={styles.statLabel}>TOTAL MILESTONES</Text>
          <Text style={styles.statValue}>{stats?.totalMilestones}</Text>
          <Text style={styles.statSub}>+{stats?.milestonesThisMonth} this month</Text>
        </Card>

        <Card style={{ ...styles.statCard, ...styles.streakCard }} variant="outlined">
          <Text style={styles.statIcon}>🔥</Text>
          <Text style={styles.statLabel}>CURRENT STREAK</Text>
          <Text style={[styles.statValue, { color: Colors.orangeDark }]}>{stats?.currentStreak}</Text>
          <Text style={styles.statSub}>Days of consistent growth</Text>
        </Card>

        <Card style={styles.statCard} variant="default">
          <ProgressRing percent={stats?.alignmentScore ?? 0} size={72} strokeWidth={8} color={Colors.purple} label={`${stats?.alignmentScore ?? 0}%`} />
          <Text style={[styles.statLabel, { marginTop: Spacing.sm }]}>ALIGNMENT SCORE</Text>
          <Text style={styles.statSub}>How well your daily actions match your goals</Text>
        </Card>

        <View style={styles.badgesHeader}>
          <Text style={styles.sectionTitle}>Growth Badges</Text>
        </View>
        {stats?.badges.length === 0 ? (
          <Text style={styles.noBadges}>Complete milestones and build streaks to earn badges.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesRow}>
            {stats?.badges.map((b) => (
              <View key={b.key} style={styles.badgeItem}>
                <View style={styles.badgeCircle}>
                  <Text style={styles.badgeEmoji}>{b.emoji}</Text>
                </View>
                <Text style={styles.badgeLabel} numberOfLines={2}>{b.label}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.historyCard}>
          <Text style={styles.sectionTitle}>Historical Progress</Text>
          <Text style={styles.historySub}>Growth trends over the last {history.length || 6} months</Text>

          <View style={styles.chartTabs}>
            <TouchableOpacity
              onPress={() => setChartTab('progress')}
              style={[styles.chartTab, chartTab === 'progress' && styles.chartTabActive]}
            >
              <Text style={[styles.chartTabText, chartTab === 'progress' && styles.chartTabTextActive]}>Progress</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setChartTab('consistency')}
              style={[styles.chartTab, chartTab === 'consistency' && styles.chartTabActive]}
            >
              <Text style={[styles.chartTabText, chartTab === 'consistency' && styles.chartTabTextActive]}>Consistency</Text>
            </TouchableOpacity>
          </View>

          {history.length === 0 ? (
            <Text style={styles.noBadges}>Not enough history yet — check back after a few weeks of activity.</Text>
          ) : (
            <BarChart
              points={history}
              valueKey={chartTab === 'progress' ? 'milestonesCompleted' : 'consistencyPercent'}
              suffix={chartTab === 'consistency' ? '%' : ''}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BarChart({
  points,
  valueKey,
  suffix,
}: {
  points: ApiHistoryPoint[];
  valueKey: 'milestonesCompleted' | 'consistencyPercent';
  suffix: string;
}) {
  const max = Math.max(1, ...points.map((p) => p[valueKey]));
  return (
    <View style={styles.chart}>
      {points.map((p) => {
        const height = Math.max(4, Math.round((p[valueKey] / max) * 100));
        const [year, month] = p.month.split('-');
        const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-NG', { month: 'short' });
        return (
          <View key={p.month} style={styles.chartCol}>
            <Text style={styles.chartValue}>{p[valueKey]}{suffix}</Text>
            <View style={styles.chartBarTrack}>
              <View style={[styles.chartBar, { height: `${height}%` }]} />
            </View>
            <Text style={styles.chartLabel}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  headerTitle: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.purple, marginTop: 4 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  heroCard: { backgroundColor: Colors.purple, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.lg },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  avatarText: { fontFamily: Fonts.bold, fontSize: 28, color: Colors.white },
  heroName: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.white, marginBottom: 4 },
  heroSince: { fontFamily: Fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: Spacing.md },
  levelBadge: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.full, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md },
  levelBadgeText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.white },
  statCard: { padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.md },
  streakCard: { borderColor: Colors.orange },
  statIcon: { fontSize: 24, marginBottom: Spacing.sm },
  statLabel: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.text.muted, letterSpacing: 0.5, textAlign: 'center' },
  statValue: { fontFamily: Fonts.bold, fontSize: 32, color: Colors.purple, marginVertical: 4 },
  statSub: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted, textAlign: 'center' },
  badgesHeader: { marginTop: Spacing.md, marginBottom: Spacing.md },
  sectionTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary },
  noBadges: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.muted },
  badgesRow: { gap: Spacing.lg, paddingBottom: Spacing.lg },
  badgeItem: { alignItems: 'center', width: 72 },
  badgeCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.surfaceContainer, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
  badgeEmoji: { fontSize: 24 },
  badgeLabel: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.text.secondary, textAlign: 'center' },

  historyCard: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, marginTop: Spacing.md },
  historySub: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted, marginBottom: Spacing.md },
  chartTabs: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  chartTab: { paddingVertical: 6, paddingHorizontal: Spacing.md, borderRadius: Radius.full, backgroundColor: Colors.grey[100] },
  chartTabActive: { backgroundColor: Colors.purple },
  chartTabText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.secondary },
  chartTabTextActive: { color: Colors.white },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 140 },
  chartCol: { flex: 1, alignItems: 'center', gap: 4 },
  chartValue: { fontFamily: Fonts.semiBold, fontSize: 10, color: Colors.text.secondary },
  chartBarTrack: { width: 18, height: 90, justifyContent: 'flex-end', backgroundColor: Colors.grey[100], borderRadius: Radius.sm, overflow: 'hidden' },
  chartBar: { width: '100%', backgroundColor: Colors.purple, borderRadius: Radius.sm },
  chartLabel: { fontFamily: Fonts.regular, fontSize: 10, color: Colors.text.muted },
});
