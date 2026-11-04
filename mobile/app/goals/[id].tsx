import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goals as goalsApi, milestones as milestonesApi, tasks as tasksApi, calendar, ai, ApiGoalDetail } from '../../lib/api';
import { useGoalStore, useAuthStore } from '../../lib/store';
import { Card } from '../../components/ui/Card';
import { MilestoneCelebration, MilestoneWin } from '../../components/ui/MilestoneCelebration';
import { todayKey, mondayOf } from '../../components/planner/dates';
import { Colors, Fonts, Spacing, Radius, CATEGORY_META } from '../../constants/theme';

export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { toggleTask } = useGoalStore();
  const { user } = useAuthStore();
  const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null);
  const [milestoneWin, setMilestoneWin] = useState<MilestoneWin | null>(null);
  const milestoneInputRef = useRef<TextInput>(null);
  const [goal, setGoal] = useState<ApiGoalDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newMilestone, setNewMilestone] = useState('');
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await goalsApi.get(id);
    if (data) setGoal(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function handleToggleMilestone(milestoneId: string, currentlyDone: boolean) {
    if (!goal) return;
    const milestone = goal.milestones?.find((m) => m.id === milestoneId);
    // optimistic update
    setGoal({
      ...goal,
      milestones: goal.milestones?.map((m) =>
        m.id === milestoneId ? { ...m, status: currentlyDone ? 'pending' : 'completed' } : m
      ),
    });
    await milestonesApi.update(milestoneId, { completed: !currentlyDone });
    if (!currentlyDone && milestone) {
      const list = goal.milestones ?? [];
      const pending = list.filter((m) => m.id !== milestoneId && m.status !== 'completed');
      setMilestoneWin({
        milestoneTitle: milestone.title,
        goalTitle: goal.title,
        done: list.length - pending.length,
        total: list.length,
        next: pending[0] ? { id: pending[0].id, title: pending[0].title } : null,
      });
    }
    load();
  }

  async function addMilestones(titles: string[]) {
    if (!goal) return;
    const clean = titles.map((t) => t.trim()).filter((t) => t.length > 2);
    if (clean.length === 0) return;
    setAddingMilestone(true);
    try {
      const { error } = await goalsApi.addMilestones(goal.id, clean);
      if (error) {
        Alert.alert('Could not add milestone', error);
        return;
      }
      setNewMilestone('');
      setSuggestions((prev) => prev.filter((s) => !clean.includes(s)));
      await load();
    } finally {
      setAddingMilestone(false);
    }
  }

  async function handleSuggestMilestones() {
    if (!goal) return;
    setSuggesting(true);
    try {
      const { data, error } = await ai.suggestMilestones(goal.title, goal.category);
      if (error || !data?.milestones?.length) {
        Alert.alert('No suggestions right now', error ?? 'Try again in a moment.');
        return;
      }
      setSuggestions(data.milestones);
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSyncToCalendar(taskId: string) {
    setSyncingTaskId(taskId);
    try {
      const { error } = await calendar.syncTask(taskId);
      if (error) {
        Alert.alert('Could not add to calendar', error);
        return;
      }
      Alert.alert('Added!', 'This task now has a reminder on your Google Calendar.');
    } finally {
      setSyncingTaskId(null);
    }
  }

  async function handleToggleTask(taskId: string) {
    toggleTask(taskId);
    const task = goal?.dailyTasks.find((t) => t.id === taskId);
    if (!task) return;
    await tasksApi.update(taskId, { completed: !task.completed });
    load();
  }

  function handleDelete() {
    if (!goal) return;
    Alert.alert('Delete Goal', `Delete "${goal.title}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await goalsApi.delete(goal.id);
          router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!goal) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.notFound}>
          <Text style={styles.notFoundEmoji}>🌱</Text>
          <Text style={styles.notFoundTitle}>Goal not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const meta = CATEGORY_META[goal.category as keyof typeof CATEGORY_META];
  // Only the current period's plan — the planner lets users fill future
  // months/weeks ahead, and those mustn't show up as "this month".
  const today = todayKey();
  const plan = [
    { label: '🎯 This year', items: (goal.yearlyTargets ?? []).filter((t) => String(t.year) === today.slice(0, 4)) },
    { label: '📅 This month', items: (goal.monthlyTargets ?? []).filter((t) => t.month === today.slice(0, 7)) },
    { label: '🚩 This week', items: (goal.weeklyFocuses ?? []).filter((w) => w.weekStart.slice(0, 10) === mondayOf(today)) },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.purple} />}
      >
        <View style={[styles.catBadge, { backgroundColor: meta.color + '18' }]}>
          <Text style={styles.catEmoji}>{meta.emoji}</Text>
          <Text style={[styles.catLabel, { color: meta.color }]}>{meta.label}</Text>
        </View>

        <Text style={styles.title}>{goal.title}</Text>
        {goal.description ? <Text style={styles.description}>{goal.description}</Text> : null}
        {goal.targetDate && (
          <Text style={styles.targetDate}>
            🎯 Target: {new Date(goal.targetDate).toLocaleDateString('en-NG', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        )}

        <Card style={styles.progressCard} variant="elevated">
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Milestone progress</Text>
            <Text style={[styles.progressPct, { color: meta.color }]}>{goal.completionPercent ?? 0}%</Text>
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${goal.completionPercent ?? 0}%`, backgroundColor: meta.color }]} />
          </View>
        </Card>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cascading Plan</Text>
            <TouchableOpacity onPress={() => router.push('/planner')}>
              <Text style={styles.sectionLink}>Open Planner →</Text>
            </TouchableOpacity>
          </View>
          {plan.map((level) => (
            <Card key={level.label} style={styles.planCard} variant="outlined">
              <Text style={styles.planLabel}>{level.label}</Text>
              {level.items.length > 0 ? (
                level.items.map((t) => <Text key={t.id} style={styles.planText}>{t.title}</Text>)
              ) : (
                <Text style={styles.planEmpty}>Not planned yet</Text>
              )}
            </Card>
          ))}
        </View>

        {(() => {
          const milestoneList = goal.milestones ?? [];
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Milestones 🏁</Text>
              {milestoneList.length === 0 && (
                <Text style={styles.milestoneHint}>
                  Break this goal into checkpoints — your progress grows as you complete them.
                </Text>
              )}
              {milestoneList.length > 0 && (
              <Card variant="default" style={styles.listCard}>
                {milestoneList.map((m, i) => {
                  const done = m.status === 'completed';
                  return (
                    <View key={m.id}>
                      <View style={styles.row}>
                        <TouchableOpacity onPress={() => handleToggleMilestone(m.id, done)} activeOpacity={0.7}>
                          <View style={[styles.checkbox, done && { backgroundColor: meta.color, borderColor: meta.color }]}>
                            {done && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.milestoneRowBody}
                          onPress={() => router.push(`/milestones/${m.id}`)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.rowText, done && styles.rowTextDone]}>{m.title}</Text>
                          <Text style={styles.milestoneChevron}>›</Text>
                        </TouchableOpacity>
                      </View>
                      {i < milestoneList.length - 1 && <View style={styles.divider} />}
                    </View>
                  );
                })}
              </Card>
              )}

              <View style={styles.addMilestoneRow}>
                <TextInput
                  ref={milestoneInputRef}
                  style={styles.addMilestoneInput}
                  placeholder="Add a milestone…"
                  placeholderTextColor={Colors.grey[400]}
                  value={newMilestone}
                  onChangeText={setNewMilestone}
                  onSubmitEditing={() => addMilestones([newMilestone])}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[styles.addMilestoneBtn, newMilestone.trim().length < 3 && styles.addMilestoneBtnDisabled]}
                  onPress={() => addMilestones([newMilestone])}
                  disabled={newMilestone.trim().length < 3 || addingMilestone}
                >
                  {addingMilestone ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={styles.addMilestoneBtnText}>Add</Text>
                  )}
                </TouchableOpacity>
              </View>

              {suggestions.length > 0 ? (
                <Card variant="outlined" style={styles.suggestCard}>
                  <View style={styles.suggestHeader}>
                    <Text style={styles.suggestTitle}>✨ AI suggestions</Text>
                    <TouchableOpacity onPress={() => addMilestones(suggestions)} disabled={addingMilestone}>
                      <Text style={styles.suggestAddAll}>Add all</Text>
                    </TouchableOpacity>
                  </View>
                  {suggestions.map((s) => (
                    <TouchableOpacity key={s} style={styles.suggestRow} onPress={() => addMilestones([s])} disabled={addingMilestone}>
                      <Text style={styles.suggestText}>{s}</Text>
                      <Text style={styles.suggestPlus}>＋</Text>
                    </TouchableOpacity>
                  ))}
                </Card>
              ) : (
                <TouchableOpacity style={styles.suggestBtn} onPress={handleSuggestMilestones} disabled={suggesting}>
                  {suggesting ? (
                    <ActivityIndicator color={Colors.purple} size="small" />
                  ) : (
                    <Text style={styles.suggestBtnText}>✨ Suggest milestones with AI</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })()}

        {goal.dailyTasks && goal.dailyTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Tasks 📝</Text>
            <Card variant="default" style={styles.listCard}>
              {goal.dailyTasks.map((t, i) => (
                <View key={t.id}>
                  <TouchableOpacity
                    onPress={() => handleToggleTask(t.id)}
                    activeOpacity={0.7}
                    style={styles.row}
                  >
                    <View style={[styles.checkbox, t.completed && { backgroundColor: meta.color, borderColor: meta.color }]}>
                      {t.completed && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowText, t.completed && styles.rowTextDone]}>{t.title}</Text>
                      <Text style={styles.taskDate}>
                        {new Date(t.date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                    {user?.googleCalendarConnected && (
                      <TouchableOpacity
                        onPress={() => handleSyncToCalendar(t.id)}
                        disabled={syncingTaskId === t.id}
                        hitSlop={8}
                      >
                        <Text style={styles.calendarIcon}>{syncingTaskId === t.id ? '⏳' : '📅'}</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                  {i < goal.dailyTasks.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </Card>
          </View>
        )}
      </ScrollView>

      <MilestoneCelebration
        win={milestoneWin}
        onClose={() => setMilestoneWin(null)}
        onNext={(next) => {
          setMilestoneWin(null);
          if (next) router.push(`/milestones/${next.id}`);
          else milestoneInputRef.current?.focus();
        }}
        onShare={() => {
          const w = milestoneWin;
          setMilestoneWin(null);
          router.push({
            pathname: '/(tabs)/community/index',
            params: { prefillHeadline: w?.milestoneTitle ?? goal.title, prefillKind: 'milestone' },
          });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  deleteText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.error },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: Spacing.sm, borderRadius: Radius.full, marginBottom: Spacing.md },
  catEmoji: { fontSize: 12 },
  catLabel: { fontFamily: Fonts.medium, fontSize: 12 },
  title: { fontFamily: Fonts.bold, fontSize: 24, color: Colors.text.primary, lineHeight: 30, marginBottom: Spacing.sm },
  description: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary, lineHeight: 20, marginBottom: Spacing.sm },
  targetDate: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.muted, marginBottom: Spacing.lg },
  progressCard: { marginTop: Spacing.md, marginBottom: Spacing.xl },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  progressLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.secondary },
  progressPct: { fontFamily: Fonts.bold, fontSize: 13 },
  progressBg: { height: 8, backgroundColor: Colors.grey[100], borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.full },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary, marginBottom: Spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionLink: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.purple },
  planEmpty: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.muted, fontStyle: 'italic' },
  planCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  planLabel: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.purple, marginBottom: 4 },
  planText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.text.primary, lineHeight: 20 },
  listCard: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.grey[300], alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkmark: { color: Colors.white, fontSize: 12, fontFamily: Fonts.bold },
  rowText: { flex: 1, fontFamily: Fonts.medium, fontSize: 15, color: Colors.text.primary, lineHeight: 22 },
  milestoneRowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  milestoneChevron: { fontSize: 18, color: Colors.grey[400] },
  rowTextDone: { textDecorationLine: 'line-through', color: Colors.text.muted },
  milestoneHint: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.muted, lineHeight: 19, marginBottom: Spacing.md },
  addMilestoneRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  addMilestoneInput: { flex: 1, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary },
  addMilestoneBtn: { backgroundColor: Colors.purple, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.lg, minWidth: 64, alignItems: 'center' },
  addMilestoneBtnDisabled: { opacity: 0.5 },
  addMilestoneBtnText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.white },
  suggestBtn: { marginTop: Spacing.md, backgroundColor: Colors.purple + '12', borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  suggestBtnText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.purple },
  suggestCard: { marginTop: Spacing.md, padding: Spacing.md },
  suggestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  suggestTitle: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.purple },
  suggestAddAll: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.purple },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  suggestText: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary, lineHeight: 20 },
  suggestPlus: { fontSize: 18, color: Colors.purple },
  taskDate: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.text.muted, marginTop: 2 },
  calendarIcon: { fontSize: 18, marginLeft: Spacing.sm },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.md + 24 + Spacing.md },
  notFound: { alignItems: 'center', paddingTop: Spacing.xxxl },
  notFoundEmoji: { fontSize: 48, marginBottom: Spacing.md },
  notFoundTitle: { fontFamily: Fonts.semiBold, fontSize: 18, color: Colors.text.primary },
});
