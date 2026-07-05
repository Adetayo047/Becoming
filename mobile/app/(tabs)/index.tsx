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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { tasks, goals as goalsApi, ApiTask, ApiGoal } from '../../lib/api';
import { useAuthStore, useGoalStore } from '../../lib/store';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Colors, Fonts, Spacing, Radius, CATEGORY_META } from '../../constants/theme';

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
          {cat && (
            <View style={[styles.taskTag, { backgroundColor: cat.color + '18' }]}>
              <Text style={[styles.taskTagText, { color: cat.color }]}>{cat.emoji} {cat.label}</Text>
            </View>
          )}
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

  async function loadData() {
    const [tasksRes, goalsRes] = await Promise.all([
      tasks.list(formatDate(new Date())),
      goalsApi.list('active'),
    ]);
    if (tasksRes.data) setTodayTasks(tasksRes.data);
    if (goalsRes.data) setGoals(goalsRes.data);
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
    toggleTask(taskId);
    await tasks.update(taskId, { completed: !task.completed });
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
            <Text style={styles.streakCount}>0</Text>
          </View>
        </View>

        {totalCount > 0 && (
          <Card style={styles.progressCard} variant="elevated">
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>{completedCount} of {totalCount} tasks done</Text>
              <Text style={styles.progressPercent}>{progressPercent}%</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
            {completedCount === totalCount && totalCount > 0 && (
              <Text style={styles.allDone}>🎉 All done! You crushed today.</Text>
            )}
          </Card>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Tasks</Text>
            <TouchableOpacity onPress={() => setShowAddTask(true)} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
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
            <Card variant="default" style={styles.taskCard}>
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
          <Text style={styles.quoteText}>"Small steps every day. Big change tomorrow."</Text>
          <Text style={styles.quoteBrand}>— Becoming</Text>
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

              <Button title="Add Task" onPress={handleAddTask} loading={addingTask} disabled={!newTaskTitle.trim()} style={styles.addTaskBtn} />
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
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
  progressCard: { marginBottom: Spacing.lg },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  progressLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.secondary },
  progressPercent: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.purple },
  progressBg: { height: 8, backgroundColor: Colors.grey[100], borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.purple, borderRadius: Radius.full },
  allDone: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.success, marginTop: Spacing.sm, textAlign: 'center' },
  section: { marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  sectionTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary },
  addBtn: { backgroundColor: Colors.purple + '15', paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: Radius.full },
  addBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.purple },
  seeAll: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.purple },
  taskCard: { padding: 0, overflow: 'hidden' },
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
  goalChipText: { fontFamily: Fonts.medium, fontSize: 12, flex: 1 },
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
  goalSelectText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.secondary, flex: 1 },
  goalSelectActiveText: { color: Colors.white },
  addTaskBtn: { marginTop: Spacing.xl },
});
