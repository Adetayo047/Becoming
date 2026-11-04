import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { community, ApiCommunityPostDetail, ReactionType } from '../../../lib/api';
import { Card } from '../../../components/ui/Card';
import { Colors, Fonts, Spacing, Radius } from '../../../constants/theme';

const REACTIONS: { type: ReactionType; emoji: string }[] = [
  { type: 'celebration', emoji: '🎉' },
  { type: 'favorite', emoji: '❤️' },
  { type: 'fire', emoji: '🔥' },
];

const KIND_LABEL: Record<string, string> = {
  milestone: 'Milestone',
  achievement: 'Achievement',
  small_win: 'Small Win',
};

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<ApiCommunityPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await community.getPost(id);
    if (data) setPost(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function handleReact(type: ReactionType) {
    if (!post) return;
    await community.react(post.id, type);
    load();
  }

  async function handleSendComment() {
    if (!commentText.trim() || !id) return;
    setSending(true);
    try {
      await community.addComment(id, commentText.trim());
      setCommentText('');
      load();
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.purple} style={{ marginTop: Spacing.xxl }} />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.notFound}>Post not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.purple} />}
        >
          <Card style={styles.postCard} variant="default">
            <View style={styles.postHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{post.user.fullName?.[0]?.toUpperCase() || '?'}</Text>
              </View>
              <View>
                <Text style={styles.authorName}>{post.user.fullName}</Text>
                <Text style={styles.postMeta}>{KIND_LABEL[post.kind]}</Text>
              </View>
            </View>
            {post.body ? <Text style={styles.postBody}>{post.body}</Text> : null}
            <Text style={styles.postHeadline}>{post.headline}</Text>
            {post.goal && (
              <View style={styles.goalTag}>
                <Text style={styles.goalTagText}>🎯 {post.goal.title}</Text>
              </View>
            )}
            <View style={styles.reactionRow}>
              {REACTIONS.map((r) => {
                const count = post.reactionCounts[r.type] ?? 0;
                const active = post.myReaction === r.type;
                return (
                  <TouchableOpacity key={r.type} onPress={() => handleReact(r.type)} style={styles.reactionBtn}>
                    <Text style={[styles.reactionEmoji, active && styles.reactionActive]}>{r.emoji}</Text>
                    {count > 0 && <Text style={styles.reactionCount}>{count}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          <Text style={styles.commentsTitle}>Comments ({post.comments.length})</Text>
          {post.comments.map((c) => (
            <View key={c.id} style={styles.commentRow}>
              <View style={styles.commentAvatar}>
                <Text style={styles.commentAvatarText}>{c.user.fullName?.[0]?.toUpperCase() || '?'}</Text>
              </View>
              <View style={styles.commentBubble}>
                <Text style={styles.commentAuthor}>{c.user.fullName}</Text>
                <Text style={styles.commentBody}>{c.body}</Text>
              </View>
            </View>
          ))}
          {post.comments.length === 0 && <Text style={styles.noComments}>No comments yet — be the first.</Text>}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.commentInput}
            placeholder="Write a comment..."
            value={commentText}
            onChangeText={setCommentText}
            placeholderTextColor={Colors.grey[400]}
          />
          <TouchableOpacity onPress={handleSendComment} disabled={sending || !commentText.trim()} style={styles.sendBtn}>
            <Text style={styles.sendBtnText}>{sending ? '…' : '➤'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  notFound: { textAlign: 'center', fontFamily: Fonts.medium, color: Colors.text.muted, marginTop: Spacing.xxl },
  postCard: { padding: Spacing.md, marginBottom: Spacing.lg },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.purple, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.white },
  authorName: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.text.primary },
  postMeta: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.purple },
  postBody: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary, lineHeight: 20, marginBottom: Spacing.xs },
  postHeadline: { fontFamily: Fonts.semiBold, fontSize: 17, color: Colors.purple, marginBottom: Spacing.sm },
  goalTag: { alignSelf: 'flex-start', backgroundColor: Colors.surfaceContainer, paddingVertical: 4, paddingHorizontal: Spacing.sm, borderRadius: Radius.full, marginBottom: Spacing.md },
  goalTagText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.secondary },
  reactionRow: { flexDirection: 'row', gap: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  reactionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reactionEmoji: { fontSize: 18, opacity: 0.5 },
  reactionActive: { opacity: 1 },
  reactionCount: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.secondary },
  commentsTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.text.primary, marginBottom: Spacing.md },
  commentRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.purpleLight, alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.white },
  commentBubble: { flex: 1, backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.sm },
  commentAuthor: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.text.primary, marginBottom: 2 },
  commentBody: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary, lineHeight: 18 },
  noComments: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.muted, textAlign: 'center', marginTop: Spacing.md },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.white },
  commentInput: { flex: 1, backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.purple, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: Colors.white, fontSize: 16 },
});
