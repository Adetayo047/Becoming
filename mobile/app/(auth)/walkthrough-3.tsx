import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { WalkthroughShell } from '../../components/onboarding/WalkthroughShell';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';

export default function Walkthrough3() {
  const router = useRouter();

  return (
    <WalkthroughShell
      step={2}
      total={4}
      title="Your Growth Passport"
      subtitle="Visualize your progress, earn badges, and unlock deep insights into your growth patterns."
      onNext={() => router.push('/(auth)/walkthrough-4')}
      onBack={() => router.back()}
      onSkip={() => router.push('/(auth)/sign-up')}
    >
      <View style={styles.card}>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <ProgressRing percent={80} size={64} strokeWidth={7} color={Colors.purple} label="80%" />
            <Text style={styles.statLabel}>Alignment</Text>
          </View>
          <View style={styles.statBox}>
            <View style={styles.badgeRow}>
              <Text style={styles.badgeMini}>⚡</Text>
              <Text style={styles.badgeMini}>🏅</Text>
              <Text style={styles.badgeMini}>✨</Text>
            </View>
            <Text style={styles.statLabel}>3 Active Milestones</Text>
          </View>
        </View>
        <View style={styles.flowCard}>
          <View style={styles.flowHeader}>
            <Text style={styles.flowLabel}>Weekly Flow</Text>
            <Text style={styles.flowDelta}>+14%</Text>
          </View>
          <View style={styles.flowBars}>
            {[20, 30, 70, 25, 55, 15, 45].map((h, i) => (
              <View key={i} style={[styles.flowBar, { height: h, backgroundColor: i === 6 ? Colors.orange : Colors.purpleLight }]} />
            ))}
          </View>
        </View>
      </View>
    </WalkthroughShell>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: Spacing.lg, marginBottom: Spacing.md, gap: Spacing.md },
  statsRow: { flexDirection: 'row', gap: Spacing.md },
  statBox: { flex: 1, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  statLabel: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.secondary, textAlign: 'center' },
  badgeRow: { flexDirection: 'row', gap: 4 },
  badgeMini: { fontSize: 20 },
  flowCard: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  flowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  flowLabel: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.text.primary },
  flowDelta: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.orangeDark },
  flowBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 70 },
  flowBar: { flex: 1, borderRadius: 3 },
});
