import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dashboard, DashboardData } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { Colors, Fonts, Spacing, Radius, CATEGORY_META } from '../../constants/theme';

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadDashboard() {
    const { data: d } = await dashboard.get();
    if (d) setData(d);
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

        <Card style={styles.overallCard} variant="elevated">
          <View style={styles.overallRow}>
            <View style={styles.overallLeft}>
              <Text style={styles.overallLabel}>Overall Progress</Text>
              <Text style={styles.overallGoalCount}>{data?.goals.length ?? 0} active goals</Text>
              <Text style={styles.overallTasks}>{data?.totalTasksCompleted ?? 0} tasks completed (14 days)</Text>
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
                    <Text style={styles.streakBest}>Best: {s.longestStreak} days</Text>
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
  overallCard: { marginBottom: Spacing.xl, padding: Spacing.lg },
  overallRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overallLeft: { flex: 1, paddingRight: Spacing.md },
  overallLabel: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary, marginBottom: 4 },
  overallGoalCount: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary, marginBottom: 2 },
  overallTasks: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.success },
  section: { marginBottom: Spacing.xl },
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
});
