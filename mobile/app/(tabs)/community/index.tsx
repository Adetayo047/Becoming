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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { community, accountability, ApiCommunityPost, ApiCommunityGroup, ApiPartnership, PostKind, ReactionType } from '../../../lib/api';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Colors, Fonts, Spacing, Radius } from '../../../constants/theme';

const REACTIONS: { type: ReactionType; emoji: string }[] = [
  { type: 'celebration', emoji: '🎉' },
  { type: 'favorite', emoji: '❤️' },
  { type: 'fire', emoji: '🔥' },
];

const KIND_LABEL: Record<PostKind, string> = {
  milestone: 'Milestone',
  achievement: 'Achievement',
  small_win: 'Small Win',
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function PostCard({ post, onReact, onOpen }: { post: ApiCommunityPost; onReact: (id: string, type: ReactionType) => void; onOpen: (id: string) => void }) {
  return (
    <Card style={styles.postCard} variant="default">
      <TouchableOpacity onPress={() => onOpen(post.id)} activeOpacity={0.8}>
        <View style={styles.postHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{post.user.fullName?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.authorName}>{post.user.fullName}</Text>
            <Text style={styles.postMeta}>
              {timeAgo(post.createdAt)} · <Text style={styles.kindLabel}>{KIND_LABEL[post.kind]}</Text>
            </Text>
          </View>
        </View>
        {post.body ? <Text style={styles.postBody}>{post.body}</Text> : null}
        <Text style={styles.postHeadline}>{post.headline}</Text>
        {post.goal && (
          <View style={styles.goalTag}>
            <Text style={styles.goalTagText}>🎯 {post.goal.title}</Text>
          </View>
        )}
      </TouchableOpacity>
      <View style={styles.postActions}>
        <View style={styles.reactionRow}>
          {REACTIONS.map((r) => {
            const count = post.reactionCounts[r.type] ?? 0;
            const active = post.myReaction === r.type;
            return (
              <TouchableOpacity key={r.type} onPress={() => onReact(post.id, r.type)} style={styles.reactionBtn}>
                <Text style={[styles.reactionEmoji, active && styles.reactionActive]}>{r.emoji}</Text>
                {count > 0 && <Text style={styles.reactionCount}>{count}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity onPress={() => onOpen(post.id)} style={styles.commentBtn}>
          <Text style={styles.commentText}>💬 {post.commentCount}</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

export default function CommunityScreen() {
  const router = useRouter();
  const { prefillHeadline, prefillKind, compose } = useLocalSearchParams<{ prefillHeadline?: string; prefillKind?: PostKind; compose?: string }>();
  const [posts, setPosts] = useState<ApiCommunityPost[]>([]);
  const [partners, setPartners] = useState<ApiPartnership[]>([]);
  const [groups, setGroups] = useState<ApiCommunityGroup[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [kind, setKind] = useState<PostKind>('small_win');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  async function loadAll() {
    const [feedRes, partnersRes, groupsRes] = await Promise.all([
      community.feed(),
      accountability.list(),
      community.groups.list(),
    ]);
    if (feedRes.data) setPosts(feedRes.data);
    if (partnersRes.data) setPartners(partnersRes.data.filter((p) => p.status === 'active'));
    if (groupsRes.data) setGroups(groupsRes.data);
  }

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    // "Log a Win" on Home opens an empty composer (compose=1).
    if (prefillHeadline || compose) {
      if (prefillHeadline) setHeadline(prefillHeadline);
      if (prefillKind) setKind(prefillKind);
      setShowCompose(true);
    }
  }, [prefillHeadline, prefillKind, compose]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, []);

  async function handleReact(postId: string, type: ReactionType) {
    // optimistic
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const counts = { ...p.reactionCounts };
        if (p.myReaction) counts[p.myReaction] = Math.max(0, (counts[p.myReaction] ?? 1) - 1);
        const nowActive = p.myReaction === type ? null : type;
        if (nowActive) counts[nowActive] = (counts[nowActive] ?? 0) + 1;
        return { ...p, myReaction: nowActive, reactionCounts: counts };
      })
    );
    await community.react(postId, type);
  }

  async function handlePost() {
    if (!headline.trim()) return;
    setPosting(true);
    try {
      const { data, error } = await community.createPost({
        kind,
        headline: headline.trim(),
        body: body.trim() || undefined,
      });
      if (error || !data) {
        Alert.alert('Could not post', error ?? 'Try again.');
        return;
      }
      setPosts((prev) => [data, ...prev]);
      setHeadline('');
      setBody('');
      setShowCompose(false);
    } finally {
      setPosting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Community 👥</Text>
        <TouchableOpacity onPress={() => router.push('/community/discover')}>
          <Text style={styles.discoverLink}>Discover →</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.purple} />}
      >
        {/* Share Win + partner avatars */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarRow}>
          <TouchableOpacity onPress={() => setShowCompose(true)} style={styles.avatarItem}>
            <View style={styles.shareWinCircle}>
              <Text style={styles.shareWinPlus}>➕</Text>
            </View>
            <Text style={styles.avatarLabel}>Share Win</Text>
          </TouchableOpacity>
          {partners.map((p) => (
            <View key={p.id} style={styles.avatarItem}>
              <View style={styles.partnerCircle}>
                <Text style={styles.avatarText}>{p.partner.fullName?.[0]?.toUpperCase() || '?'}</Text>
              </View>
              <Text style={styles.avatarLabel} numberOfLines={1}>{p.partner.fullName?.split(' ')[0]}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Groups */}
        <View style={styles.groupsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Groups</Text>
            <TouchableOpacity onPress={() => router.push('/community/groups/create')}>
              <Text style={styles.newGroupLink}>+ New</Text>
            </TouchableOpacity>
          </View>
          {groups.length === 0 ? (
            <Text style={styles.noGroupsText}>No mastermind groups yet.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupsRow}>
              {groups.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => router.push(`/community/groups/${g.id}`)}
                  style={styles.groupChip}
                >
                  <Text style={styles.groupChipEmoji}>💬</Text>
                  <Text style={styles.groupChipText} numberOfLines={1}>{g.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Feed */}
        {posts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>No wins shared yet</Text>
            <Text style={styles.emptySub}>Be the first — tap "Share Win" above.</Text>
          </View>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} onReact={handleReact} onOpen={(id) => router.push(`/community/post/${id}`)} />
          ))
        )}
      </ScrollView>

      <Modal visible={showCompose} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share a Win</Text>
              <TouchableOpacity onPress={() => setShowCompose(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Type</Text>
              <View style={styles.kindRow}>
                {(['small_win', 'milestone', 'achievement'] as PostKind[]).map((k) => (
                  <TouchableOpacity
                    key={k}
                    onPress={() => setKind(k)}
                    style={[styles.kindChip, kind === k && styles.kindChipActive]}
                  >
                    <Text style={[styles.kindChipText, kind === k && styles.kindChipTextActive]}>{KIND_LABEL[k]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { marginTop: Spacing.lg }]}>Headline</Text>
              <TextInput
                style={styles.headlineInput}
                placeholder="e.g. Mastered UI Design Principles"
                value={headline}
                onChangeText={setHeadline}
                placeholderTextColor={Colors.grey[400]}
              />

              <Text style={[styles.inputLabel, { marginTop: Spacing.lg }]}>Details (optional)</Text>
              <TextInput
                style={styles.bodyInput}
                placeholder="Tell your circle more..."
                value={body}
                onChangeText={setBody}
                multiline
                placeholderTextColor={Colors.grey[400]}
              />

              <Button title="Share" onPress={handlePost} loading={posting} disabled={!headline.trim()} style={styles.shareBtn} />
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  title: { fontFamily: Fonts.bold, fontSize: 24, color: Colors.text.primary },
  discoverLink: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.purple },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  avatarRow: { gap: Spacing.md, paddingVertical: Spacing.sm },
  avatarItem: { alignItems: 'center', gap: 4, width: 64 },
  shareWinCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: Colors.purple, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceContainerLow },
  shareWinPlus: { fontSize: 18 },
  partnerCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: Colors.purpleLight, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.purple },
  avatarText: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.white },
  avatarLabel: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.text.secondary },
  groupsSection: { marginBottom: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  sectionTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.text.primary },
  newGroupLink: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.purple },
  noGroupsText: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.muted },
  groupsRow: { gap: Spacing.sm },
  groupChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainer, maxWidth: 180 },
  groupChipEmoji: { fontSize: 14 },
  groupChipText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.primary },
  postCard: { padding: Spacing.md },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.purple, alignItems: 'center', justifyContent: 'center' },
  authorName: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.text.primary },
  postMeta: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.onSurfaceVariant },
  kindLabel: { fontFamily: Fonts.semiBold, color: Colors.purple },
  postBody: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary, lineHeight: 20, marginBottom: Spacing.xs },
  postHeadline: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.purple, marginBottom: Spacing.sm },
  goalTag: { alignSelf: 'flex-start', backgroundColor: Colors.surfaceContainer, paddingVertical: 4, paddingHorizontal: Spacing.sm, borderRadius: Radius.full, marginBottom: Spacing.sm },
  goalTagText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.secondary },
  postActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  reactionRow: { flexDirection: 'row', gap: Spacing.md },
  reactionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reactionEmoji: { fontSize: 16, opacity: 0.5 },
  reactionActive: { opacity: 1 },
  reactionCount: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.secondary },
  commentBtn: {},
  commentText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.secondary },
  empty: { alignItems: 'center', paddingTop: Spacing.xxl },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 17, color: Colors.text.primary, marginBottom: Spacing.xs },
  emptySub: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.muted },
  modalContainer: { flex: 1 },
  modalSafe: { flex: 1, backgroundColor: Colors.cream },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.white },
  modalTitle: { fontFamily: Fonts.semiBold, fontSize: 17, color: Colors.text.primary },
  modalClose: { fontSize: 18, color: Colors.text.muted, padding: 4 },
  modalBody: { padding: Spacing.lg },
  inputLabel: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.primary, marginBottom: Spacing.sm },
  kindRow: { flexDirection: 'row', gap: Spacing.sm },
  kindChip: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  kindChipActive: { backgroundColor: Colors.purple, borderColor: Colors.purple },
  kindChipText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.secondary },
  kindChipTextActive: { color: Colors.white },
  headlineInput: { backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.purple, padding: Spacing.md, fontFamily: Fonts.regular, fontSize: 15, color: Colors.text.primary },
  bodyInput: { backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.md, fontFamily: Fonts.regular, fontSize: 15, color: Colors.text.primary, minHeight: 80, textAlignVertical: 'top' },
  shareBtn: { marginTop: Spacing.xl },
});
