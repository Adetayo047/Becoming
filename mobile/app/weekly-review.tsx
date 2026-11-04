import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { weeklyReview, ApiWeekData, WeekAlignment } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { addDays, mondayOf, todayKey } from '../components/planner/dates';
import { WeeklyAlignmentCelebration } from '../components/ui/WeeklyAlignmentCelebration';
import { Colors, Fonts, Spacing, Radius } from '../constants/theme';

const BLOCKERS = ['Procrastination', 'Low Energy', 'External Distraction', 'Lack of Clarity'];

export default function WeeklyReviewScreen() {
  const router = useRouter();
  const weekStart = mondayOf(todayKey());
  const [data, setData] = useState<ApiWeekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [blocker, setBlocker] = useState('');
  const [carryForward, setCarryForward] = useState('');
  const [rating, setRating] = useState(0);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [alignment, setAlignment] = useState<WeekAlignment | null>(null);

  useEffect(() => {
    weeklyReview.get(weekStart).then(({ data: d }) => {
      if (d) {
        setData(d);
        if (d.review) {
          setBlocker(d.review.blockedText ?? '');
          setCarryForward(d.review.carryForwardText ?? '');
          setRating(d.review.rating ?? 0);
          setInsight(d.review.aiInsight ?? null);
        }
      }
      setLoading(false);
    });
  }, []);

  async function handleComplete() {
    setSaving(true);
    try {
      const { data: saved, error } = await weeklyReview.save({
        weekStart,
        blockedText: blocker || undefined,
        carryForwardText: carryForward.trim() || undefined,
        rating: rating || undefined,
      });
      if (error) {
        Alert.alert('Could not save', error);
        return;
      }

      // Celebrate right away; the AI insight fills in behind the modal.
      setDone(true);
      if (saved) setAlignment(saved.alignment);
      setInsightLoading(true);
      weeklyReview.generateInsight(weekStart, blocker || undefined).then(({ data: insightData }) => {
        if (insightData?.insight) setInsight(insightData.insight);
        setInsightLoading(false);
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.purple} style={{ marginTop: Spacing.xxl }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.ritualLabel}>RITUAL</Text>
        <Text style={styles.title}>Weekly Review</Text>
        <Text style={styles.subtitle}>Pause and celebrate your growth before we design your next week.</Text>

        {data && data.wins.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>The Win Gallery</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.winsRow}>
              {data.wins.map((w) => (
                <Card key={w.id} style={styles.winCard} variant="default">
                  <Text style={styles.winKind}>{w.kind.replace('_', ' ')}</Text>
                  <Text style={styles.winHeadline} numberOfLines={3}>{w.headline}</Text>
                </Card>
              ))}
            </ScrollView>
          </>
        )}

        <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>
          {data?.completedCount ?? 0} task{data?.completedCount === 1 ? '' : 's'} completed this week
        </Text>

        <Text style={styles.sectionTitle}>Reflection & Honesty</Text>

        <Text style={styles.inputLabel}>What blocked you this week?</Text>
        <View style={styles.chipRow}>
          {BLOCKERS.map((b) => (
            <TouchableOpacity
              key={b}
              onPress={() => setBlocker(blocker === b ? '' : b)}
              style={[styles.chip, blocker === b && styles.chipActive]}
            >
              <Text style={[styles.chipText, blocker === b && styles.chipTextActive]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.inputLabel, { marginTop: Spacing.lg }]}>How can you adjust for next week?</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Define one small shift to overcome the blocker..."
          value={carryForward}
          onChangeText={setCarryForward}
          multiline
          placeholderTextColor={Colors.grey[400]}
        />

        <Text style={[styles.inputLabel, { marginTop: Spacing.lg }]}>How would you rate this week?</Text>
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity key={n} onPress={() => setRating(n)}>
              <Text style={[styles.star, n <= rating && styles.starActive]}>⭐</Text>
            </TouchableOpacity>
          ))}
        </View>

        {(insight || insightLoading) && (
          <Card style={styles.insightCard} variant="outlined">
            <Text style={styles.insightLabel}>✨ MOMENTUM INSIGHT</Text>
            {insightLoading ? (
              <ActivityIndicator color={Colors.purple} style={{ marginTop: Spacing.sm }} />
            ) : (
              <Text style={styles.insightText}>{insight}</Text>
            )}
          </Card>
        )}

        <Button
          title={done ? '✓ Review Complete' : 'Complete Review & Set Next Week'}
          onPress={handleComplete}
          loading={saving}
          disabled={done}
          style={styles.completeBtn}
        />
      </ScrollView>
      <WeeklyAlignmentCelebration
        alignment={alignment}
        onClose={() => setAlignment(null)}
        onNextSprint={() => {
          setAlignment(null);
          router.replace({ pathname: '/planner', params: { level: 'week', date: addDays(weekStart, 7) } });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  ritualLabel: { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.purple, letterSpacing: 1, marginBottom: 4 },
  title: { fontFamily: Fonts.bold, fontSize: 26, color: Colors.text.primary, marginBottom: Spacing.sm },
  subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary, lineHeight: 20, marginBottom: Spacing.xl },
  sectionTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary, marginBottom: Spacing.md },
  winsRow: { gap: Spacing.sm, paddingBottom: Spacing.lg },
  winCard: { padding: Spacing.md, width: 160 },
  winKind: { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.orangeDark, textTransform: 'uppercase', marginBottom: 4 },
  winHeadline: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.primary, lineHeight: 18 },
  inputLabel: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.primary, marginBottom: Spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  chipActive: { backgroundColor: Colors.purple, borderColor: Colors.purple },
  chipText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.secondary },
  chipTextActive: { color: Colors.white },
  textArea: { backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.md, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.primary, minHeight: 70, textAlignVertical: 'top' },
  starRow: { flexDirection: 'row', gap: Spacing.xs },
  star: { fontSize: 28, opacity: 0.3 },
  starActive: { opacity: 1 },
  insightCard: { padding: Spacing.md, marginTop: Spacing.xl, borderColor: Colors.purpleLight, backgroundColor: Colors.purple + '08' },
  insightLabel: { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.purple, letterSpacing: 0.5, marginBottom: Spacing.sm },
  insightText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.primary, lineHeight: 20 },
  completeBtn: { marginTop: Spacing.xl },
});
