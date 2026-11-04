import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WeekAlignment } from '../../lib/api';
import { ProgressRing } from './ProgressRing';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';

interface Props {
  alignment: WeekAlignment | null;
  onClose: () => void;
  onNextSprint: () => void;
}

// Fixed spots so the confetti looks scattered without moving between renders.
const CONFETTI = [
  { top: 640, left: 30, c: Colors.purple }, { top: 700, left: 300, c: Colors.orange }, { top: 820, left: 80, c: Colors.purpleLight },
  { top: 900, left: 340, c: Colors.purple }, { top: 1010, left: 20, c: Colors.orange }, { top: 1080, left: 260, c: Colors.purple },
  { top: 1180, left: 120, c: Colors.orange }, { top: 1230, left: 330, c: Colors.purpleLight }, { top: 560, left: 350, c: Colors.purple },
];

function level(score: number) {
  if (score >= 90) return { title: 'Perfect Alignment', sub: 'Your vision and actions are in complete harmony.', badge: '⭐ FULLY ALIGNED' };
  if (score >= 70) return { title: 'Strong Alignment', sub: 'Most of your week moved your goals forward.', badge: 'ON TRACK' };
  if (score >= 40) return { title: 'Building Alignment', sub: 'The pieces are there. Close a few gaps next week.', badge: 'BUILDING' };
  return { title: 'Week Reviewed', sub: 'Honest reflection is the first step. Plan next week from your goals.', badge: 'FRESH START' };
}

// Stitch: weekly_alignment_celebration — shown after the weekly review is saved.
export function WeeklyAlignmentCelebration({ alignment: a, onClose, onNextSprint }: Props) {
  const l = a ? level(a.score) : null;

  return (
    <Modal visible={!!a} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.brand}>Becoming</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        {a && l && (
          <ScrollView contentContainerStyle={styles.scroll}>
            {a.score >= 90 && CONFETTI.map((p, i) => (
              <View key={i} style={[styles.confetti, { top: p.top, left: p.left, backgroundColor: p.c, transform: [{ rotate: `${i * 23}deg` }] }]} />
            ))}

            <Text style={styles.title}>{l.title}</Text>
            <Text style={styles.subtitle}>{l.sub}</Text>

            <View style={styles.ringWrap}>
              <ProgressRing percent={a.score} size={230} strokeWidth={16} color={Colors.purple} trackColor={Colors.orange + '55'} label={`${a.score}%`} labelSize={56} />
              <View style={styles.badge}><Text style={styles.badgeText}>{l.badge}</Text></View>
            </View>

            <View style={styles.card}>
              <View style={[styles.cardIcon, { backgroundColor: Colors.orange + '33' }]}><Text style={styles.cardIconText}>⚡</Text></View>
              <Text style={styles.cardTitle}>Momentum</Text>
              <Text style={styles.cardBody}>
                {a.tasksTotal > 0
                  ? `Completed ${a.tasksDone} of ${a.tasksTotal} planned actions this week.`
                  : 'No actions were planned this week. Plan a few for each goal next week.'}
              </Text>
            </View>

            <View style={styles.card}>
              <View style={[styles.cardIcon, { backgroundColor: Colors.purple + '22' }]}><Text style={styles.cardIconText}>🧠</Text></View>
              <Text style={styles.cardTitle}>Focus</Text>
              <Text style={styles.cardBody}>
                {a.tasksTotal > 0
                  ? `${a.tasksLinked} of ${a.tasksTotal} actions were tied to a goal.`
                  : 'Link each daily action to a goal so every day counts.'}
              </Text>
            </View>

            <View style={styles.card}>
              <View style={[styles.cardIcon, { backgroundColor: Colors.purpleDark }]}><Text style={styles.cardIconText}>✓✓</Text></View>
              <Text style={styles.cardTitle}>Impact</Text>
              <Text style={styles.cardBody}>
                {a.weeklyTotal > 0 ? `${a.weeklyDone} of ${a.weeklyTotal} weekly milestone${a.weeklyTotal === 1 ? '' : 's'} done. ` : ''}
                {a.goals > 0 ? `${a.fullyPlanned} of ${a.goals} goal${a.goals === 1 ? '' : 's'} planned from year down to week.` : ''}
              </Text>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={onNextSprint}>
              <Text style={styles.primaryText}>Start Next Sprint →</Text>
            </TouchableOpacity>
            <Text style={styles.streak}>
              {a.streakWeeks >= 2 ? `You're on a ${a.streakWeeks}-week review streak.` : 'Review done. Come back next week to start a review streak.'}
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  brand: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.purple },
  close: { fontSize: 20, color: Colors.text.secondary },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
  confetti: { position: 'absolute', width: 10, height: 10, borderRadius: 2, opacity: 0.8 },
  title: { fontFamily: Fonts.bold, fontSize: 38, lineHeight: 44, color: Colors.purple, textAlign: 'center', marginTop: Spacing.sm },
  subtitle: { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 22, color: Colors.text.secondary, textAlign: 'center', marginTop: Spacing.sm },
  ringWrap: { alignItems: 'center', marginVertical: Spacing.xl },
  badge: { backgroundColor: '#6A4600', borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 5, marginTop: Spacing.md },
  badgeText: { fontFamily: Fonts.semiBold, fontSize: 12, letterSpacing: 0.8, color: Colors.white },
  card: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  cardIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  cardIconText: { fontSize: 16, color: Colors.white },
  cardTitle: { fontFamily: Fonts.semiBold, fontSize: 20, color: Colors.purple, marginBottom: 4 },
  cardBody: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21, color: Colors.text.primary },
  primaryBtn: { backgroundColor: Colors.purpleDark, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center', marginTop: Spacing.md },
  primaryText: { fontFamily: Fonts.semiBold, fontSize: 18, color: Colors.white },
  streak: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary, textAlign: 'center', marginTop: Spacing.sm },
});
