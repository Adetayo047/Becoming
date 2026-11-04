import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { planner, PlanKind } from '../../lib/api';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';

type Item = { id: string; title: string; status: 'pending' | 'completed' };

const PLACEHOLDER: Record<PlanKind, string> = {
  yearly: 'e.g. Get hired as a software engineer',
  monthly: 'e.g. Apply to 20 companies',
  weekly: 'e.g. Finish 2 portfolio projects',
};

const ADD_LABEL: Record<PlanKind, string> = {
  yearly: '＋ Add yearly outcome',
  monthly: '＋ Add monthly focus',
  weekly: '＋ Add weekly milestone',
};

interface Props {
  kind: PlanKind;
  goalId: string;
  /** "YYYY" for yearly, "YYYY-MM" for monthly, the week's Monday for weekly. */
  period: string;
  items: Item[];
  adding: boolean;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onChanged: () => void;
  bullet?: boolean;
}

// One goal's items at one planner level: tap to mark done, long-press to
// remove, plus an inline add row the parent opens/closes (so an alignment
// gap's "Fix →" can open it too).
export function PlanItemList({ kind, goalId, period, items, adding, onStartAdd, onCancelAdd, onChanged, bullet }: Props) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (draft.trim().length < 3) return;
    setSaving(true);
    const { error } = await planner.addTarget(kind, goalId, draft.trim(), period);
    setSaving(false);
    if (error) {
      Alert.alert('Could not add', error);
      return;
    }
    setDraft('');
    onCancelAdd();
    onChanged();
  }

  async function toggle(item: Item) {
    await planner.updateTarget(kind, item.id, { status: item.status === 'completed' ? 'pending' : 'completed' });
    onChanged();
  }

  function confirmDelete(item: Item) {
    Alert.alert('Remove from plan?', item.title, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await planner.deleteTarget(kind, item.id);
          onChanged();
        },
      },
    ]);
  }

  return (
    <View>
      {items.map((item) => {
        const done = item.status === 'completed';
        return (
          <TouchableOpacity key={item.id} style={styles.itemRow} onPress={() => toggle(item)} onLongPress={() => confirmDelete(item)}>
            {bullet ? (
              <View style={[styles.bullet, done && styles.bulletDone]} />
            ) : (
              <View style={[styles.checkbox, done && styles.checkboxDone]}>
                {done && <Text style={styles.checkMark}>✓</Text>}
              </View>
            )}
            <Text style={[bullet ? styles.itemText : styles.itemTitle, done && styles.strike]}>{item.title}</Text>
          </TouchableOpacity>
        );
      })}
      {adding ? (
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={draft}
            onChangeText={setDraft}
            placeholder={PLACEHOLDER[kind]}
            placeholderTextColor={Colors.text.muted}
            autoFocus
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAdd} disabled={saving}>
            {saving ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.addBtnText}>Add</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancelAdd} style={styles.cancelAdd}>
            <Text style={styles.cancelAddText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => { setDraft(''); onStartAdd(); }}>
          <Text style={styles.addLink}>{ADD_LABEL[kind]}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  itemTitle: { flexShrink: 1, fontFamily: Fonts.medium, fontSize: 15, color: Colors.text.primary },
  itemText: { flexShrink: 1, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary },
  strike: { textDecorationLine: 'line-through', color: Colors.text.muted },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.grey[400], alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  checkboxDone: { backgroundColor: Colors.purple, borderColor: Colors.purple },
  checkMark: { color: Colors.white, fontSize: 13, fontFamily: Fonts.bold },
  bullet: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.orange, marginRight: Spacing.sm + 4, marginLeft: 4 },
  bulletDone: { backgroundColor: Colors.grey[400] },
  addLink: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.purple, paddingVertical: 6 },
  addRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  addInput: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 8, backgroundColor: Colors.surfaceContainerLow },
  addBtn: { backgroundColor: Colors.purple, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 9, marginLeft: Spacing.sm },
  addBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.white },
  cancelAdd: { paddingHorizontal: 8, paddingVertical: 8 },
  cancelAddText: { fontSize: 14, color: Colors.text.muted },
});
