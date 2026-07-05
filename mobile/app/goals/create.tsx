import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { goals as goalsApi } from '../../lib/api';
import { useGoalStore } from '../../lib/store';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { StepIndicator } from '../../components/onboarding/StepIndicator';
import { Colors, Fonts, Spacing, Radius, CATEGORY_META, Category } from '../../constants/theme';

const STEPS = ['Goal', 'Milestones', 'This Month', 'This Week', 'Today'];

export default function CreateGoal() {
  const router = useRouter();
  const { addGoal } = useGoalStore();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 0 — Goal basics
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('career');
  const [targetDate, setTargetDate] = useState('');

  // Step 1 — Milestones
  const [milestones, setMilestones] = useState(['', '', '']);

  // Step 2 — Monthly target
  const [monthlyTarget, setMonthlyTarget] = useState('');

  // Step 3 — Weekly focus
  const [weeklyFocus, setWeeklyFocus] = useState('');

  // Step 4 — First daily task
  const [firstTask, setFirstTask] = useState('');

  function canProceed() {
    if (step === 0) return title.trim().length >= 5;
    if (step === 1) return milestones.some((m) => m.trim().length > 2);
    if (step === 2) return monthlyTarget.trim().length > 2;
    if (step === 3) return weeklyFocus.trim().length > 2;
    return true;
  }

  function updateMilestone(i: number, val: string) {
    setMilestones((prev) => prev.map((m, idx) => (idx === i ? val : m)));
  }

  function addMilestone() {
    setMilestones((prev) => [...prev, '']);
  }

  async function saveGoal() {
    setSaving(true);
    try {
      const { data: goal, error } = await goalsApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        targetDate: targetDate || undefined,
      });

      if (error || !goal) throw new Error(error ?? 'Failed to create goal');

      addGoal({ ...goal, completionPercent: 0 });
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save goal. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else saveGoal();
  }

  const CATEGORIES = Object.entries(CATEGORY_META) as [Category, typeof CATEGORY_META[Category]][];

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => (step > 0 ? setStep(step - 1) : router.back())}>
            <Text style={styles.backText}>{step > 0 ? '← Back' : '✕'}</Text>
          </TouchableOpacity>
          <View style={styles.stepInfo}>
            <StepIndicator total={STEPS.length} current={step + 1} />
            <Text style={styles.stepLabel}>{STEPS[step]}</Text>
          </View>
          <Text style={styles.stepCount}>{step + 1}/{STEPS.length}</Text>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {step === 0 && (
            <View>
              <Text style={styles.stepTitle}>Define your goal 🎯</Text>
              <Text style={styles.stepSubtitle}>Be specific. Vague goals stay vague.</Text>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map(([key, meta]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setCategory(key)}
                    style={[styles.catCard, category === key && { borderColor: meta.color, backgroundColor: meta.color + '12' }]}
                  >
                    <Text style={styles.catCardEmoji}>{meta.emoji}</Text>
                    <Text style={[styles.catCardLabel, category === key && { color: meta.color }]}>{meta.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Input label="Goal Title" placeholder="e.g. Get a remote UX design role by December" value={title} onChangeText={setTitle} containerStyle={styles.field} />
              <Input label="Description (optional)" placeholder="Why does this matter to you?" value={description} onChangeText={setDescription} multiline numberOfLines={3} containerStyle={styles.field} />
              <Input label="Target date (optional)" placeholder="YYYY-MM-DD e.g. 2026-12-31" value={targetDate} onChangeText={setTargetDate} containerStyle={styles.field} />
            </View>
          )}

          {step === 1 && (
            <View>
              <Text style={styles.stepTitle}>Break it into milestones 🏁</Text>
              <Text style={styles.stepSubtitle}>What are the 3–5 big checkpoints on the way to this goal?</Text>
              <Card style={styles.goalPreview} variant="outlined">
                <Text style={styles.goalPreviewText}>{title}</Text>
              </Card>
              {milestones.map((m, i) => (
                <View key={i} style={styles.milestoneRow}>
                  <View style={styles.milestoneNum}>
                    <Text style={styles.milestoneNumText}>{i + 1}</Text>
                  </View>
                  <TextInput
                    style={styles.milestoneInput}
                    placeholder={`Milestone ${i + 1}…`}
                    value={m}
                    onChangeText={(v) => updateMilestone(i, v)}
                    placeholderTextColor={Colors.grey[400]}
                  />
                </View>
              ))}
              {milestones.length < 6 && (
                <TouchableOpacity onPress={addMilestone} style={styles.addMilestoneBtn}>
                  <Text style={styles.addMilestoneBtnText}>+ Add milestone</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.stepTitle}>This month's target 📅</Text>
              <Text style={styles.stepSubtitle}>
                What does real progress look like by end of{' '}
                {new Date().toLocaleDateString('en-NG', { month: 'long' })}?
              </Text>
              <Card style={styles.goalPreview} variant="outlined">
                <Text style={styles.goalPreviewText}>{title}</Text>
              </Card>
              <Input label="Monthly Target" placeholder="e.g. Complete 3 Figma UI challenge projects" value={monthlyTarget} onChangeText={setMonthlyTarget} multiline numberOfLines={2} containerStyle={styles.field} />
              <Card style={styles.tipCard} variant="outlined">
                <Text style={styles.tipTitle}>💡 Good monthly targets are:</Text>
                <Text style={styles.tipText}>• Specific and measurable</Text>
                <Text style={styles.tipText}>• Achievable in 30 days</Text>
                <Text style={styles.tipText}>• Directly connected to your big goal</Text>
              </Card>
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={styles.stepTitle}>This week's focus 🗓️</Text>
              <Text style={styles.stepSubtitle}>What's the one thing you'll push forward this week?</Text>
              <Card style={styles.goalPreview} variant="outlined">
                <Text style={styles.goalPreviewLabel}>Monthly:</Text>
                <Text style={styles.goalPreviewText}>{monthlyTarget}</Text>
              </Card>
              <Input label="Weekly Focus" placeholder="e.g. Watch all Figma fundamentals videos" value={weeklyFocus} onChangeText={setWeeklyFocus} multiline numberOfLines={2} containerStyle={styles.field} />
            </View>
          )}

          {step === 4 && (
            <View>
              <Text style={styles.stepTitle}>Your first action 🚀</Text>
              <Text style={styles.stepSubtitle}>What's the smallest action you can do today to get started?</Text>
              <Card style={styles.goalPreview} variant="outlined">
                <Text style={styles.goalPreviewLabel}>This week:</Text>
                <Text style={styles.goalPreviewText}>{weeklyFocus}</Text>
              </Card>
              <Input label="Today's First Task" placeholder="e.g. Watch first 30 min of Figma course" value={firstTask} onChangeText={setFirstTask} containerStyle={styles.field} />
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Your Goal Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryIcon}>🎯</Text>
                  <Text style={styles.summaryText}>{title}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryIcon}>🏁</Text>
                  <Text style={styles.summaryText}>{milestones.filter(Boolean).length} milestones</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryIcon}>📅</Text>
                  <Text style={styles.summaryText}>{monthlyTarget}</Text>
                </View>
              </Card>
            </View>
          )}
        </ScrollView>

        <View style={styles.cta}>
          <Button title={step === STEPS.length - 1 ? '🚀 Launch My Goal' : 'Continue →'} onPress={next} disabled={!canProceed()} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.white },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple, minWidth: 48 },
  stepInfo: { alignItems: 'center', gap: 4 },
  stepLabel: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.text.muted },
  stepCount: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.muted, minWidth: 48, textAlign: 'right' },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  stepTitle: { fontFamily: Fonts.bold, fontSize: 22, color: Colors.text.primary, lineHeight: 28, marginBottom: Spacing.sm },
  stepSubtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary, lineHeight: 20, marginBottom: Spacing.xl },
  label: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.text.primary, marginBottom: Spacing.sm },
  field: { marginBottom: Spacing.md },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  catCard: { width: '30%', padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white, alignItems: 'center', gap: 4 },
  catCardEmoji: { fontSize: 22 },
  catCardLabel: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.text.secondary, textAlign: 'center' },
  goalPreview: { padding: Spacing.md, marginBottom: Spacing.lg, borderColor: Colors.purpleLight, backgroundColor: Colors.purple + '08' },
  goalPreviewLabel: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.purple, marginBottom: 4 },
  goalPreviewText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.text.primary, lineHeight: 20 },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  milestoneNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.purple, alignItems: 'center', justifyContent: 'center' },
  milestoneNumText: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.white },
  milestoneInput: { flex: 1, backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary },
  addMilestoneBtn: { alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.purple, borderStyle: 'dashed', marginTop: Spacing.sm },
  addMilestoneBtnText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.purple },
  tipCard: { padding: Spacing.md, borderColor: Colors.orange + '40', backgroundColor: Colors.orange + '08' },
  tipTitle: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.orangeDark, marginBottom: Spacing.sm },
  tipText: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary, lineHeight: 20 },
  summaryCard: { padding: Spacing.md, backgroundColor: Colors.purple, borderRadius: Radius.lg, gap: Spacing.sm },
  summaryTitle: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.white + 'CC', marginBottom: 4 },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  summaryIcon: { fontSize: 14, marginTop: 1 },
  summaryText: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.white, flex: 1, lineHeight: 18 },
  cta: { padding: Spacing.lg, paddingBottom: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.cream },
});
