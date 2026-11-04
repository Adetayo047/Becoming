import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ai, ApiDayPlan, ApiPlanBlock } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressRing } from '../components/ui/ProgressRing';
import { Colors, Fonts, Spacing, Radius } from '../constants/theme';

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

const TYPE_LABEL: Record<string, string> = {
  deep_work: '⚡ Deep Work',
  review: '🔍 Review',
  break: '☕ Break',
  sync: '🤝 Sync',
  custom: '📌 Custom',
};

export default function AiDayPlanner() {
  const router = useRouter();
  const [plan, setPlan] = useState<ApiDayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);

  async function load(note?: string) {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await ai.planDay(todayKey(), note);
      if (err || !data) {
        setError(err ?? 'Could not generate a plan');
        return;
      }
      setPlan(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCommit() {
    if (!plan) return;
    setCommitting(true);
    try {
      const { data, error: err } = await ai.commitPlan(plan.date, plan.blocks);
      if (err) {
        Alert.alert('Could not save plan', err);
        return;
      }
      Alert.alert('Plan committed!', `${data?.committed ?? plan.blocks.length} time blocks added to your day.`, [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } finally {
      setCommitting(false);
    }
  }

  function handleAdjust() {
    if (!plan) return;
    router.push({
      pathname: '/refine-plan',
      params: { date: plan.date, blocksJson: JSON.stringify(plan.blocks), strategicScore: String(plan.strategicScore ?? 0) },
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={Colors.purple} />
          <Text style={styles.loadingText}>Architecting your day…</Text>
        </View>
      ) : error ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorEmoji}>🤖</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Try Again" onPress={() => load()} variant="secondary" style={{ marginTop: Spacing.lg }} />
        </View>
      ) : plan ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>⚡ AI ARCHITECT PREVIEW</Text>
          <Text style={styles.title}>Intelligent Planning Analysis</Text>

          <Card style={styles.summaryCard} variant="default">
            <Text style={styles.summaryLabel}>Why I've scheduled this</Text>
            <Text style={styles.summaryText}>{plan.summary}</Text>
          </Card>

          {plan.strategicScore !== null && (
            <View style={styles.scoreCard}>
              <ProgressRing
                percent={plan.strategicScore}
                size={110}
                strokeWidth={10}
                color={Colors.orange}
                label={`${plan.strategicScore}%`}
              />
              <Text style={styles.scoreTitle}>Strategic Score</Text>
              <Text style={styles.scoreSub}>Your plan matches your long-term vision.</Text>
            </View>
          )}

          <View style={styles.timelineHeader}>
            <Text style={styles.sectionTitle}>Proposed Timeline</Text>
            <Text style={styles.blockCount}>{plan.blocks.length} blocks</Text>
          </View>

          {plan.blocks.map((b: ApiPlanBlock, i) => (
            <View key={i} style={styles.blockRow}>
              <View style={styles.blockTimeCol}>
                <Text style={styles.blockTime}>{b.startTime}</Text>
              </View>
              <View style={styles.blockLine} />
              <Card style={styles.blockCard} variant="outlined">
                <View style={styles.blockTypeBadge}>
                  <Text style={styles.blockTypeText}>{TYPE_LABEL[b.type] ?? b.type}</Text>
                </View>
                <Text style={styles.blockTitle}>{b.title}</Text>
                {b.reasoning && <Text style={styles.blockReasoning}>{b.reasoning}</Text>}
              </Card>
            </View>
          ))}

          <Button title="Commit to Planner →" onPress={handleCommit} loading={committing} style={styles.commitBtn} />
          <Button title="Adjust Variables" onPress={handleAdjust} variant="secondary" />
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  loadingText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.secondary, marginTop: Spacing.md },
  errorEmoji: { fontSize: 40, marginBottom: Spacing.md },
  errorText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.secondary, textAlign: 'center', lineHeight: 20 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  eyebrow: { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.purple, letterSpacing: 1, marginBottom: 4 },
  title: { fontFamily: Fonts.bold, fontSize: 24, color: Colors.text.primary, lineHeight: 30, marginBottom: Spacing.lg },
  summaryCard: { padding: Spacing.md, marginBottom: Spacing.lg },
  summaryLabel: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.text.primary, marginBottom: 6 },
  summaryText: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary, lineHeight: 19 },
  scoreCard: { backgroundColor: Colors.purple, borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.xl },
  scoreTitle: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.white, marginTop: Spacing.md },
  scoreSub: { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4, textAlign: 'center' },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary },
  blockCount: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted },
  blockRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  blockTimeCol: { width: 48 },
  blockTime: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.purple },
  blockLine: { width: 2, backgroundColor: Colors.border, marginRight: Spacing.sm, marginLeft: 4 },
  blockCard: { flex: 1, padding: Spacing.md, marginBottom: 0 },
  blockTypeBadge: { alignSelf: 'flex-start', backgroundColor: Colors.grey[100], paddingVertical: 2, paddingHorizontal: 8, borderRadius: Radius.full, marginBottom: 6 },
  blockTypeText: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.text.secondary },
  blockTitle: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.text.primary, marginBottom: 4 },
  blockReasoning: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted, lineHeight: 17 },
  commitBtn: { marginTop: Spacing.lg, marginBottom: Spacing.sm },
});
