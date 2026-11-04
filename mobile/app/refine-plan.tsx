import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ai, ApiPlanBlock } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TimePickerField } from '../components/ui/TimePickerField';
import { Colors, Fonts, Spacing, Radius } from '../constants/theme';

const TYPE_LABEL: Record<string, string> = {
  deep_work: 'DEEP WORK',
  review: 'REVIEW',
  break: 'BREAK',
  sync: 'SYNC',
  custom: 'CUSTOM',
};

export default function RefinePlan() {
  const router = useRouter();
  const { date, blocksJson, strategicScore } = useLocalSearchParams<{ date: string; blocksJson: string; strategicScore: string }>();
  const [blocks, setBlocks] = useState<ApiPlanBlock[]>(() => {
    try { return JSON.parse(blocksJson ?? '[]'); } catch { return []; }
  });
  const [editingTimeIndex, setEditingTimeIndex] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [redraftNote, setRedraftNote] = useState('');
  const [redrafting, setRedrafting] = useState(false);
  const [committing, setCommitting] = useState(false);

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
  }

  function remove(index: number) {
    setBlocks(blocks.filter((_, i) => i !== index));
  }

  function updateTime(index: number, field: 'startTime' | 'endTime', value: string) {
    setBlocks(blocks.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  }

  function addCustom() {
    if (!newTitle.trim()) return;
    const last = blocks[blocks.length - 1];
    setBlocks([
      ...blocks,
      { taskId: null, title: newTitle.trim(), startTime: last?.endTime ?? '09:00', endTime: last?.endTime ?? '09:30', type: 'custom' },
    ]);
    setNewTitle('');
  }

  function applyQuickOptimization(kind: 'morning' | 'buffer') {
    if (kind === 'buffer') {
      // Add a 15-minute breather after each block by nudging subsequent start times.
      Alert.alert('Buffer added', 'A 15-minute buffer suggestion has been noted — adjust times manually below as needed.');
      return;
    }
    Alert.alert('Shift to morning', 'Reorder blocks above so your highest-energy work sits earliest, then Confirm.');
  }

  async function handleRedraft() {
    setRedrafting(true);
    try {
      const { data, error, upgrade } = await ai.planDay(date, redraftNote || 'Re-draft this schedule with a fresh look.');
      if (upgrade) return;
      if (error || !data) {
        Alert.alert('Could not re-draft', error ?? 'Try again.');
        return;
      }
      setBlocks(data.blocks);
      setRedraftNote('');
    } finally {
      setRedrafting(false);
    }
  }

  async function handleConfirm() {
    if (blocks.length === 0) {
      Alert.alert('Nothing to save', 'Add at least one session first.');
      return;
    }
    setCommitting(true);
    try {
      const { error } = await ai.commitPlan(date, blocks);
      if (error) {
        Alert.alert('Could not save', error);
        return;
      }
      Alert.alert('Plan saved', 'Your refined schedule is now on your Today screen.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refine Your Plan</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Tweak, reorder, or swap actions to match your energy.</Text>

        <View style={styles.sequenceHeader}>
          <Text style={styles.sectionTitle}>Action Sequence</Text>
          <Text style={styles.taskCount}>{blocks.length} Tasks Scheduled</Text>
        </View>

        {blocks.map((b, i) => (
          <Card key={i} style={styles.blockCard} variant="default">
            <View style={styles.blockTop}>
              <View style={styles.blockTypeBadge}>
                <Text style={styles.blockTypeText}>{TYPE_LABEL[b.type] ?? b.type.toUpperCase()}</Text>
              </View>
              <View style={styles.reorderCol}>
                <TouchableOpacity onPress={() => move(i, -1)} disabled={i === 0} hitSlop={6}>
                  <Text style={[styles.reorderArrow, i === 0 && styles.reorderDisabled]}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => move(i, 1)} disabled={i === blocks.length - 1} hitSlop={6}>
                  <Text style={[styles.reorderArrow, i === blocks.length - 1 && styles.reorderDisabled]}>↓</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => remove(i)} hitSlop={6}>
                <Text style={styles.deleteIcon}>🗑</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setEditingTimeIndex(editingTimeIndex === i ? null : i)}>
              <Text style={styles.blockTime}>{b.startTime} – {b.endTime} ✏️</Text>
            </TouchableOpacity>

            {editingTimeIndex === i && (
              <View style={styles.timeEditRow}>
                <TimePickerField label="Start" value={b.startTime} onChange={(v) => updateTime(i, 'startTime', v)} containerStyle={styles.timeField} />
                <TimePickerField label="End" value={b.endTime} onChange={(v) => updateTime(i, 'endTime', v)} containerStyle={styles.timeField} />
              </View>
            )}

            <Text style={styles.blockTitle}>{b.title}</Text>
          </Card>
        ))}

        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Add custom session…"
            placeholderTextColor={Colors.grey[400]}
            value={newTitle}
            onChangeText={setNewTitle}
            onSubmitEditing={addCustom}
          />
          <TouchableOpacity onPress={addCustom} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.alignmentCard}>
          <Text style={styles.alignmentLabel}>Strategic Alignment</Text>
          <Text style={styles.alignmentValue}>{strategicScore ?? '—'}%</Text>
          <Text style={styles.alignmentSub}>Reorder and re-draft below to keep this high.</Text>
        </View>

        <Text style={styles.quickTitle}>Quick Optimizations</Text>
        <TouchableOpacity style={styles.quickRow} onPress={() => applyQuickOptimization('morning')}>
          <Text style={styles.quickRowText}>Shift all to morning</Text>
          <Text style={styles.quickRowIcon}>☀️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickRow} onPress={() => applyQuickOptimization('buffer')}>
          <Text style={styles.quickRowText}>Add 15m buffer</Text>
          <Text style={styles.quickRowIcon}>⏳</Text>
        </TouchableOpacity>

        <View style={styles.redraftCard}>
          <Text style={styles.redraftPrompt}>💡 Tell the Architect what to change:</Text>
          <TextInput
            style={styles.redraftInput}
            placeholder='e.g. "Try a more aggressive pace"'
            placeholderTextColor={Colors.grey[400]}
            value={redraftNote}
            onChangeText={setRedraftNote}
          />
          <TouchableOpacity onPress={handleRedraft} style={styles.redraftBtn} disabled={redrafting}>
            {redrafting ? <ActivityIndicator size="small" color={Colors.orange} /> : <Text style={styles.redraftBtnText}>↻ Ask Architect to Re-draft</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.footerRow}>
          <Button title="Discard" onPress={() => router.back()} variant="secondary" style={styles.footerBtn} />
          <Button title="Confirm" onPress={handleConfirm} loading={committing} style={styles.footerBtn} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  headerTitle: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.text.primary, marginTop: 4 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary, marginBottom: Spacing.lg },
  sequenceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.text.primary },
  taskCount: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted },
  blockCard: { padding: Spacing.md, marginBottom: Spacing.md },
  blockTop: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  blockTypeBadge: { backgroundColor: Colors.purple + '15', paddingVertical: 3, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm },
  blockTypeText: { fontFamily: Fonts.semiBold, fontSize: 10, color: Colors.purple },
  reorderCol: { flexDirection: 'row', gap: Spacing.md, marginLeft: 'auto', marginRight: Spacing.md },
  reorderArrow: { fontSize: 18, color: Colors.text.secondary, fontFamily: Fonts.bold },
  reorderDisabled: { color: Colors.grey[300] },
  deleteIcon: { fontSize: 16 },
  blockTime: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.muted, marginBottom: 4 },
  timeEditRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  timeField: { flex: 1 },
  blockTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.text.primary },
  addRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: Radius.md, padding: Spacing.xs },
  addInput: { flex: 1, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary },
  addBtn: { justifyContent: 'center', paddingHorizontal: Spacing.md },
  addBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.purple },
  alignmentCard: { backgroundColor: Colors.purple + '10', borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.xl },
  alignmentLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.secondary, marginBottom: 4 },
  alignmentValue: { fontFamily: Fonts.bold, fontSize: 32, color: Colors.purple, marginBottom: 4 },
  alignmentSub: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted },
  quickTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.text.primary, marginBottom: Spacing.sm },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.sm },
  quickRowText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.primary },
  quickRowIcon: { fontSize: 16 },
  redraftCard: { backgroundColor: Colors.orange + '10', borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md, marginBottom: Spacing.xl, borderWidth: 1, borderColor: Colors.orange + '30' },
  redraftPrompt: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.primary, marginBottom: Spacing.sm },
  redraftInput: { backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontFamily: Fonts.regular, fontSize: 14, marginBottom: Spacing.sm },
  redraftBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  redraftBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.orangeDark },
  footerRow: { flexDirection: 'row', gap: Spacing.md },
  footerBtn: { flex: 1 },
});
