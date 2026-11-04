import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { milestones as milestonesApi, goals as goalsApi, ApiMilestoneDetail } from '../../lib/api';
import { MilestoneCelebration, MilestoneWin } from '../../components/ui/MilestoneCelebration';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Colors, Fonts, Spacing, Radius, CATEGORY_META } from '../../constants/theme';

export default function MilestoneDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [milestone, setMilestone] = useState<ApiMilestoneDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [win, setWin] = useState<MilestoneWin | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [addingResource, setAddingResource] = useState(false);
  const [reflection, setReflection] = useState('');
  const [savingReflection, setSavingReflection] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await milestonesApi.get(id);
    if (data) {
      setMilestone(data);
      setReflection(data.reflection ?? '');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function handleFinish() {
    if (!milestone) return;
    const completing = milestone.status !== 'completed';
    await milestonesApi.update(milestone.id, { completed: completing });
    load();
    if (completing) {
      const { data: goal } = await goalsApi.get(milestone.goal.id);
      const list = goal?.milestones ?? [];
      setWin({
        milestoneTitle: milestone.title,
        goalTitle: milestone.goal.title,
        done: list.filter((m) => m.status === 'completed').length,
        total: list.length,
        next: milestone.upNext,
      });
    }
  }

  async function handleAddSubtask() {
    if (!milestone || !newSubtask.trim()) return;
    setAddingSubtask(true);
    try {
      await milestonesApi.subtasks.create(milestone.id, newSubtask.trim());
      setNewSubtask('');
      load();
    } finally {
      setAddingSubtask(false);
    }
  }

  async function handleToggleSubtask(subtaskId: string, completed: boolean) {
    if (!milestone) return;
    setMilestone({
      ...milestone,
      subtasks: milestone.subtasks.map((s) => (s.id === subtaskId ? { ...s, completed: !completed } : s)),
    });
    await milestonesApi.subtasks.update(milestone.id, subtaskId, { completed: !completed });
    load();
  }

  function handleDeleteSubtask(subtaskId: string) {
    if (!milestone) return;
    Alert.alert('Remove task', 'Remove this from the execution plan?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await milestonesApi.subtasks.delete(milestone.id, subtaskId); load(); } },
    ]);
  }

  async function handleLogTime() {
    Alert.prompt
      ? Alert.prompt('Log Time', 'How many minutes did you spend on this?', async (text) => {
          const minutes = Number(text);
          if (!minutes || minutes <= 0 || !milestone) return;
          await milestonesApi.update(milestone.id, { logMinutes: minutes });
          load();
        }, 'plain-text', '', 'number-pad')
      : promptFallback();

    function promptFallback() {
      // Android has no native Alert.prompt — fall back to a fixed 30-minute
      // increment so the action still works everywhere.
      Alert.alert('Log Time', 'Log 30 minutes toward this milestone?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log 30 min',
          onPress: async () => {
            if (!milestone) return;
            await milestonesApi.update(milestone.id, { logMinutes: 30 });
            load();
          },
        },
      ]);
    }
  }

  async function handleAddResource() {
    if (!milestone || !resourceTitle.trim() || !resourceUrl.trim()) return;
    const url = /^https?:\/\//i.test(resourceUrl.trim()) ? resourceUrl.trim() : `https://${resourceUrl.trim()}`;
    setAddingResource(true);
    try {
      const { error } = await milestonesApi.resources.create(milestone.id, resourceTitle.trim(), url);
      if (error) {
        Alert.alert('Could not add resource', error);
        return;
      }
      setResourceTitle('');
      setResourceUrl('');
      setShowResourceForm(false);
      load();
    } finally {
      setAddingResource(false);
    }
  }

  function handleDeleteResource(resourceId: string) {
    if (!milestone) return;
    Alert.alert('Remove resource?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await milestonesApi.resources.delete(milestone.id, resourceId); load(); } },
    ]);
  }

  async function handleSaveReflection() {
    if (!milestone) return;
    setSavingReflection(true);
    try {
      await milestonesApi.update(milestone.id, { reflection });
      load();
    } finally {
      setSavingReflection(false);
    }
  }

  if (loading || !milestone) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
        {loading && <ActivityIndicator color={Colors.purple} style={{ marginTop: Spacing.xxl }} />}
      </SafeAreaView>
    );
  }

  const meta = CATEGORY_META[milestone.goal.category as keyof typeof CATEGORY_META] ?? CATEGORY_META.career;
  const done = milestone.status === 'completed';
  const progressPercent = milestone.subtaskCompletionPercent ?? (done ? 100 : 0);
  const hours = Math.floor(milestone.timeInvestedMinutes / 60);
  const mins = milestone.timeInvestedMinutes % 60;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.purple} />}
      >
        <TouchableOpacity onPress={() => router.push(`/goals/${milestone.goalId}`)}>
          <Text style={styles.parentGoal}>🏳 Parent Goal: {milestone.goal.title}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{milestone.title}</Text>

        {!done && <Button title="Finish Milestone →" onPress={handleFinish} style={styles.finishBtn} />}
        {done && (
          <View style={styles.doneBadge}>
            <Text style={styles.doneBadgeText}>✓ Completed</Text>
          </View>
        )}

        <Card style={styles.statCard} variant="default">
          <Text style={styles.statLabel}>Overall Progress</Text>
          <Text style={[styles.statValue, { color: meta.color }]}>{progressPercent}%</Text>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: meta.color }]} />
          </View>
        </Card>

        <Card style={styles.statCard} variant="default">
          <View style={styles.timeRow}>
            <View>
              <Text style={styles.statLabel}>Time Invested</Text>
              <Text style={styles.statValueSm}>{hours}h {mins}m</Text>
            </View>
            <TouchableOpacity onPress={handleLogTime} style={styles.logTimeBtn}>
              <Text style={styles.logTimeBtnText}>+ Log Time</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Execution Plan</Text>
          </View>
          <Card variant="default" style={styles.listCard}>
            {milestone.subtasks.length === 0 && (
              <Text style={styles.emptyText}>No sub-tasks yet — break this milestone down below.</Text>
            )}
            {milestone.subtasks.map((s, i) => (
              <View key={s.id}>
                <View style={styles.subtaskRow}>
                  <TouchableOpacity onPress={() => handleToggleSubtask(s.id, s.completed)} activeOpacity={0.7}>
                    <View style={[styles.checkbox, s.completed && { backgroundColor: meta.color, borderColor: meta.color }]}>
                      {s.completed && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                  <Text style={[styles.subtaskText, s.completed && styles.subtaskTextDone]}>{s.title}</Text>
                  <TouchableOpacity onPress={() => handleDeleteSubtask(s.id)} hitSlop={8}>
                    <Text style={styles.removeIcon}>×</Text>
                  </TouchableOpacity>
                </View>
                {i < milestone.subtasks.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </Card>
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              placeholder="Add a task…"
              placeholderTextColor={Colors.grey[400]}
              value={newSubtask}
              onChangeText={setNewSubtask}
              onSubmitEditing={handleAddSubtask}
            />
            <TouchableOpacity onPress={handleAddSubtask} disabled={addingSubtask} style={styles.addBtn}>
              <Text style={styles.addBtnText}>{addingSubtask ? '…' : '+ Add'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resources</Text>
          <Card variant="default" style={styles.listCard}>
            {milestone.resources.length === 0 && !showResourceForm && (
              <Text style={styles.emptyText}>No links added yet.</Text>
            )}
            {milestone.resources.map((r, i) => (
              <View key={r.id}>
                <View style={styles.resourceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resourceTitle}>{r.title}</Text>
                    <Text style={styles.resourceUrl} numberOfLines={1}>{r.url}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteResource(r.id)} hitSlop={8}>
                    <Text style={styles.removeIcon}>×</Text>
                  </TouchableOpacity>
                </View>
                {i < milestone.resources.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </Card>
          {showResourceForm ? (
            <View style={styles.resourceForm}>
              <TextInput
                style={styles.addInput}
                placeholder="Title (e.g. Toastmasters guide)"
                placeholderTextColor={Colors.grey[400]}
                value={resourceTitle}
                onChangeText={setResourceTitle}
              />
              <TextInput
                style={styles.addInput}
                placeholder="https://…"
                placeholderTextColor={Colors.grey[400]}
                value={resourceUrl}
                onChangeText={setResourceUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button title={addingResource ? 'Adding…' : 'Add Resource'} onPress={handleAddResource} disabled={addingResource} size="sm" />
            </View>
          ) : (
            <TouchableOpacity onPress={() => setShowResourceForm(true)} style={styles.addRowSingle}>
              <Text style={styles.addBtnText}>+ Add resource link</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reflection</Text>
          <Card variant="outlined" style={styles.reflectionCard}>
            <TextInput
              style={styles.reflectionInput}
              placeholder="What did you learn working on this?"
              placeholderTextColor={Colors.grey[400]}
              value={reflection}
              onChangeText={setReflection}
              multiline
            />
            {milestone.reflectionUpdatedAt && (
              <Text style={styles.reflectionMeta}>
                Last updated {new Date(milestone.reflectionUpdatedAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </Text>
            )}
            <Button
              title="Save Reflection"
              onPress={handleSaveReflection}
              loading={savingReflection}
              variant="secondary"
              size="sm"
              style={{ marginTop: Spacing.sm }}
            />
          </Card>
        </View>

        {milestone.upNext && (
          <View style={styles.upNextCard}>
            <Text style={styles.upNextLabel}>UP NEXT</Text>
            <Text style={styles.upNextTitle}>{milestone.upNext.title}</Text>
            <Text style={styles.upNextSub}>Unlocks after completing this milestone.</Text>
          </View>
        )}
      </ScrollView>
      <MilestoneCelebration
        win={win}
        onClose={() => setWin(null)}
        onNext={(next) => {
          setWin(null);
          if (next) router.replace(`/milestones/${next.id}`);
          else router.back();
        }}
        onShare={() => {
          const w = win;
          setWin(null);
          router.push({ pathname: '/(tabs)/community/index', params: { prefillHeadline: w?.milestoneTitle ?? '', prefillKind: 'milestone' } });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  parentGoal: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.muted, marginBottom: Spacing.xs },
  title: { fontFamily: Fonts.bold, fontSize: 24, color: Colors.text.primary, lineHeight: 30, marginBottom: Spacing.lg },
  finishBtn: { marginBottom: Spacing.lg },
  doneBadge: { alignSelf: 'flex-start', backgroundColor: Colors.success + '20', paddingVertical: 6, paddingHorizontal: Spacing.md, borderRadius: Radius.full, marginBottom: Spacing.lg },
  doneBadgeText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.success },
  statCard: { padding: Spacing.md, marginBottom: Spacing.md },
  statLabel: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.muted, marginBottom: 4 },
  statValue: { fontFamily: Fonts.bold, fontSize: 28, marginBottom: Spacing.sm },
  statValueSm: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.text.primary },
  progressBg: { height: 8, backgroundColor: Colors.grey[100], borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.full },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logTimeBtn: { backgroundColor: Colors.purple + '15', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.md },
  logTimeBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.purple },
  section: { marginTop: Spacing.md, marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary, marginBottom: Spacing.sm },
  listCard: { padding: 0, overflow: 'hidden' },
  emptyText: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.muted, padding: Spacing.md, fontStyle: 'italic' },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.grey[300], alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: Colors.white, fontSize: 11, fontFamily: Fonts.bold },
  subtaskText: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary },
  subtaskTextDone: { textDecorationLine: 'line-through', color: Colors.text.muted },
  removeIcon: { fontSize: 20, color: Colors.grey[400], paddingHorizontal: 4 },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.md },
  addRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  addInput: {
    flex: 1, backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary,
  },
  addBtn: { justifyContent: 'center', paddingHorizontal: Spacing.md },
  addBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.purple },
  addRowSingle: { marginTop: Spacing.sm, alignItems: 'center', paddingVertical: Spacing.sm },
  resourceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 },
  resourceTitle: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.primary },
  resourceUrl: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.purple, marginTop: 2 },
  resourceForm: { gap: Spacing.sm, marginTop: Spacing.sm },
  reflectionCard: { padding: Spacing.md },
  reflectionInput: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary, minHeight: 80, textAlignVertical: 'top' },
  reflectionMeta: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.text.muted, marginTop: Spacing.sm },
  upNextCard: { backgroundColor: Colors.purple, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  upNextLabel: { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.white + 'AA', letterSpacing: 0.6, marginBottom: 4 },
  upNextTitle: { fontFamily: Fonts.bold, fontSize: 17, color: Colors.white, marginBottom: 4 },
  upNextSub: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.white + 'CC' },
});
