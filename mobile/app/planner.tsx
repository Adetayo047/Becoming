import { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { planner, tasks, ApiPlanner, ApiPlannerGap, ApiTask, ApiYearPlan, PlanKind } from '../lib/api';
import { Card } from '../components/ui/Card';
import { ProgressRing } from '../components/ui/ProgressRing';
import { PlanItemList } from '../components/planner/PlanItemList';
import { YearView, MonthView, WeekView, RenderList } from '../components/planner/PlanAhead';
import { addDays, addMonths, dayLabel, mondayOf, monthLabel, todayKey, weekRangeLabel } from '../components/planner/dates';
import { Colors, Fonts, Spacing, Radius, CATEGORY_META, Category } from '../constants/theme';

type Level = 'year' | 'month' | 'week' | 'day';
const LEVELS: { key: Level; label: string }[] = [
  { key: 'year', label: 'Year' },
  { key: 'month', label: 'Month' },
  { key: 'week', label: 'Week' },
  { key: 'day', label: 'Day' },
];

function categoryEmoji(category: string) {
  return CATEGORY_META[category as Category]?.emoji ?? '🎯';
}

/** Whether `a` and `b` fall in the same year/month/week/day. */
function samePeriod(level: Level, a: string, b: string) {
  if (level === 'year') return a.slice(0, 4) === b.slice(0, 4);
  if (level === 'month') return a.slice(0, 7) === b.slice(0, 7);
  if (level === 'week') return mondayOf(a) === mondayOf(b);
  return a === b;
}

// Cascading Action Planner — plan the year, then break it into months, weeks
// and days. Every level shows the one above it, and the Day view adds the
// alignment score and the gaps that break the cascade.
export default function PlannerScreen() {
  const router = useRouter();
  const today = todayKey();
  // Deep links (e.g. "Start Next Sprint" after a weekly review) can open a level/date.
  const params = useLocalSearchParams<{ level?: Level; date?: string }>();
  const [level, setLevel] = useState<Level | null>(params.level && LEVELS.some((l) => l.key === params.level) ? params.level : null);
  const [focusDate, setFocusDate] = useState(params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today);
  const [yearPlan, setYearPlan] = useState<ApiYearPlan | null>(null);
  const [data, setData] = useState<ApiPlanner | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState('');
  const [taskGoal, setTaskGoal] = useState<string | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    const [{ data: y }, { data: d }] = await Promise.all([planner.year(Number(focusDate.slice(0, 4))), planner.get(focusDate)]);
    if (y) setYearPlan(y);
    if (d) setData(d);
    // Start where planning starts: the year, until it has outcomes.
    if (y) setLevel((l) => l ?? (y.goals.length > 0 && !y.goals.some((g) => g.yearlyTargets.length > 0) ? 'year' : 'day'));
    setRefreshing(false);
  }, [focusDate]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function open(next: Level, date: string) {
    setAddingKey(null);
    setLevel(next);
    setFocusDate(samePeriod(next, date, today) ? today : date);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  function step(dir: 1 | -1) {
    if (!level) return;
    const y = Number(focusDate.slice(0, 4));
    const start =
      level === 'year' ? `${y + dir}-01-01`
      : level === 'month' ? addMonths(focusDate, dir)
      : level === 'week' ? addDays(mondayOf(focusDate), 7 * dir)
      : addDays(focusDate, dir);
    open(level, start);
  }

  const renderList: RenderList = (kind, goalId, period, items, bullet) => {
    const key = `${kind}-${goalId}`;
    return (
      <PlanItemList
        kind={kind}
        goalId={goalId}
        period={period}
        items={items}
        bullet={bullet}
        adding={addingKey === key}
        onStartAdd={() => setAddingKey(key)}
        onCancelAdd={() => setAddingKey(null)}
        onChanged={load}
      />
    );
  };

  function startTask(goalId?: string) {
    setTaskDraft('');
    setTaskGoal(goalId ?? data?.goals[0]?.id ?? null);
    setAddingKey('task');
  }

  async function handleAddTask() {
    if (!data || taskDraft.trim().length < 2) return;
    setSavingTask(true);
    const { error } = await tasks.create({ title: taskDraft.trim(), goalId: taskGoal ?? undefined, date: data.today });
    setSavingTask(false);
    if (error) {
      Alert.alert('Could not add', error);
      return;
    }
    setAddingKey(null);
    load();
  }

  async function toggleTask(task: ApiTask) {
    await tasks.update(task.id, { completed: !task.completed });
    load();
  }

  function linkTask(task: ApiTask) {
    if (!data || data.goals.length === 0) {
      Alert.alert('No goals yet', 'Create a goal first, then link this action to it.');
      return;
    }
    Alert.alert('Link to a goal', `Which goal does "${task.title}" move forward?`, [
      ...data.goals.slice(0, 2).map((g) => ({
        text: `${categoryEmoji(g.category)} ${g.title}`,
        onPress: async () => {
          await tasks.update(task.id, { goalId: g.id });
          load();
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  function fixGap(gap: ApiPlannerGap) {
    if (gap.type === 'unlinked_task') {
      const task = data?.todayTasks.find((t) => t.id === gap.taskId);
      if (task) linkTask(task);
    } else if (gap.type === 'no_tasks_week') {
      startTask(gap.goalId);
    } else if (gap.goalId) {
      const kind: PlanKind = gap.type === 'no_yearly' ? 'yearly' : gap.type === 'no_monthly' ? 'monthly' : 'weekly';
      setAddingKey(`${kind}-${gap.goalId}`);
    }
  }

  if (!level || !yearPlan || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.purple} style={{ marginTop: Spacing.xxl }} />
      </SafeAreaView>
    );
  }

  const periodLabel =
    level === 'year' ? focusDate.slice(0, 4)
    : level === 'month' ? monthLabel(focusDate.slice(0, 7))
    : level === 'week' ? `${weekRangeLabel(mondayOf(focusDate))} ${focusDate.slice(0, 4)}`
    : focusDate === today ? `Today · ${dayLabel(focusDate)}` : dayLabel(focusDate);

  const scheduled = data.todayTasks
    .filter((t) => t.scheduledStart)
    .sort((a, b) => (a.scheduledStart! < b.scheduledStart! ? -1 : 1));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.purple} />}
      >
        <Text style={styles.title}>Planner</Text>
        <Text style={styles.subtitle}>Plan your year, then break it into months, weeks and days.</Text>

        <View style={styles.tabs}>
          {LEVELS.map((l) => (
            <TouchableOpacity key={l.key} style={[styles.tab, level === l.key && styles.tabActive]} onPress={() => open(l.key, focusDate)}>
              <Text style={[styles.tabText, level === l.key && styles.tabTextActive]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.periodNav}>
          <TouchableOpacity onPress={() => step(-1)} hitSlop={12} style={styles.navBtn}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <View style={styles.periodCenter}>
            <Text style={styles.periodLabel}>{periodLabel}</Text>
            {!samePeriod(level, focusDate, today) && (
              <TouchableOpacity onPress={() => open(level, today)}>
                <Text style={styles.backToNow}>Back to now</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={() => step(1)} hitSlop={12} style={styles.navBtn}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {data.goals.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Your plan starts with a goal. Create one to cascade it into yearly, monthly, weekly and daily steps.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/goals/create')}>
              <Text style={styles.primaryBtnText}>Create a Goal</Text>
            </TouchableOpacity>
          </Card>
        ) : level === 'year' ? (
          <YearView plan={yearPlan} today={today} renderList={renderList} onOpenMonth={(m) => open('month', `${m}-01`)} />
        ) : level === 'month' ? (
          <MonthView plan={yearPlan} month={focusDate.slice(0, 7)} today={today} renderList={renderList} onOpenWeek={(w) => open('week', w)} />
        ) : level === 'week' ? (
          <WeekView plan={yearPlan} weekStart={mondayOf(focusDate)} today={today} renderList={renderList} onOpenDay={(d) => open('day', d)} />
        ) : (
          <>
            {/* Yearly outcomes */}
            <Card style={{ ...styles.levelCard, borderLeftColor: Colors.purpleDark }}>
              <View style={styles.levelHeader}>
                <Text style={styles.levelLabel}>🎯  YEARLY OUTCOMES</Text>
                <View style={[styles.badge, { backgroundColor: Colors.purpleDark }]}><Text style={styles.badgeText}>{data.year}</Text></View>
              </View>
              {data.goals.map((g) => (
                <View key={g.id} style={styles.goalBlock}>
                  <Text style={styles.goalName} numberOfLines={2}>{categoryEmoji(g.category)} {g.title}</Text>
                  {renderList('yearly', g.id, String(data.year), g.yearlyTargets)}
                </View>
              ))}
            </Card>

            {/* Monthly focus */}
            <Card style={{ ...styles.levelCard, borderLeftColor: Colors.purple }}>
              <View style={styles.levelHeader}>
                <Text style={styles.levelLabel}>📅  MONTHLY FOCUS</Text>
                <View style={styles.badge}><Text style={styles.badgeText}>{monthLabel(data.month)}</Text></View>
              </View>
              {data.goals.map((g) => (
                <View key={g.id} style={styles.goalBlock}>
                  {data.goals.length > 1 && (
                    <Text style={styles.goalNameSmall} numberOfLines={1}>{categoryEmoji(g.category)} {g.title}</Text>
                  )}
                  {renderList('monthly', g.id, data.month, g.monthlyTargets)}
                  <View style={styles.progressRow}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${g.completionPercent}%` }]} />
                    </View>
                    <Text style={styles.progressText}>{g.completionPercent}% Achieved</Text>
                  </View>
                </View>
              ))}
            </Card>

            {/* Weekly milestones */}
            <Card style={{ ...styles.levelCard, borderLeftColor: Colors.orange }}>
              <View style={styles.levelHeader}>
                <Text style={styles.levelLabel}>🚩  WEEKLY MILESTONES</Text>
                <Text style={styles.weekText}>{weekRangeLabel(data.weekStart)}</Text>
              </View>
              {data.goals.map((g) => (
                <View key={g.id} style={styles.goalBlock}>
                  {data.goals.length > 1 && (
                    <Text style={styles.goalNameSmall} numberOfLines={1}>{categoryEmoji(g.category)} {g.title}</Text>
                  )}
                  {renderList('weekly', g.id, data.weekStart, g.weeklyFocuses, true)}
                </View>
              ))}
              <Text style={styles.hint}>Tap to mark done · long-press to remove</Text>
            </Card>

            {/* The day's actions */}
            <Card style={{ ...styles.levelCard, borderLeftColor: Colors.purple }}>
              <View style={styles.levelHeader}>
                <Text style={styles.levelLabel}>⚡  {data.today === today ? "TODAY'S ACTIONS" : `ACTIONS · ${dayLabel(data.today).toUpperCase()}`}</Text>
              </View>
              {data.todayTasks.map((t) => {
                const unlinked = !t.goalId;
                return (
                  <View key={t.id} style={[styles.taskRow, unlinked && styles.taskRowWarn]}>
                    <TouchableOpacity onPress={() => toggleTask(t)} style={[styles.checkbox, t.completed && styles.checkboxDone]}>
                      {t.completed && <Text style={styles.checkMark}>✓</Text>}
                    </TouchableOpacity>
                    <Text style={[styles.taskText, t.completed && styles.strike]} numberOfLines={2}>{t.title}</Text>
                    {unlinked ? (
                      <TouchableOpacity onPress={() => linkTask(t)} hitSlop={8}>
                        <Text style={styles.warnIcon}>⚠️</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.taskGoal}>{categoryEmoji(t.goal?.category ?? '')}</Text>
                    )}
                  </View>
                );
              })}
              {addingKey === 'task' ? (
                <View style={styles.taskComposer}>
                  <View style={styles.addRow}>
                    <TextInput
                      style={styles.addInput}
                      value={taskDraft}
                      onChangeText={setTaskDraft}
                      placeholder="e.g. Send 2 applications"
                      placeholderTextColor={Colors.text.muted}
                      autoFocus
                      onSubmitEditing={handleAddTask}
                      returnKeyType="done"
                    />
                    <TouchableOpacity style={styles.addBtn} onPress={handleAddTask} disabled={savingTask}>
                      {savingTask ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.addBtnText}>Add</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setAddingKey(null)} style={styles.cancelAdd}>
                      <Text style={styles.cancelAddText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.chipLabel}>Moves forward:</Text>
                  <View style={styles.chips}>
                    {data.goals.map((g) => (
                      <TouchableOpacity key={g.id} style={[styles.chip, taskGoal === g.id && styles.chipActive]} onPress={() => setTaskGoal(g.id)}>
                        <Text style={[styles.chipText, taskGoal === g.id && styles.chipTextActive]} numberOfLines={1}>
                          {categoryEmoji(g.category)} {g.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={() => startTask()}>
                  <Text style={styles.addLink}>{data.todayTasks.length === 0 ? '＋ Add the first action' : '＋ Add action'}</Text>
                </TouchableOpacity>
              )}
            </Card>

            {/* Alignment */}
            <View style={styles.alignCard}>
              <Text style={styles.alignLabel}>ALIGNMENT STATUS</Text>
              <View style={styles.alignRing}>
                <ProgressRing
                  percent={data.alignment.score}
                  size={110}
                  strokeWidth={9}
                  color={Colors.white}
                  trackColor="rgba(255,255,255,0.25)"
                  label={`${data.alignment.score}%`}
                />
              </View>
              <Text style={styles.alignMessage}>{data.alignment.message}</Text>
              {data.gaps.length > 0 && (
                <View style={styles.gapList}>
                  <Text style={styles.gapTitle}>Alignment gaps</Text>
                  {data.gaps.map((gap, i) => (
                    <TouchableOpacity key={`${gap.type}-${gap.goalId ?? gap.taskId}-${i}`} style={styles.gapRow} onPress={() => fixGap(gap)}>
                      <Text style={styles.gapText}>⚠️  {gap.message}</Text>
                      <Text style={styles.gapFix}>Fix →</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Schedule */}
            {data.today === today && (
              <Card style={styles.scheduleCard}>
                <Text style={styles.levelLabel}>SCHEDULE</Text>
                {scheduled.length === 0 ? (
                  <TouchableOpacity style={styles.noEvents} onPress={() => router.push('/ai-day-planner')}>
                    <Text style={styles.noEventsText}>No time blocks yet — ✨ Plan My Day</Text>
                  </TouchableOpacity>
                ) : (
                  scheduled.map((t, i) => (
                    <View key={t.id} style={styles.scheduleRow}>
                      <Text style={styles.scheduleTime}>{t.scheduledStart}</Text>
                      <View style={[styles.scheduleBlock, { borderLeftColor: i % 2 === 0 ? Colors.purple : Colors.orange }]}>
                        <Text style={styles.scheduleTitle} numberOfLines={1}>{t.title}</Text>
                        {t.goal && <Text style={styles.scheduleSub} numberOfLines={1}>{t.goal.title}</Text>}
                      </View>
                    </View>
                  ))
                )}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
  title: { fontFamily: Fonts.bold, fontSize: 28, color: Colors.text.primary },
  subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary, lineHeight: 20, marginBottom: Spacing.md },
  tabs: { flexDirection: 'row', backgroundColor: Colors.surfaceContainer, borderRadius: Radius.full, padding: 4, marginBottom: Spacing.md },
  tab: { flex: 1, paddingVertical: 8, borderRadius: Radius.full, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.purple },
  tabText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.onSurfaceVariant },
  tabTextActive: { color: Colors.white, fontFamily: Fonts.semiBold },
  periodNav: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  navBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  navArrow: { fontSize: 24, lineHeight: 26, color: Colors.purple },
  periodCenter: { flex: 1, alignItems: 'center' },
  periodLabel: { fontFamily: Fonts.bold, fontSize: 17, color: Colors.text.primary },
  backToNow: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.purple, marginTop: 2 },
  emptyCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  emptyText: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary, lineHeight: 20, marginBottom: Spacing.md },
  primaryBtn: { backgroundColor: Colors.purple, borderRadius: Radius.full, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.white },
  levelCard: { padding: Spacing.lg, marginBottom: Spacing.md, borderLeftWidth: 4 },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  levelLabel: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.onSurfaceVariant, letterSpacing: 0.8 },
  badge: { backgroundColor: Colors.purple, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.white },
  weekText: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.orange },
  goalBlock: { marginTop: Spacing.sm },
  goalName: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.text.primary, marginBottom: Spacing.xs },
  goalNameSmall: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.text.muted, marginBottom: 2 },
  strike: { textDecorationLine: 'line-through', color: Colors.text.muted },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.grey[400], alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  checkboxDone: { backgroundColor: Colors.purple, borderColor: Colors.purple },
  checkMark: { color: Colors.white, fontSize: 13, fontFamily: Fonts.bold },
  addLink: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.purple, paddingVertical: 6 },
  addRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  addInput: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 8, backgroundColor: Colors.surfaceContainerLow },
  addBtn: { backgroundColor: Colors.purple, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 9, marginLeft: Spacing.sm },
  addBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.white },
  cancelAdd: { paddingHorizontal: 8, paddingVertical: 8 },
  cancelAddText: { fontSize: 14, color: Colors.text.muted },
  taskComposer: { marginTop: Spacing.xs },
  chipLabel: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.muted, marginTop: Spacing.sm, marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { maxWidth: '100%', borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  chipActive: { backgroundColor: Colors.purple, borderColor: Colors.purple },
  chipText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.secondary },
  chipTextActive: { color: Colors.white },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.surfaceContainer, marginRight: Spacing.md },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: Colors.purple },
  progressText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.purple },
  hint: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.text.muted, marginTop: Spacing.sm },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1, borderColor: 'transparent', marginTop: 4 },
  taskRowWarn: { backgroundColor: '#FFF1F0', borderColor: '#FFD6D2' },
  taskText: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary },
  warnIcon: { fontSize: 16, marginLeft: Spacing.sm },
  taskGoal: { fontSize: 14, marginLeft: Spacing.sm },
  alignCard: { backgroundColor: Colors.purpleDark, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md, alignItems: 'center' },
  alignLabel: { alignSelf: 'flex-start', fontFamily: Fonts.semiBold, fontSize: 12, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.8 },
  alignRing: { marginVertical: Spacing.md },
  alignMessage: { fontFamily: Fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 20 },
  gapList: { alignSelf: 'stretch', marginTop: Spacing.md, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: Radius.md, padding: Spacing.md },
  gapTitle: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.white, marginBottom: Spacing.xs },
  gapRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  gapText: { flex: 1, fontFamily: Fonts.regular, fontSize: 12, color: Colors.white, lineHeight: 17 },
  gapFix: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.orange, marginLeft: Spacing.sm },
  scheduleCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  noEvents: { marginTop: Spacing.md, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.outlineVariant, borderRadius: Radius.sm, padding: Spacing.md },
  noEventsText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.purple, textAlign: 'center' },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md },
  scheduleTime: { width: 52, fontFamily: Fonts.medium, fontSize: 13, color: Colors.purple },
  scheduleBlock: { flex: 1, backgroundColor: Colors.surfaceContainer, borderLeftWidth: 3, borderRadius: Radius.sm, paddingVertical: 8, paddingHorizontal: Spacing.sm },
  scheduleTitle: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.primary },
  scheduleSub: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.text.muted },
});
