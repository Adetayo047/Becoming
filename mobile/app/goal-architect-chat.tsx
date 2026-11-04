import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ai, goals as goalsApi, ApiProposedMilestone } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { Button } from '../components/ui/Button';
import { Colors, Fonts, Spacing, Radius, CATEGORY_META, Category } from '../constants/theme';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  proposedMilestone?: ApiProposedMilestone | null;
}

const CATEGORIES = Object.entries(CATEGORY_META) as [Category, (typeof CATEGORY_META)[Category]][];

function greeting(fullName?: string | null) {
  const firstName = fullName?.trim().split(/\s+/)[0];
  return firstName
    ? `Hi ${firstName}! I'm your AI Goal Architect. What's the big thing you're working toward?`
    : "Hi! I'm your AI Goal Architect. What's the big thing you're working toward?";
}

export default function GoalArchitectChat() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: greeting(user?.fullName) },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [draftCategory, setDraftCategory] = useState<Category>('career');
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function handleSend() {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const { data, error, upgrade } = await ai.architect(text, sessionId);
      if (error || !data) {
        if (!upgrade) Alert.alert('AI unavailable', error ?? 'Could not reach the architect right now.');
        setMessages((prev) => prev.slice(0, -1));
        setInput(text);
        return;
      }
      setSessionId(data.sessionId);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply, proposedMilestone: data.proposedMilestone }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setSending(false);
    }
  }

  async function handleApprove(milestone: ApiProposedMilestone) {
    setSaving(true);
    try {
      const { data, error, upgrade } = await goalsApi.create({
        title: milestone.title,
        category: draftCategory,
        milestones: [milestone.title],
        monthlyTarget: milestone.monthlyTarget,
        weeklyFocus: milestone.weeklyFocus,
        firstTask: milestone.firstTask,
      });
      if (upgrade) return;
      if (error || !data) {
        Alert.alert('Could not save', error ?? 'Try again.');
        return;
      }
      Alert.alert('Goal created!', `"${milestone.title}" is now on your Goals tab.`, [
        { text: 'View Goal', onPress: () => router.replace(`/goals/${data.id}`) },
      ]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🧭 Becoming AI Architect</Text>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.map((m, i) => (
            <View key={i}>
              <View style={[styles.bubbleRow, m.role === 'user' && styles.bubbleRowMine]}>
                <View style={[styles.bubble, m.role === 'user' ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, m.role === 'user' && styles.bubbleTextMine]}>{m.content}</Text>
                </View>
              </View>

              {m.proposedMilestone && (
                <View style={styles.draftCard}>
                  <View style={styles.draftHeader}>
                    <Text style={styles.draftHeaderText}>✨ New Milestone Draft</Text>
                  </View>
                  <View style={styles.draftBody}>
                    <Text style={styles.draftTitle}>{m.proposedMilestone.title}</Text>

                    <Text style={styles.draftLabel}>Category</Text>
                    <View style={styles.categoryRow}>
                      {CATEGORIES.map(([key, meta]) => (
                        <TouchableOpacity
                          key={key}
                          onPress={() => setDraftCategory(key)}
                          style={[styles.categoryChip, draftCategory === key && { backgroundColor: meta.color, borderColor: meta.color }]}
                        >
                          <Text style={styles.categoryChipEmoji}>{meta.emoji}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {m.proposedMilestone.monthlyTarget && (
                      <Text style={styles.draftDetail}>📅 {m.proposedMilestone.monthlyTarget}</Text>
                    )}
                    {m.proposedMilestone.weeklyFocus && (
                      <Text style={styles.draftDetail}>🗓️ {m.proposedMilestone.weeklyFocus}</Text>
                    )}
                    {m.proposedMilestone.firstTask && (
                      <Text style={styles.draftDetail}>🚀 {m.proposedMilestone.firstTask}</Text>
                    )}

                    <Button
                      title="Approve & Save"
                      onPress={() => handleApprove(m.proposedMilestone!)}
                      loading={saving}
                      style={styles.approveBtn}
                    />
                  </View>
                </View>
              )}
            </View>
          ))}
          {sending && (
            <View style={styles.bubbleRow}>
              <View style={[styles.bubble, styles.bubbleTheirs]}>
                <View style={styles.typingRow}>
                  <ActivityIndicator size="small" color={Colors.purple} />
                  <Text style={styles.typingText}>Architect is thinking…</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type your vision..."
            value={input}
            onChangeText={setInput}
            multiline
            placeholderTextColor={Colors.grey[400]}
          />
          <TouchableOpacity onPress={handleSend} disabled={sending || !input.trim()} style={styles.sendBtn}>
            <Text style={styles.sendBtnText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple, marginBottom: 4 },
  headerTitle: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.purple },
  messages: { padding: Spacing.md, gap: Spacing.md },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', flexShrink: 1, borderRadius: Radius.lg, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md },
  bubbleTheirs: { backgroundColor: Colors.white, borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: Colors.purple, borderBottomRightRadius: 4 },
  bubbleText: { flexShrink: 1, fontFamily: Fonts.regular, fontSize: 15, color: Colors.text.primary, lineHeight: 24 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  typingText: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.muted },
  bubbleTextMine: { color: Colors.white },
  draftCard: { marginTop: Spacing.sm, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: Colors.purpleLight },
  draftHeader: { backgroundColor: Colors.purple, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  draftHeaderText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.white },
  draftBody: { backgroundColor: Colors.white, padding: Spacing.md },
  draftTitle: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.text.primary, marginBottom: Spacing.md },
  draftLabel: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.muted, marginBottom: Spacing.xs },
  categoryRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.md },
  categoryChip: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  categoryChipEmoji: { fontSize: 16 },
  draftDetail: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary, marginBottom: 6, lineHeight: 18 },
  approveBtn: { marginTop: Spacing.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.white },
  input: { flex: 1, backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.purple, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: Colors.white, fontSize: 16 },
});
