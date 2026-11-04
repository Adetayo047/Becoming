import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, ViewStyle } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';

interface DatePickerFieldProps {
  label?: string;
  value: string; // "YYYY-MM-DD", or "" for unset
  onChange: (value: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  containerStyle?: ViewStyle;
}

function toDateString(d: Date) {
  return d.toISOString().split('T')[0];
}

function formatDisplay(value: string) {
  if (!value) return null;
  return new Date(value + 'T12:00:00').toLocaleDateString('en-NG', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DatePickerField({ label, value, onChange, placeholder = 'Select a date', minimumDate, containerStyle }: DatePickerFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [draft, setDraft] = useState<Date>(value ? new Date(value + 'T12:00:00') : new Date());

  function handleChange(_event: unknown, selected?: Date) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (selected) onChange(toDateString(selected));
      return;
    }
    if (selected) setDraft(selected);
  }

  function openPicker() {
    setDraft(value ? new Date(value + 'T12:00:00') : new Date());
    setShowPicker(true);
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity onPress={openPicker} style={styles.field} activeOpacity={0.7}>
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {formatDisplay(value) ?? placeholder}
        </Text>
        <Text style={styles.calendarIcon}>📅</Text>
      </TouchableOpacity>

      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker value={draft} mode="date" display="default" onChange={handleChange} minimumDate={minimumDate} />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={styles.modalCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{label ?? 'Select date'}</Text>
                <TouchableOpacity
                  onPress={() => {
                    onChange(toDateString(draft));
                    setShowPicker(false);
                  }}
                >
                  <Text style={styles.modalDone}>Done</Text>
                </TouchableOpacity>
              </View>
              {showPicker && (
                <DateTimePicker
                  value={draft}
                  mode="date"
                  display="spinner"
                  onChange={handleChange}
                  minimumDate={minimumDate}
                  style={styles.iosPicker}
                />
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
  calendarIcon: { fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalCancel: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.text.muted },
  modalTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.text.primary },
  modalDone: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.purple },
  iosPicker: { height: 200 },
});
