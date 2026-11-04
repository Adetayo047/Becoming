import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { tasks, goals as goalsApi, dashboard, ai, ApiTask, ApiGoal, DashboardData } from '../../lib/api';
import { useAuthStore, useGoalStore } from '../../lib/store';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { Celebration } from '../../components/ui/Celebration';
import { Colors, Fonts, Spacing, Radius, CATEGORY_META } from '../../constants/theme';
import { todayKey } from '../../components/planner/dates';

// Streak bars fill toward the next of these.
const STREAK_TARGETS = [7, 14, 30, 60, 100, 365];

function formatDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getDayLabel() {
  return new Date().toLocaleDateString('en-NG', { weekday: 'long', month: 'long', day: 'numeric' });
}

function TaskItem({ task, onToggle }: { task: ApiTask; onToggle: (id: string) => void }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(task.completed ? 0.5 : 1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  function handleToggle() {
    scale.value = withSpring(0.95, {}, () => { scale.value = withSpring(1); });
    opacity.value = withTiming(task.completed ? 1 : 0.5, { duration: 200 });
    onToggle(task.id);
  }

  const cat = task.goal?.category
    ? CATEGORY_META[task.goal.category as keyof typeof CATEGORY_META]
    : null;

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity onPress={handleToggle} activeOpacity={0.7} style={styles.taskRow}>
        <View style={[styles.checkbox, task.completed && styles.checkboxDone]}>
          {task.completed && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <View style={styles.taskBody}>
          <Text style={[styles.taskTitle, task.completed && styles.taskDone]}>{task.title}</Text>
          <View style={styles.taskMetaRow}>
            {task.scheduledStart && (
              <View style={styles.timeTag}>
                <Text style={styles.timeTagText}>🕐 {task.scheduledStart}{task.scheduledEnd ? `–${task.scheduledEnd}` : ''}</Text>
              </View>
            )}
            {cat && (
              <View style={[styles.taskTag, { backgroundColor: cat.color + '18' }]}>
                <Text style={[styles.taskTagText, { color: cat.color }]}>{cat.emoji} {cat.label}</Text>
              </View>
            )}
            {task.aiGenerated && (
              <View style={styles.aiTag}>
                <Text style={styles.aiTagText}>AI</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { todayTasks, goals, setTodayTasks, setGoals, toggleTask, addTask } = useGoalStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskGoalId, setNewTaskGoalId] = useState<string | undefined>();
  const [addingTask, setAddingTask] = useState(false);
  const [bestStreak, setBestStreak] = useState(0);
  const [streaks, setStreaks] = useState<DashboardData['streaks']>([]);
  const [weeklyPercent, setWeeklyPercent] = useState(0);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [motivation, setMotivation] = useState<string | null>(null);

  // Re-read after anything that changes today's progress — the server only
  // asks the AI again when the user's state actually moved.
  async function loadMotivation() {
    const { data } = await ai.motivation(todayKey());
    if (data) setMotivation(data.message);
  }

  async function loadData() {
    loadMotivation();
    const [tasksRes, goalsRes, dashboardRes] = await Promise.all([
      tasks.list(formatDate(new Date())),
      goalsApi.list('active'),
      dashboard.get(),
    ]);
    if (tasksRes.data) setTodayTasks(tasksRes.data);
    if (goalsRes.data) setGoals(goalsRes.data);
    if (dashboardRes.data) applyDashboard(dashboardRes.data);
  }

  function applyDashboard(data: DashboardData) {
    const top = data.streaks.reduce((max, s) => Math.max(max, s.currentStreak), 0);
    setBestStreak(top);
    setStreaks(data.streaks);
    setWeeklyPercent(data.overallPercent);
  }

  // Completing a task updates streaks server-side, so re-read them
  async function refreshStreaks() {
    const { data } = await dashboard.get();
    if (data) applyDashboard(data);
    loadMotivation();
  }

  useEffect(() => { loadData(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  async function handleToggle(taskId: string) {
    const task = todayTasks.find((t) => t.id === taskId);
    if (!task) return;
    const willBeComplete = !task.completed;
    const wasAllDone = todayTasks.every((t) => t.completed);
    toggleTask(taskId);
    await tasks.update(taskId, { completed: willBeComplete });
    await refreshStreaks();

    const nowAllDone = willBeComplete && todayTasks.every((t) => t.id === taskId || t.completed);
    if (nowAllDone && !wasAllDone && todayTasks.length > 0) {
      setShowCelebration(true);
    }
  }

  async function handleSuggestTask() {
    const selectedGoal = goals.find((g) => g.id === newTaskGoalId);
    if (!selectedGoal) {
      Alert.alert('Pick a goal first', 'AI suggestions need a goal to base the task on.');
      return;
    }
    setAiSuggesting(true);
    try {
      const { data, error } = await ai.suggestDailyTask(selectedGoal.title);
      if (error || !data) {
        Alert.alert('AI unavailable', error ?? 'Could not get a suggestion right now.');
        return;
      }
      setNewTaskTitle(data.task);
    } finally {
      setAiSuggesting(false);
    }
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    try {
      const { data, error } = await tasks.create({
        title: newTaskTitle.trim(),
        goalId: newTaskGoalId,
        date: formatDate(new Date()),
      });
      if (error || !data) { Alert.alert('Error', 'Could not add task'); return; }
      addTask(data);
      loadMotivation();
      setNewTaskTitle('');
      setNewTaskGoalId(undefined);
      setShowAddTask(false);
    } finally {
      setAddingTask(false);
    }
  }

  const completedCount = todayTasks.filter((t) => t.completed).length;
  const totalCount = todayTasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.purple} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}, {user?.fullName?.split(' ')[0] || 'Champion'} 👋</Text>
            <Text style={styles.date}>{getDayLabel()}</Text>
          </View>
          <View style={styles.streakBadge}>
            <Text style={styles.streakFire}>🔥</Text>
            <Text style={styles.streakCount}>{bestStreak}</Text>
          </View>
        </View>

        {weeklyPercent > 0 && (
          <View style={styles.nudgeBanner}>
            <Text style={styles.nudgeLabel}>SMART NUDGE</Text>
            <Text style={styles.nudgeTitle}>Your future is calling,{'\n'}Answer it.</Text>
            <Text style={styles.nudgeSub}>
              You're {weeklyPercent}% through your active goals. One action today keeps the momentum alive!
            </Text>
          </View>
        )}

        {totalCount > 0 && (
          <Card style={styles.progressCard} variant="elevated">
            <View style={styles.progressHero}>
              <ProgressRing
                percent={progressPercent}
                size={150}
                strokeWidth={12}
                color={Colors.purple}
                label={`${progressPercent}%`}
                labelSize={34}
                sublabel="DAILY TASK"
              />
            </View>
            <Text style={styles.progressTitle}>Today's Progress</Text>
            <View style={styles.progressList}>
              {todayTasks.slice(0, 4).map((t) => (
                <View key={t.id} style={styles.progressItem}>
                  <Text style={[styles.progressItemText, t.completed && styles.progressItemDone]} numberOfLines={1}>{t.title}</Text>
                  <View style={[styles.progressCheck, t.completed && styles.progressCheckDone]}>
                    {t.completed && <Text style={styles.progressCheckMark}>✓</Text>}
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.progressCaption}>
              {completedCount} of {totalCount} done{totalCount > 4 ? ' · see all in Daily Focus' : ''}
            </Text>
            {completedCount === totalCount && totalCount > 0 && (
              <Text style={styles.allDone}>🎉 All done! You crushed today.</Text>
            )}
          </Card>
        )}

        <Card variant="default" style={styles.streaksCard}>
          <View style={styles.streaksHeader}>
            <Text style={styles.streaksTitle}>Streaks</Text>
            <Text style={styles.streaksFire}>🔥</Text>
          </View>
          {streaks.length === 0 ? (
            <Text style={styles.streaksEmpty}>Finish a task two days running to start a streak.</Text>
          ) : (
            streaks.slice(0, 3).map((s) => {
              const target = STREAK_TARGETS.find((n) => n > s.currentStreak) ?? s.currentStreak;
              return (
                <View key={s.id} style={styles.streakRow}>
                  <View style={styles.streakRowTop}>
                    <Text style={styles.streakRowTitle} numberOfLines={1}>{s.taskTitle}</Text>
                    <Text style={styles.streakRowDays}>{s.currentStreak} Day{s.currentStreak === 1 ? '' : 's'}</Text>
                  </View>
                  <View style={styles.streakTrack}>
                    <View style={[styles.streakFill, { width: `${Math.round((s.currentStreak / target) * 100)}%` }]} />
                  </View>
                  <Text style={styles.streakNext}>{target - s.currentStreak} more to {target} days</Text>
                </View>
              );
            })
          )}
          <TouchableOpacity
            style={styles.logWinBtn}
            onPress={() => router.push({ pathname: '/(tabs)/community', params: { compose: '1', prefillKind: 'small_win' } })}
          >
            <Text style={styles.logWinText}>Log a Win ⚡</Text>
          </TouchableOpacity>
        </Card>

        <TouchableOpacity style={styles.plannerLink} onPress={() => router.push('/planner')}>
          <Text style={styles.plannerLinkIcon}>🗺️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.plannerLinkTitle}>Cascading Planner</Text>
            <Text style={styles.plannerLinkSub}>Year → month → week → day · check your alignment</Text>
          </View>
          <Text style={styles.plannerLinkArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.plannerLink} onPress={() => router.push('/smart-reminders')}>
          <Text style={styles.plannerLinkIcon}>⏰</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.plannerLinkTitle}>Smart Reminders</Text>
            <Text style={styles.plannerLinkSub}>Your next nudges & a schedule tip from your peak hours</Text>
          </View>
          <Text style={styles.plannerLinkArrow}>→</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Daily Focus</Text>
            <View style={styles.sectionHeaderActions}>
              {todayTasks.length > 0 && (
                <TouchableOpacity onPress={() => router.push('/ai-day-planner')} style={styles.planBtn}>
                  <Text style={styles.planBtnText}>✨ Plan My Day</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setShowAddTask(true)} style={styles.addBtn}>
                <Text style={styles.addBtnText}>+ Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          {todayTasks.length === 0 ? (
            <Card style={styles.emptyCard} variant="outlined">
              <Text style={styles.emptyEmoji}>📝</Text>
              <Text style={styles.emptyTitle}>No tasks yet</Text>
              <Text style={styles.emptySub}>Add your first task for today</Text>
              <TouchableOpacity onPress={() => setShowAddTask(true)} style={styles.emptyBtn}>
                <Text style={styles.emptyBtnText}>+ Add task</Text>
              </TouchableOpacity>
            </Card>
          ) : (
            <Card variant="outlined" style={styles.taskCard}>
              {todayTasks.map((task, i) => (
                <View key={task.id}>
                  <TaskItem task={task} onToggle={handleToggle} />
                  {i < todayTasks.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </Card>
          )}
        </View>

        {goals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Goals</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/goals/index')}>
                <Text style={styles.seeAll}>See all →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.goalsRow}>
              {goals.slice(0, 5).map((g) => {
                const meta = CATEGORY_META[g.category as keyof typeof CATEGORY_META];
                return (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => router.push(`/goals/${g.id}`)}
                    style={[styles.goalChip, { borderColor: meta.color + '40', backgroundColor: meta.color + '10' }]}
                  >
                    <Text style={styles.goalChipEmoji}>{meta.emoji}</Text>
                    <Text style={[styles.goalChipText, { color: meta.color }]} numberOfLines={1}>{g.title}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <Card style={styles.quoteCard} variant="outlined">
          <Text style={styles.quoteText}>"{motivation ?? 'Small steps every day. Big change tomorrow.'}"</Text>
          <Text style={styles.quoteBrand}>{motivation ? '— Your Becoming coach' : '— Becoming'}</Text>
        </Card>
      </ScrollView>

      <Modal visible={showAddTask} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Task</Text>
              <TouchableOpacity onPress={() => setShowAddTask(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>What do you need to do?</Text>
              <TextInput
                style={styles.taskInput}
                placeholder="e.g. Watch 1 hour of UI course"
                value={newTaskTitle}
                onChangeText={setNewTaskTitle}
                autoFocus
                placeholderTextColor={Colors.grey[400]}
                multiline
              />

              {goals.length > 0 && (
                <>
                  <Text style={[styles.inputLabel, { marginTop: Spacing.lg }]}>Link to a goal (optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.goalSelect}>
                    <TouchableOpacity
                      onPress={() => setNewTaskGoalId(undefined)}
                      style={[styles.goalSelectChip, !newTaskGoalId && styles.goalSelectActive]}
                    >
                      <Text style={[styles.goalSelectText, !newTaskGoalId && styles.goalSelectActiveText]}>No goal</Text>
                    </TouchableOpacity>
                    {goals.map((g) => {
                      const meta = CATEGORY_META[g.category as keyof typeof CATEGORY_META];
                      const isSelected = newTaskGoalId === g.id;
                      return (
                        <TouchableOpacity
                          key={g.id}
                          onPress={() => setNewTaskGoalId(g.id)}
                          style={[styles.goalSelectChip, isSelected && { backgroundColor: meta.color, borderColor: meta.color }]}
                        >
                          <Text style={styles.goalSelectEmoji}>{meta.emoji}</Text>
                          <Text style={[styles.goalSelectText, isSelected && styles.goalSelectActiveText]} numberOfLines={1}>{g.title}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              {newTaskGoalId && (
                <TouchableOpacity onPress={handleSuggestTask} disabled={aiSuggesting} style={styles.aiSuggestBtn}>
                  {aiSuggesting ? (
                    <ActivityIndicator size="small" color={Colors.purple} />
                  ) : (
                    <Text style={styles.aiSuggestBtnText}>✨ Suggest a task with AI</Text>
                  )}
                </TouchableOpacity>
              )}

              <Button title="Add Task" onPress={handleAddTask} loading={addingTask} disabled={!newTaskTitle.trim()} style={styles.addTaskBtn} />
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      <Celebration
        visible={showCelebration}
        onClose={() => setShowCelebration(false)}
        title="Momentum Maintained"
        subtitle="You've finished every task today. This is what growth looks like."
        stats={[
          { label: 'Streak', value: `${bestStreak} Day${bestStreak === 1 ? '' : 's'}` },
          { label: 'Completion', value: '100%' },
        ]}
        onShareWin={() => {
          setShowCelebration(false);
          router.push({
            pathname: '/(tabs)/community/index',
            params: { prefillHeadline: 'Finished everything on my list today! 🎯', prefillKind: 'small_win' },
          });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.lg },
  greeting: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.text.primary },
  date: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.muted, marginTop: 2 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.orange + '20', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.full },
  streakFire: { fontSize: 16 },
  streakCount: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.orangeDark },
  nudgeBanner: { backgroundColor: Colors.purple, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  nudgeLabel: { fontFamily: Fonts.semiBold, fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, marginBottom: Spacing.xs },
  nudgeTitle: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.white, lineHeight: 26, marginBottom: Spacing.xs },
  nudgeSub: { fontFamily: Fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
  progressCard: { marginBottom: Spacing.lg, alignItems: 'center', paddingVertical: Spacing.lg },
  progressHero: { marginBottom: Spacing.md },
  progressTitle: { fontFamily: Fonts.semiBold, fontSize: 18, color: Colors.text.primary, marginBottom: Spacing.sm },
  progressList: { alignSelf: 'stretch', paddingHorizontal: Spacing.md },
  progressItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  progressItemText: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary, marginRight: Spacing.sm },
  progressItemDone: { color: Colors.text.muted },
  progressCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: Colors.grey[500], alignItems: 'center', justifyContent: 'center' },
  progressCheckDone: { borderColor: Colors.orange, backgroundColor: Colors.orange + '22' },
  progressCheckMark: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.orangeDark },
  progressCaption: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.muted, marginTop: Spacing.sm },
  streaksCard: { padding: Spacing.lg, marginBottom: Spacing.xl },
  streaksHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  streaksTitle: { fontFamily: Fonts.semiBold, fontSize: 18, color: Colors.text.primary },
  streaksFire: { fontSize: 20 },
  streaksEmpty: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.muted, marginBottom: Spacing.sm },
  streakRow: { marginBottom: Spacing.md },
  streakRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  streakRowTitle: { flex: 1, fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.primary, marginRight: Spacing.sm },
  streakRowDays: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.orangeDark },
  streakTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.surfaceContainer },
  streakFill: { height: 6, borderRadius: 3, backgroundColor: Colors.orange },
  streakNext: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.text.muted, marginTop: 3 },
  logWinBtn: { backgroundColor: Colors.orange, borderRadius: Radius.full, paddingVertical: 12, alignItems: 'center', marginTop: Spacing.xs },
  logWinText: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.black },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  progressLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.secondary },
  progressPercent: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.purple },
  progressBg: { height: 8, backgroundColor: Colors.grey[100], borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.purple, borderRadius: Radius.full },
  allDone: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.success, marginTop: Spacing.sm, textAlign: 'center' },
  section: { marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  sectionHeaderActions: { flexDirection: 'row', gap: Spacing.sm },
  sectionTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary },
  addBtn: { backgroundColor: Colors.purple + '15', paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: Radius.full },
  addBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.purple },
  plannerLink: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.outlineVariant, padding: Spacing.md, marginBottom: Spacing.lg },
  plannerLinkIcon: { fontSize: 22, marginRight: Spacing.md },
  plannerLinkTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.purple },
  plannerLinkSub: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.secondary },
  plannerLinkArrow: { fontFamily: Fonts.semiBold, fontSize: 18, color: Colors.purple, marginLeft: Spacing.sm },
  planBtn: { backgroundColor: Colors.orange + '20', paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: Radius.full },
  planBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.orangeDark },
  taskMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  timeTag: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: Radius.full, backgroundColor: Colors.grey[100] },
  timeTagText: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.text.secondary },
  aiTag: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: Radius.full, backgroundColor: Colors.purple },
  aiTagText: { fontFamily: Fonts.bold, fontSize: 9, color: Colors.white },
  seeAll: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.purple },
  // No overflow: 'hidden' — on Android, clipping a shadowed card around the
  // animated TaskItem rows renders them blank.
  taskCard: { padding: 0 },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.grey[300], alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxDone: { backgroundColor: Colors.purple, borderColor: Colors.purple },
  checkmark: { color: Colors.white, fontSize: 12, fontFamily: Fonts.bold },
  taskBody: { flex: 1, gap: 4 },
  taskTitle: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.text.primary, lineHeight: 22 },
  taskDone: { textDecorationLine: 'line-through', color: Colors.text.muted },
  taskTag: { alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 8, borderRadius: Radius.full },
  taskTagText: { fontFamily: Fonts.medium, fontSize: 11 },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.md + 24 + Spacing.md },
  emptyCard: { alignItems: 'center', padding: Spacing.xl },
  emptyEmoji: { fontSize: 40, marginBottom: Spacing.md },
  emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary, marginBottom: Spacing.xs },
  emptySub: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.muted, marginBottom: Spacing.lg },
  emptyBtn: { backgroundColor: Colors.purple, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: Radius.md },
  emptyBtnText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.white },
  goalsRow: { gap: Spacing.sm },
  goalChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.full, borderWidth: 1.5, maxWidth: 180 },
  goalChipEmoji: { fontSize: 14 },
  goalChipText: { fontFamily: Fonts.medium, fontSize: 12, flexShrink: 1 },
  quoteCard: { padding: Spacing.lg, borderColor: Colors.orange + '40', backgroundColor: Colors.orange + '08', marginBottom: Spacing.lg },
  quoteText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.secondary, lineHeight: 22, fontStyle: 'italic', marginBottom: Spacing.xs },
  quoteBrand: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.orange },
  modalContainer: { flex: 1 },
  modalSafe: { flex: 1, backgroundColor: Colors.cream },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.white },
  modalTitle: { fontFamily: Fonts.semiBold, fontSize: 17, color: Colors.text.primary },
  modalClose: { fontSize: 18, color: Colors.text.muted, padding: 4 },
  modalBody: { padding: Spacing.lg },
  inputLabel: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.primary, marginBottom: Spacing.sm },
  taskInput: { backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.purple, padding: Spacing.md, fontFamily: Fonts.regular, fontSize: 15, color: Colors.text.primary, minHeight: 80, textAlignVertical: 'top' },
  goalSelect: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  goalSelectChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white, maxWidth: 180 },
  goalSelectActive: { backgroundColor: Colors.purple, borderColor: Colors.purple },
  goalSelectEmoji: { fontSize: 14 },
  goalSelectText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.secondary, flexShrink: 1 },
  goalSelectActiveText: { color: Colors.white },
  aiSuggestBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sm + 2, borderRadius: Radius.md, backgroundColor: Colors.purple + '12', marginTop: Spacing.lg },
  aiSuggestBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.purple },
  addTaskBtn: { marginTop: Spacing.xl },
});
