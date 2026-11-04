import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { goals as goalsApi, ApiGoal } from '../../../lib/api';
import { useGoalStore } from '../../../lib/store';
import { Card } from '../../../components/ui/Card';
import { Colors, Fonts, Spacing, Radius, CATEGORY_META } from '../../../constants/theme';

function GoalCard({ goal, onPress }: { goal: ApiGoal; onPress: () => void }) {
  const meta = CATEGORY_META[goal.category as keyof typeof CATEGORY_META];
  const percent = goal.completionPercent ?? 0;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.goalCard} variant="default">
        <View style={styles.goalCardHeader}>
          <View style={[styles.catBadge, { backgroundColor: meta.color + '18' }]}>
            <Text style={styles.catEmoji}>{meta.emoji}</Text>
            <Text style={[styles.catLabel, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={styles.goalStatus}>
            {goal.status === 'active' ? '🟢' : goal.status === 'paused' ? '⏸️' : '✅'}
          </Text>
        </View>
        <Text style={styles.goalTitle} numberOfLines={2}>{goal.title}</Text>
        {goal.targetDate && (
          <Text style={styles.goalDate}>
            Target: {new Date(goal.targetDate).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        )}
        <View style={styles.goalProgress}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: meta.color }]} />
          </View>
          <Text style={[styles.progressPct, { color: meta.color }]}>{percent}%</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function GoalsScreen() {
  const router = useRouter();
  const { goals, setGoals } = useGoalStore();
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'active' | 'all' | 'completed'>('active');

  async function loadGoals() {
    const { data } = await goalsApi.list();
    if (data) setGoals(data);
  }

  useEffect(() => { loadGoals(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGoals();
    setRefreshing(false);
  }, []);

  const filtered = goals.filter((g) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') return g.status === 'active';
    return g.status === 'completed';
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>My Goals</Text>
        <View style={styles.headerBtns}>
          <TouchableOpacity onPress={() => router.push('/goal-architect-chat')} style={styles.aiBtn}>
            <Text style={styles.aiBtnText}>🧭 AI Architect</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/goals/create')} style={styles.createBtn}>
            <Text style={styles.createBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filters}>
        {(['active', 'all', 'completed'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setActiveFilter(f)}
            style={[styles.filterTab, activeFilter === f && styles.filterActive]}
          >
            <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
              {f === 'active' ? 'Active' : f === 'all' ? 'All' : 'Done'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.purple} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>No goals yet</Text>
            <Text style={styles.emptySub}>Plant your first goal and watch it grow.</Text>
            <TouchableOpacity onPress={() => router.push('/goals/create')} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>+ Create your first goal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onPress={() => router.push(`/goals/${goal.id}`)} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  title: { fontFamily: Fonts.bold, fontSize: 24, color: Colors.text.primary, flexShrink: 1 },
  headerBtns: { flexDirection: 'row', gap: Spacing.sm },
  aiBtn: { backgroundColor: Colors.surfaceContainer, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.md },
  aiBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.purple },
  createBtn: { backgroundColor: Colors.purple, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.md },
  createBtnText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.white },
  filters: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.sm },
  filterTab: { paddingVertical: Spacing.xs + 2, paddingHorizontal: Spacing.md, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  filterActive: { backgroundColor: Colors.purple, borderColor: Colors.purple },
  filterText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.secondary },
  filterTextActive: { color: Colors.white },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  goalCard: { padding: Spacing.md },
  goalCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: Radius.full },
  catEmoji: { fontSize: 12 },
  catLabel: { fontFamily: Fonts.medium, fontSize: 11 },
  goalStatus: { fontSize: 14 },
  goalTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary, lineHeight: 22, marginBottom: Spacing.sm },
  goalDate: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted, marginBottom: Spacing.sm },
  goalProgress: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progressBg: { flex: 1, height: 6, backgroundColor: Colors.grey[100], borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.full },
  progressPct: { fontFamily: Fonts.semiBold, fontSize: 12, width: 32, textAlign: 'right' },
  empty: { alignItems: 'center', paddingTop: Spacing.xxxl, paddingHorizontal: Spacing.lg },
  emptyEmoji: { fontSize: 56, marginBottom: Spacing.lg },
  emptyTitle: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.text.primary, marginBottom: Spacing.sm },
  emptySub: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.muted, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
  emptyBtn: { backgroundColor: Colors.purple, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: Radius.md },
  emptyBtnText: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.white },
});
