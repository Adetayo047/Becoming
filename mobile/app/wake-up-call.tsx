import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { voice, tasks as tasksApi } from '../lib/api';
import { useAuthStore, useGoalStore } from '../lib/store';
import { Button } from '../components/ui/Button';
import { Colors, Fonts, Spacing, Radius } from '../constants/theme';

// Deliberately NOT a conversation. One utterance in, transcribed, turned
// into concrete items, added straight to today's task list — the same
// behavior whether this screen was opened from the floating Quick-Talk
// button or from answering a scheduled Wake-Up Call push. No clarifying
// questions, no approval gate: say it, it's on the plan.
type CallState = 'connecting' | 'permission_denied' | 'listening' | 'sending' | 'speaking';

function openingLine(fullName?: string | null) {
  const firstName = fullName?.trim().split(/\s+/)[0];
  return firstName
    ? `Hey ${firstName}! Tell me what you want to get done — I'll add it to today's plan.`
    : "Hey! Tell me what you want to get done — I'll add it to today's plan.";
}

export default function WakeUpCall() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { addTask } = useGoalStore();
  const [callState, setCallState] = useState<CallState>('connecting');
  const [voiceCallSessionId, setVoiceCallSessionId] = useState<string | undefined>();
  const [caption, setCaption] = useState(() => openingLine(user?.fullName));
  const [lastUserLine, setLastUserLine] = useState<string | null>(null);
  const [addedTasks, setAddedTasks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const handledFinish = useRef(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    requestMicAndStart();
  }, []);

  // When the confirmation finishes speaking, hand the mic back.
  useEffect(() => {
    if (callState === 'speaking' && playerStatus.didJustFinish) {
      setCallState('listening');
    }
  }, [playerStatus.didJustFinish, callState]);

  async function requestMicAndStart() {
    setCallState('connecting');
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      setCallState('permission_denied');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    setCallState('listening');
  }

  async function finishAndClose() {
    if (!handledFinish.current && voiceCallSessionId) {
      handledFinish.current = true;
      await voice.finish(voiceCallSessionId, 'completed');
    }
    router.replace('/(tabs)');
  }

  async function handleClose() {
    if (!handledFinish.current) {
      handledFinish.current = true;
      if (voiceCallSessionId) {
        await voice.finish(voiceCallSessionId, 'completed');
      } else {
        await voice.decline();
      }
    }
    router.back();
  }

  async function handleStartRecording() {
    setError(null);
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function handleStopRecording() {
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) return;

    setCallState('sending');
    const { data, error: err } = await voice.sendTurn(uri, voiceCallSessionId, addedTasks);
    if (err || !data) {
      setError(err ?? "Couldn't reach the Architect — try again.");
      setCallState('listening');
      return;
    }

    setVoiceCallSessionId(data.voiceCallSessionId);
    setLastUserLine(data.transcript);
    setCaption(data.confirmation);

    // Add straight to today's plan — no approval step. Each one succeeds or
    // fails independently so a single bad write doesn't drop the rest.
    for (const title of data.tasks) {
      const { data: task } = await tasksApi.create({ title });
      if (task) addTask(task);
    }
    if (data.tasks.length > 0) {
      setAddedTasks((prev) => [...prev, ...data.tasks]);
    }

    const file = new File(Paths.cache, `wake-up-reply-${Date.now()}.mp3`);
    file.create();
    file.write(data.replyAudioBase64, { encoding: 'base64' });
    player.replace(file.uri);
    player.play();
    setCallState('speaking');
  }

  if (callState === 'connecting') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.incomingBody}>
          <View style={styles.pulseOuter}>
            <View style={styles.avatar}>
              <Text style={styles.avatarEmoji}>🧭</Text>
            </View>
          </View>
          <Text style={styles.callerName}>Becoming</Text>
          <Text style={styles.callerSub}>Connecting to your AI Architect…</Text>
          <ActivityIndicator color={Colors.white} style={{ marginTop: Spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  if (callState === 'permission_denied') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.incomingBody}>
          <Text style={styles.avatarEmoji}>🎙️</Text>
          <Text style={styles.callerName}>Microphone needed</Text>
          <Text style={styles.callerSub}>Enable microphone access to talk to the AI Architect.</Text>
          <Button title="Try Again" onPress={requestMicAndStart} style={{ marginTop: Spacing.xl }} />
          <Button title="Cancel" onPress={() => router.back()} variant="secondary" style={{ marginTop: Spacing.sm }} />
        </View>
      </SafeAreaView>
    );
  }

  // listening / sending / speaking — the live screen
  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>

      <View style={styles.inCallHeader}>
        <View style={styles.avatarSm}>
          <Text style={styles.avatarEmojiSm}>🧭</Text>
        </View>
        <Text style={styles.callerName}>Becoming</Text>
        <Text style={styles.callerSub}>
          {callState === 'listening' && !recorderState.isRecording && "Tap the mic and say what you want to do"}
          {recorderState.isRecording && 'Listening…'}
          {callState === 'sending' && 'Adding to your plan…'}
          {callState === 'speaking' && 'Confirming…'}
        </Text>
      </View>

      <View style={styles.captionBox}>
        {lastUserLine && <Text style={styles.youSaid}>You: "{lastUserLine}"</Text>}
        <Text style={styles.caption}>{caption}</Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {addedTasks.length > 0 && (
        <ScrollView style={styles.addedListBox} contentContainerStyle={styles.addedListContent}>
          <Text style={styles.addedListLabel}>ADDED TO TODAY'S PLAN</Text>
          {addedTasks.map((t, i) => (
            <View key={i} style={styles.addedRow}>
              <Text style={styles.addedCheck}>✓</Text>
              <Text style={styles.addedText}>{t}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.inCallControls}>
        {callState === 'sending' ? (
          <ActivityIndicator size="large" color={Colors.purple} />
        ) : callState === 'speaking' ? (
          <View style={styles.speakingIndicator}>
            <ActivityIndicator size="small" color={Colors.purple} />
          </View>
        ) : (
          <TouchableOpacity
            onPress={recorderState.isRecording ? handleStopRecording : handleStartRecording}
            style={[styles.micBtn, recorderState.isRecording && styles.micBtnActive]}
          >
            <Text style={styles.micIcon}>{recorderState.isRecording ? '⏹' : '🎤'}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={finishAndClose} style={styles.endCallBtn}>
          <Text style={styles.endCallIcon}>✓</Text>
          <Text style={styles.endCallLabel}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.purple },
  closeBtn: { position: 'absolute', top: Spacing.lg, left: Spacing.lg, zIndex: 1, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: Colors.white, fontSize: 16, fontFamily: Fonts.semiBold },
  incomingBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  pulseOuter: { width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl },
  avatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 48 },
  avatarSm: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  avatarEmojiSm: { fontSize: 24 },
  callerName: { fontFamily: Fonts.bold, fontSize: 26, color: Colors.white, marginBottom: Spacing.xs, textAlign: 'center' },
  callerSub: { fontFamily: Fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  inCallHeader: { alignItems: 'center', paddingTop: Spacing.xxl, paddingBottom: Spacing.lg },
  captionBox: { paddingHorizontal: Spacing.xl, gap: Spacing.md, marginBottom: Spacing.md },
  youSaid: { fontFamily: Fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontStyle: 'italic' },
  caption: { fontFamily: Fonts.semiBold, fontSize: 20, color: Colors.white, textAlign: 'center', lineHeight: 28 },
  errorText: { fontFamily: Fonts.medium, fontSize: 13, color: '#FFD1D1', textAlign: 'center', marginTop: Spacing.sm },
  addedListBox: { flex: 1, marginHorizontal: Spacing.lg, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: Radius.lg, maxHeight: 180 },
  addedListContent: { padding: Spacing.md },
  addedListLabel: { fontFamily: Fonts.semiBold, fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.8, marginBottom: Spacing.sm },
  addedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  addedCheck: { color: Colors.orange, fontFamily: Fonts.bold, fontSize: 14 },
  addedText: { flex: 1, fontFamily: Fonts.medium, fontSize: 14, color: Colors.white, lineHeight: 20 },
  inCallControls: { alignItems: 'center', gap: Spacing.xl, paddingBottom: Spacing.xxxl, paddingTop: Spacing.lg },
  micBtn: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  micBtnActive: { backgroundColor: Colors.orange },
  micIcon: { fontSize: 36 },
  speakingIndicator: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  endCallBtn: { alignItems: 'center', gap: 4 },
  endCallIcon: {
    width: 56, height: 56, borderRadius: 28, textAlign: 'center', textAlignVertical: 'center',
    fontSize: 22, overflow: 'hidden', backgroundColor: Colors.success, color: Colors.white, lineHeight: 56,
  },
  endCallLabel: { fontFamily: Fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
});
