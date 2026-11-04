import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, ViewStyle } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';

interface TimePickerFieldProps {
  label?: string;
  value: string; // "HH:MM", or "" for unset
  onChange: (value: string) => void;
  placeholder?: string;
  containerStyle?: ViewStyle;
}

function toTimeString(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function toDate(value: string): Date {
  const d = new Date();
  if (value) {
    const [h, m] = value.split(':').map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
  }
  return d;
}

function formatDisplay(value: string) {
  if (!value) return null;
  return toDate(value).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
}

export function TimePickerField({ label, value, onChange, placeholder = 'Select time', containerStyle }: TimePickerFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [draft, setDraft] = useState<Date>(toDate(value));

  function handleChange(_event: unknown, selected?: Date) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (selected) onChange(toTimeString(selected));
      return;
    }
    if (selected) setDraft(selected);
  }

  function openPicker() {
    setDraft(toDate(value));
    setShowPicker(true);
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity onPress={openPicker} style={styles.field} activeOpacity={0.7}>
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {formatDisplay(value) ?? placeholder}
        </Text>
        <Text style={styles.icon}>🕐</Text>
      </TouchableOpacity>

      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker value={draft} mode="time" display="default" onChange={handleChange} />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={styles.modalCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{label ?? 'Select time'}</Text>
                <TouchableOpacity
                  onPress={() => {
                    onChange(toTimeString(draft));
                    setShowPicker(false);
                  }}
                >
                  <Text style={styles.modalDone}>Done</Text>
                </TouchableOpacity>
              </View>
              {showPicker && (
                <DateTimePicker value={draft} mode="time" display="spinner" onChange={handleChange} style={styles.iosPicker} />
              )}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.primary },
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  valueText: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.text.primary },
  placeholderText: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.grey[400] },
  icon: { fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalCancel: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.text.muted },
  modalTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.text.primary },
  modalDone: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.purple },
  iosPicker: { height: 200 },
});
