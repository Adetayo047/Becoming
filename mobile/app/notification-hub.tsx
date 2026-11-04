import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { notifications, ApiNotification } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Colors, Fonts, Spacing, Radius } from '../constants/theme';

const CATEGORY_META: Record<string, { label: string; emoji: string; color: string }> = {
  ai_architect: { label: 'AI Architect', emoji: '🧭', color: Colors.purple },
  accountability: { label: 'Accountability', emoji: '🤝', color: Colors.orangeDark },
  system: { label: 'System', emoji: '📊', color: Colors.text.secondary },
};

const FILTERS = ['all', 'ai_architect', 'accountability', 'system'] as const;

export default function NotificationHub() {
  const router = useRouter();
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [loading, setLoading] = useState(true);

  async function load(f: (typeof FILTERS)[number] = filter) {
    const { data } = await notifications.list(f === 'all' ? undefined : f);
    if (data) setItems(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function selectFilter(f: (typeof FILTERS)[number]) {
    setFilter(f);
    setLoading(true);
    load(f);
  }

  async function handleTap(n: ApiNotification) {
    if (!n.read) {
      await notifications.markRead(n.id);
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
    }
    if (n.actionUrl) router.push(n.actionUrl as any);
  }

  function handleClearAll() {
    Alert.alert('Clear all notifications?', 'This removes your entire notification history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await notifications.clearAll();
          setItems([]);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f} onPress={() => selectFilter(f)} style={[styles.filterChip, filter === f && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'All' : CATEGORY_META[f].label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <ActivityIndicator color={Colors.purple} style={{ marginTop: Spacing.xl }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔔</Text>
            <Text style={styles.emptyTitle}>No notifications</Text>
          </View>
        ) : (
          items.map((n) => {
            const meta = CATEGORY_META[n.category];
            return (
              <TouchableOpacity key={n.id} onPress={() => handleTap(n)} activeOpacity={0.8}>
                <Card
                  style={{
                    ...styles.card,
                    borderLeftColor: meta.color,
                    ...(!n.read && styles.cardUnread),
                  }}
                  variant="default"
                >
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardCategory, { color: meta.color }]}>{meta.emoji} {meta.label}</Text>
                    <Text style={styles.cardTime}>
                      {new Date(n.createdAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <Text style={styles.cardTitle}>{n.title}</Text>
                  <Text style={styles.cardBody}>{n.body}</Text>
                </Card>
              </TouchableOpacity>
            );
          })
        )}

        {items.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>🗑️ Clear all notifications</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple, width: 48 },
  title: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.purple },
  filterRow: { gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  filterChip: { paddingVertical: Spacing.xs + 2, paddingHorizontal: Spacing.md, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  filterChipActive: { backgroundColor: Colors.purple, borderColor: Colors.purple },
  filterChipText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.secondary },
  filterChipTextActive: { color: Colors.white },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
  empty: { alignItems: 'center', paddingTop: Spacing.xxl },
  emptyEmoji: { fontSize: 40, marginBottom: Spacing.md },
  emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary },
  card: { padding: Spacing.md, marginBottom: Spacing.md, borderLeftWidth: 3 },
  cardUnread: { backgroundColor: Colors.surfaceContainerLow },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  cardCategory: { fontFamily: Fonts.semiBold, fontSize: 12 },
  cardTime: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.text.muted },
  cardTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.text.primary, marginBottom: 4 },
  cardBody: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary, lineHeight: 18 },
  clearBtn: { alignItems: 'center', paddingVertical: Spacing.lg },
  clearBtnText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.muted },
});
