import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { dashboard, weeklyReview, goals as goalsApi, DashboardData, ApiGoalDetail } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { TrendCard, LockedTrendCard } from '../../components/growth/TrendCard';
import { Colors, Fonts, Spacing, Radius, CATEGORY_META } from '../../constants/theme';

function currentWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
  return monday.toISOString().split('T')[0];
}

export default function DashboardScreen() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [topGoal, setTopGoal] = useState<ApiGoalDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewDue, setReviewDue] = useState(false);

  async function loadDashboard() {
    const [{ data: d }, { data: week }] = await Promise.all([
      dashboard.get(),
      weeklyReview.get(currentWeekStart()),
    ]);
    if (d) setData(d);
    if (week) setReviewDue(!week.review);

    if (d && d.goals.length > 0) {
      const { data: goalDetail } = await goalsApi.get(d.goals[0].id);
      if (goalDetail) setTopGoal(goalDetail);
    }
  }

  useEffect(() => { loadDashboard(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  function heatmapColor(count: number) {
    if (count === 0) return Colors.grey[100];
    if (count === 1) return Colors.purple + '40';
    if (count === 2) return Colors.purple + '70';
    if (count <= 4) return Colors.purple + 'AA';
    return Colors.purple;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.purple} />}
      >
        <Text style={styles.title}>Growth Dashboard 📊</Text>

        {reviewDue && (
          <TouchableOpacity onPress={() => router.push('/weekly-review')} style={styles.reviewBanner}>
            <Text style={styles.reviewBannerEmoji}>🪞</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.reviewBannerTitle}>Your Weekly Review is ready</Text>
              <Text style={styles.reviewBannerSub}>Reflect on this week before it resets</Text>
            </View>
            <Text style={styles.reviewBannerArrow}>→</Text>
          </TouchableOpacity>
        )}

        <Card style={styles.overallCard} variant="elevated">
          <View style={styles.overallRow}>
            <View style={styles.overallLeft}>
              <Text style={styles.overallLabel}>Overall Progress</Text>
              <Text style={styles.overallGoalCount}>
                {data?.goals.length ?? 0} active goal{data?.goals.length === 1 ? '' : 's'}
              </Text>
              <Text style={styles.overallTasks}>
                {data?.totalTasksCompleted ?? 0} task{data?.totalTasksCompleted === 1 ? '' : 's'} completed in the last 14 days
              </Text>
            </View>
            <ProgressRing
              percent={data?.overallPercent ?? 0}
              size={100}
              strokeWidth={10}
              color={Colors.purple}
              label={`${data?.overallPercent ?? 0}%`}
              sublabel="complete"
            />
          </View>
        </Card>

        {data && (data.trend ? <TrendCard trend={data.trend} /> : <LockedTrendCard onUpgrade={() => router.push('/billing')} />)}

        <TouchableOpacity style={styles.insightsLink} onPress={() => router.push('/insights')} activeOpacity={0.85}>
          <View style={{ flex: 1 }}>
            <Text style={styles.insightsKicker}>⚡ BECOMING+ · PREMIUM INSIGHTS</Text>
            <Text style={styles.insightsTitle}>Your peak hours, resilience & habit patterns</Text>
          </View>
          <Text style={styles.insightsArrow}>→</Text>
        </TouchableOpacity>

        {topGoal ? (
          <View style={styles.section}>
            <View style={styles.planSectionHeader}>
              <Text style={styles.sectionTitle}>Cascading Plan</Text>
              <TouchableOpacity onPress={() => router.push('/planner')}>
                <Text style={styles.openPlanner}>Open Planner →</Text>
              </TouchableOpacity>
            </View>
            {topGoal.yearlyTargets && topGoal.yearlyTargets.length > 0 && (
              <Card style={styles.planCard} variant="outlined">
                <View style={styles.planCardHeader}>
                  <Text style={styles.planCardLabel}>🎯 {new Date().getFullYear()} OUTCOME</Text>
                </View>
                <Text style={styles.planCardTitle}>{topGoal.yearlyTargets[0].title}</Text>
              </Card>
            )}
            {topGoal.monthlyTargets && topGoal.monthlyTargets.length > 0 && (
              <Card style={styles.planCard} variant="outlined">
                <View style={styles.planCardHeader}>
                  <Text style={styles.planCardLabel}>📅 MONTHLY FOCUS</Text>
                </View>
                <Text style={styles.planCardTitle}>{topGoal.monthlyTargets[0].title}</Text>
              </Card>
            )}
            {topGoal.weeklyFocuses && topGoal.weeklyFocuses.length > 0 && (
              <Card style={styles.planCard} variant="outlined">
                <View style={styles.planCardHeader}>
                  <Text style={styles.planCardLabel}>🚩 WEEKLY FOCUS</Text>
                </View>
                <Text style={styles.planCardTitle}>{topGoal.weeklyFocuses[0].title}</Text>
              </Card>
            )}
            <Card style={styles.alignmentCard} variant="default">
              <ProgressRing
                percent={topGoal.completionPercent ?? 0}
                size={80}
                strokeWidth={8}
                color={Colors.white}
                label={`${topGoal.completionPercent ?? 0}%`}
                sublabel=""
              />
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={styles.alignmentTitle}>Alignment Status</Text>
                <Text style={styles.alignmentSub}>{topGoal.completionPercent ?? 0}% of "{topGoal.title}" milestones done. Tap Open Planner to check today's alignment.</Text>
              </View>
            </Card>
          </View>
        ) : null}

        {(data?.goals.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Goals Breakdown</Text>
            {data!.goals.map((g) => {
              const meta = CATEGORY_META[g.category as keyof typeof CATEGORY_META];
              return (
                <Card key={g.id} style={styles.goalBreakdown} variant="default">
                  <View style={styles.goalBreakdownHeader}>
                    <View style={[styles.catDot, { backgroundColor: meta.color }]} />
                    <Text style={styles.goalBreakdownTitle} numberOfLines={1}>{g.title}</Text>
                    <Text style={[styles.goalBreakdownPct, { color: meta.color }]}>{g.completionPercent}%</Text>
                  </View>
                  <View style={styles.goalProgressBg}>
                    <View style={[styles.goalProgressFill, { width: `${g.completionPercent}%`, backgroundColor: meta.color }]} />
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {(data?.heatmap.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activity (Last 14 Days)</Text>
            <Card variant="default" style={styles.heatmapCard}>
              <View style={styles.heatmap}>
                {data!.heatmap.map((d) => (
                  <View key={d.date} style={styles.heatmapCol}>
                    <View style={[styles.heatmapCell, { backgroundColor: heatmapColor(d.count) }]} />
                    <Text style={styles.heatmapDate}>
                      {new Date(d.date + 'T12:00:00').toLocaleDateString('en-NG', { weekday: 'narrow' })}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.heatmapLegend}>
                <Text style={styles.legendText}>Less</Text>
                {[0, 1, 2, 3, 4].map((v) => (
                  <View key={v} style={[styles.legendCell, { backgroundColor: heatmapColor(v) }]} />
                ))}
                <Text style={styles.legendText}>More</Text>
              </View>
            </Card>
          </View>
        )}

        {(data?.streaks.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Habit Streaks 🔥</Text>
            {data!.streaks.map((s) => (
              <Card key={s.id} style={styles.streakCard} variant="default">
                <View style={styles.streakRow}>
                  <View style={styles.streakFires}>
                    <Text style={styles.streakFireIcon}>🔥</Text>
                    <Text style={styles.streakNum}>{s.currentStreak}</Text>
                  </View>
                  <View style={styles.streakBody}>
                    <Text style={styles.streakTitle} numberOfLines={1}>{s.taskTitle}</Text>
                    <Text style={styles.streakBest}>Best: {s.longestStreak} day{s.longestStreak === 1 ? '' : 's'}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {!data && (
          <Card style={styles.emptyCard} variant="outlined">
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptySub}>Create a goal and start completing tasks to see your growth here.</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  title: { fontFamily: Fonts.bold, fontSize: 24, color: Colors.text.primary, marginBottom: Spacing.lg },
  reviewBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.purple, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.lg },
  reviewBannerEmoji: { fontSize: 24 },
  reviewBannerTitle: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.white },
  reviewBannerSub: { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  reviewBannerArrow: { color: Colors.white, fontSize: 18 },
  overallCard: { marginBottom: Spacing.xl, padding: Spacing.lg },
  planCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  planCardHeader: { marginBottom: Spacing.xs },
  planCardLabel: { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.purple, letterSpacing: 0.5 },
  planCardTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.text.primary, lineHeight: 20 },
  alignmentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.purple, padding: Spacing.lg, marginTop: Spacing.sm },
  alignmentTitle: { fontFamily: Fonts.semiBold, fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  alignmentSub: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.white, lineHeight: 16 },
  overallRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overallLeft: { flex: 1, paddingRight: Spacing.md },
  overallLabel: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary, marginBottom: 4 },
  overallGoalCount: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary, marginBottom: 2 },
  overallTasks: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.success },
  section: { marginBottom: Spacing.xl },
  planSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  openPlanner: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.purple },
  sectionTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary, marginBottom: Spacing.md },
  goalBreakdown: { padding: Spacing.md, marginBottom: Spacing.sm },
  goalBreakdownHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  goalBreakdownTitle: { flex: 1, fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.primary },
  goalBreakdownPct: { fontFamily: Fonts.semiBold, fontSize: 13 },
  goalProgressBg: { height: 6, backgroundColor: Colors.grey[100], borderRadius: Radius.full, overflow: 'hidden' },
  goalProgressFill: { height: '100%', borderRadius: Radius.full },
  heatmapCard: { padding: Spacing.md },
  heatmap: { flexDirection: 'row', gap: 4, justifyContent: 'space-between' },
  heatmapCol: { alignItems: 'center', gap: 4, flex: 1 },
  heatmapCell: { width: '100%', aspectRatio: 1, borderRadius: 3 },
  heatmapDate: { fontSize: 8, color: Colors.text.muted, fontFamily: Fonts.regular },
  heatmapLegend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.md, justifyContent: 'flex-end' },
  legendText: { fontFamily: Fonts.regular, fontSize: 10, color: Colors.text.muted },
  legendCell: { width: 12, height: 12, borderRadius: 2 },
  streakCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  streakFires: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 50 },
  streakFireIcon: { fontSize: 20 },
  streakNum: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.orangeDark },
  streakBody: { flex: 1 },
  streakTitle: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.primary },
  streakBest: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.text.muted },
  emptyCard: { alignItems: 'center', padding: Spacing.xl, borderColor: Colors.border },
  emptyEmoji: { fontSize: 40, marginBottom: Spacing.md },
  emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary, marginBottom: Spacing.sm },
  emptySub: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.muted, textAlign: 'center', lineHeight: 18 },
  insightsLink: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.purpleDark, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.xl },
  insightsKicker: { fontFamily: Fonts.semiBold, fontSize: 10, letterSpacing: 0.8, color: 'rgba(255,255,255,0.75)', marginBottom: 4 },
  insightsTitle: { fontFamily: Fonts.semiBold, fontSize: 15, lineHeight: 21, color: Colors.white },
  insightsArrow: { fontSize: 20, color: Colors.white, marginLeft: Spacing.sm },
});
