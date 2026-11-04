import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { community, ApiCommunityGroup, ApiGroupMessage } from '../../../lib/api';
import { useAuthStore } from '../../../lib/store';
import { Colors, Fonts, Spacing, Radius } from '../../../constants/theme';

const POLL_INTERVAL_MS = 4000;

export default function GroupChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [group, setGroup] = useState<ApiCommunityGroup | null>(null);
  const [messages, setMessages] = useState<ApiGroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const lastTimestampRef = useRef<string | null>(null);

  const loadInitial = useCallback(async () => {
    if (!id) return;
    const [groupRes, messagesRes] = await Promise.all([community.groups.get(id), community.groups.messages(id)]);
    if (groupRes.data) setGroup(groupRes.data);
    if (messagesRes.data) {
      setMessages(messagesRes.data);
      if (messagesRes.data.length > 0) {
        lastTimestampRef.current = messagesRes.data[messagesRes.data.length - 1].createdAt;
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  useEffect(() => {
    if (!id) return;
    const interval = setInterval(async () => {
      const { data } = await community.groups.messages(id, lastTimestampRef.current ?? undefined);
      if (data && data.length > 0) {
        setMessages((prev) => [...prev, ...data]);
        lastTimestampRef.current = data[data.length - 1].createdAt;
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [id]);

  async function handleSend() {
    if (!text.trim() || !id) return;
    const body = text.trim();
    setText('');
    setSending(true);
    try {
      const { data, error } = await community.groups.sendMessage(id, body);
      if (data) {
        setMessages((prev) => [...prev, data]);
        lastTimestampRef.current = data.createdAt;
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      } else if (error) {
        setText(body); // restore on failure
      }
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

  if (!group) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.notFound}>Group not found.</Text>
      </SafeAreaView>
    );
  }

  const progress = group.groupGoalProgress;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
            <Text style={styles.memberCount}>{group.members.length} members</Text>
          </View>
        </View>

        <View style={styles.chatArea}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.length === 0 && (
              <Text style={styles.emptyText}>No messages yet — say hi to the group!</Text>
            )}
            {messages.map((m) => {
              const mine = m.user.id === user?.id;
              return (
                <View key={m.id} style={[styles.messageRow, mine && styles.messageRowMine]}>
                  {!mine && (
                    <View style={styles.msgAvatar}>
                      <Text style={styles.msgAvatarText}>{m.user.fullName?.[0]?.toUpperCase() || '?'}</Text>
                    </View>
                  )}
                  <View style={{ maxWidth: '75%' }}>
                    {!mine && <Text style={styles.senderName}>{m.user.fullName}</Text>}
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.body}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {progress && progress.totalMembers > 0 && (
            <View style={styles.progressBadge}>
              <View style={styles.progressRing}>
                <Text style={styles.progressPct}>{progress.percent}%</Text>
              </View>
              <View>
                <Text style={styles.progressLabel}>Group Goal</Text>
                <Text style={styles.progressSub}>{progress.membersDone}/{progress.totalMembers} done today</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.messageInput}
            placeholder="Message the collective..."
            value={text}
            onChangeText={setText}
            multiline
            placeholderTextColor={Colors.grey[400]}
          />
          <TouchableOpacity onPress={handleSend} disabled={sending || !text.trim()} style={styles.sendBtn}>
            <Text style={styles.sendBtnText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  groupName: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.purple },
  memberCount: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.onSurfaceVariant },
  notFound: { textAlign: 'center', fontFamily: Fonts.medium, color: Colors.text.muted, marginTop: Spacing.xxl },
  chatArea: { flex: 1 },
  messagesContent: { padding: Spacing.md, gap: Spacing.md },
  emptyText: { textAlign: 'center', fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.muted, marginTop: Spacing.xl },
  messageRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' },
  messageRowMine: { justifyContent: 'flex-end', alignSelf: 'flex-end' },
  msgAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.purpleLight, alignItems: 'center', justifyContent: 'center' },
  msgAvatarText: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.white },
  senderName: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.onSurfaceVariant, marginBottom: 2, marginLeft: 4 },
  bubble: { borderRadius: Radius.lg, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  bubbleTheirs: { backgroundColor: Colors.white, borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: Colors.purple, borderBottomRightRadius: 4 },
  bubbleText: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary, lineHeight: 20 },
  bubbleTextMine: { color: Colors.white },
  progressBadge: { position: 'absolute', right: Spacing.md, bottom: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.purpleLight, borderRadius: Radius.lg, padding: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  progressRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: Colors.purple, alignItems: 'center', justifyContent: 'center' },
  progressPct: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.purple },
  progressLabel: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.text.primary },
  progressSub: { fontFamily: Fonts.regular, fontSize: 10, color: Colors.onSurfaceVariant },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.white },
  messageInput: { flex: 1, backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.purple, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: Colors.white, fontSize: 16 },
});
