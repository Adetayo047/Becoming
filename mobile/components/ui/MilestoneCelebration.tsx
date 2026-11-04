import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';

export interface MilestoneWin {
  milestoneTitle: string;
  goalTitle: string;
  /** Completed milestones on the goal, counting this one. */
  done: number;
  total: number;
  next: { id: string; title: string } | null;
}

interface Props {
  win: MilestoneWin | null;
  onClose: () => void;
  onNext: (next: MilestoneWin['next']) => void;
  onShare: () => void;
}

// Stitch: milestone_celebration — shown when a milestone is ticked complete.
export function MilestoneCelebration({ win, onClose, onNext, onShare }: Props) {
  const percent = win && win.total > 0 ? Math.round((win.done / win.total) * 100) : 0;
  const boost = win && win.total > 0 ? Math.round(100 / win.total) : 0;
  const goalDone = !!win && win.done >= win.total;

  return (
    <Modal visible={!!win} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.brand}>Becoming</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        {win && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.trophyWrap}>
              <Text style={[styles.sparkle, { top: 0, left: 18 }]}>⭐</Text>
              <Text style={[styles.sparkle, { top: 40, right: 6 }]}>✨</Text>
              <View style={styles.trophyRing}>
                <Text style={styles.trophy}>🏆</Text>
              </View>
            </View>

            <Text style={styles.title}>{goalDone ? 'Goal Achieved!' : 'Milestone Architected!'}</Text>
            <Text style={styles.subtitle}>
              {goalDone
                ? 'Every milestone done. This is who you set out to become.'
                : "One more brick in your foundation of excellence. You're building a better you, day by day."}
            </Text>

            <View style={styles.card}>
              <View style={styles.chips}>
                <View style={styles.chip}><Text style={styles.chipText} numberOfLines={1}>{win.goalTitle}</Text></View>
                <View style={[styles.chip, styles.chipDone]}><Text style={[styles.chipText, styles.chipDoneText]}>✓ Complete</Text></View>
              </View>
              <Text style={styles.milestone}>{win.milestoneTitle}</Text>
              <Text style={styles.body}>
                {win.done} of {win.total} milestone{win.total === 1 ? '' : 's'} done for this goal.
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${percent}%` }]} />
              </View>
            </View>

            <View style={styles.boostCard}>
              <Text style={styles.boostValue}>+{boost}%</Text>
              <Text style={styles.boostLabel}>GOAL PROGRESS · NOW {percent}%</Text>
            </View>

            <View style={styles.nextCard}>
              <Text style={styles.nextIcon}>🛡️</Text>
              <Text style={styles.nextTitle} numberOfLines={2}>
                {win.next ? win.next.title : goalDone ? 'All milestones complete' : 'Add your next milestone'}
              </Text>
              <Text style={styles.nextSub}>
                {win.next ? 'Up next' : goalDone ? 'Time to set a bigger goal' : 'Keep the momentum going'}
              </Text>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => onNext(win.next)}>
              <Text style={styles.primaryText}>{win.next ? 'Start Next Milestone →' : 'Set Next Milestone →'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
              <Text style={styles.shareText}>Share Progress ⤴</Text>
            </TouchableOpacity>
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
  trophyWrap: { alignSelf: 'center', width: 170, height: 170, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  trophyRing: { width: 140, height: 140, borderRadius: 70, borderWidth: 4, borderStyle: 'dashed', borderColor: Colors.orange, alignItems: 'center', justifyContent: 'center' },
  trophy: { fontSize: 60 },
  sparkle: { position: 'absolute', fontSize: 22 },
  title: { fontFamily: Fonts.bold, fontSize: 34, lineHeight: 40, color: Colors.purple, textAlign: 'center', marginTop: Spacing.md },
  subtitle: { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 22, color: Colors.text.secondary, textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.xl },
  card: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.md },
  chips: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  chip: { flexShrink: 1, backgroundColor: Colors.surfaceContainer, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.purple },
  chipDone: { flexShrink: 0, backgroundColor: Colors.success + '1A' },
  chipDoneText: { color: Colors.success },
  milestone: { fontFamily: Fonts.bold, fontSize: 24, lineHeight: 30, color: Colors.text.primary, marginBottom: Spacing.sm },
  body: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21, color: Colors.text.secondary, marginBottom: Spacing.md },
  track: { height: 10, borderRadius: 5, backgroundColor: Colors.surfaceContainer },
  fill: { height: 10, borderRadius: 5, backgroundColor: Colors.purple },
  boostCard: { backgroundColor: Colors.orange + '26', borderWidth: 1, borderColor: Colors.orange + '55', borderRadius: Radius.xl, paddingVertical: Spacing.lg, alignItems: 'center', marginBottom: Spacing.md },
  boostValue: { fontFamily: Fonts.semiBold, fontSize: 34, color: '#815600' },
  boostLabel: { fontFamily: Fonts.medium, fontSize: 11, letterSpacing: 1.2, color: '#815600', marginTop: 2 },
  nextCard: { backgroundColor: Colors.purple, borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.xl },
  nextIcon: { fontSize: 26, marginBottom: Spacing.xs },
  nextTitle: { fontFamily: Fonts.semiBold, fontSize: 18, color: Colors.white, textAlign: 'center' },
  nextSub: { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  primaryBtn: { backgroundColor: Colors.purpleDark, borderRadius: Radius.lg, paddingVertical: 16, alignItems: 'center', marginBottom: Spacing.md },
  primaryText: { fontFamily: Fonts.semiBold, fontSize: 17, color: Colors.white },
  shareBtn: { backgroundColor: Colors.orange, borderRadius: Radius.lg, paddingVertical: 16, alignItems: 'center' },
  shareText: { fontFamily: Fonts.semiBold, fontSize: 17, color: Colors.black },
});
