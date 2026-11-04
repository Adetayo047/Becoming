import { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { community, ApiCommunityPost } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Colors, Fonts, Spacing, Radius, CATEGORY_META } from '../constants/theme';

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'TODAY';
  if (date.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
  return date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

export default function ActivityHistory() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<ApiCommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [editing, setEditing] = useState<ApiCommunityPost | null>(null);
  const [editHeadline, setEditHeadline] = useState('');
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await community.feed();
    if (data && user) setPosts(data.filter((p) => p.user.id === user.id));
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  const categories = useMemo(() => {
    const set = new Set(posts.map((p) => p.goal?.category).filter(Boolean) as string[]);
    return Array.from(set);
  }, [posts]);

  const filtered = filter === 'all' ? posts : posts.filter((p) => p.goal?.category === filter);

  const thisMonthCount = posts.filter((p) => {
    const d = new Date(p.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const grouped = useMemo(() => {
    const groups: Record<string, ApiCommunityPost[]> = {};
    for (const p of filtered) {
      const label = dayLabel(p.createdAt);
      if (!groups[label]) groups[label] = [];
      groups[label].push(p);
    }
    return groups;
  }, [filtered]);

  function openEdit(post: ApiCommunityPost) {
    setEditing(post);
    setEditHeadline(post.headline);
    setEditBody(post.body ?? '');
  }

  async function handleSaveEdit() {
    if (!editing || !editHeadline.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await community.updatePost(editing.id, {
        headline: editHeadline.trim(),
        body: editBody.trim() || undefined,
      });
      if (error || !data) {
        Alert.alert('Could not save', error ?? 'Try again.');
        return;
      }
      setPosts((prev) => prev.map((p) => (p.id === data.id ? data : p)));
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(post: ApiCommunityPost) {
    Alert.alert('Delete this win?', post.headline, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await community.deletePost(post.id);
          setPosts((prev) => prev.filter((p) => p.id !== post.id));
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
        <Text style={styles.title}>Activity History</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <TouchableOpacity onPress={() => setFilter('all')} style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}>
          <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>All</Text>
        </TouchableOpacity>
        {categories.map((cat) => {
          const meta = CATEGORY_META[cat as keyof typeof CATEGORY_META];
          return (
            <TouchableOpacity key={cat} onPress={() => setFilter(cat)} style={[styles.filterChip, filter === cat && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, filter === cat && styles.filterChipTextActive]}>{meta?.emoji} {meta?.label ?? cat}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.totalBanner}>
          <Text style={styles.totalLabel}>Total Wins this Month</Text>
          <Text style={styles.totalCount}>{thisMonthCount}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.purple} style={{ marginTop: Spacing.xl }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>No wins logged yet — share one from the Community tab.</Text>
        ) : (
          Object.entries(grouped).map(([label, items]) => (
            <View key={label} style={styles.group}>
              <Text style={styles.groupLabel}>{label}</Text>
              {items.map((post) => {
                const meta = post.goal ? CATEGORY_META[post.goal.category as keyof typeof CATEGORY_META] : null;
                return (
                  <Card key={post.id} style={styles.postCard} variant="default">
                    <View style={styles.postTop}>
                      {meta && (
                        <View style={[styles.catTag, { backgroundColor: meta.color + '18' }]}>
                          <Text style={[styles.catTagText, { color: meta.color }]}>{meta.emoji} {meta.label}</Text>
                        </View>
                      )}
                      <View style={styles.postActions}>
                        <TouchableOpacity onPress={() => openEdit(post)} hitSlop={8}>
                          <Text style={styles.actionIcon}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(post)} hitSlop={8}>
                          <Text style={styles.actionIcon}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.postHeadline}>{post.headline}</Text>
                    {post.body ? <Text style={styles.postBody}>{post.body}</Text> : null}
                    <Text style={styles.postTime}>
                      {new Date(post.createdAt).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </Card>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={!!editing} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Win</Text>
              <TouchableOpacity onPress={() => setEditing(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Headline</Text>
              <TextInput style={styles.headlineInput} value={editHeadline} onChangeText={setEditHeadline} placeholderTextColor={Colors.grey[400]} />
              <Text style={[styles.inputLabel, { marginTop: Spacing.lg }]}>Details</Text>
              <TextInput style={styles.bodyInput} value={editBody} onChangeText={setEditBody} multiline placeholderTextColor={Colors.grey[400]} />
              <Button title="Save Changes" onPress={handleSaveEdit} loading={saving} disabled={!editHeadline.trim()} style={{ marginTop: Spacing.xl }} />
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
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
  totalBanner: { backgroundColor: Colors.purple, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.xl },
  totalLabel: { fontFamily: Fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  totalCount: { fontFamily: Fonts.bold, fontSize: 36, color: Colors.white },
  emptyText: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.muted, textAlign: 'center', marginTop: Spacing.xl },
  group: { marginBottom: Spacing.lg },
  groupLabel: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.text.muted, letterSpacing: 0.5, marginBottom: Spacing.sm },
  postCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  postTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  catTag: { paddingVertical: 3, paddingHorizontal: Spacing.sm, borderRadius: Radius.full },
  catTagText: { fontFamily: Fonts.medium, fontSize: 11 },
  postActions: { flexDirection: 'row', gap: Spacing.md },
  actionIcon: { fontSize: 16 },
  postHeadline: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.text.primary, marginBottom: 4 },
  postBody: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary, lineHeight: 18, marginBottom: Spacing.sm },
  postTime: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.text.muted },
  modalSafe: { flex: 1, backgroundColor: Colors.cream },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.white },
  modalTitle: { fontFamily: Fonts.semiBold, fontSize: 17, color: Colors.text.primary },
  modalClose: { fontSize: 18, color: Colors.text.muted, padding: 4 },
  modalBody: { padding: Spacing.lg },
  inputLabel: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.primary, marginBottom: Spacing.sm },
  headlineInput: { backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.purple, padding: Spacing.md, fontFamily: Fonts.regular, fontSize: 15, color: Colors.text.primary },
  bodyInput: { backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.md, fontFamily: Fonts.regular, fontSize: 15, color: Colors.text.primary, minHeight: 80, textAlignVertical: 'top' },
});
