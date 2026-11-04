import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { WalkthroughShell } from '../../components/onboarding/WalkthroughShell';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';

const BARS = [30, 45, 90, 60, 35];

export default function Walkthrough2() {
  const router = useRouter();

  return (
    <WalkthroughShell
      step={1}
      total={4}
      title="Execute Daily Rhythm"
      subtitle="Stay in flow with a dynamic schedule that adapts to your energy and peak performance windows."
      onNext={() => router.push('/(auth)/walkthrough-3')}
      onBack={() => router.back()}
      onSkip={() => router.push('/(auth)/sign-up')}
    >
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.cardLabel}>CURRENT WINDOW</Text>
          <View style={styles.peakBadge}>
            <Text style={styles.peakBadgeText}>⚡ PEAK ENERGY</Text>
          </View>
        </View>
        <Text style={styles.cardTitle}>Deep Focus Phase</Text>
        <View style={styles.taskRow}>
          <View style={styles.taskIcon}>
            <Text style={{ fontSize: 16 }}>📝</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.taskTitle}>Finalize Strategic Pitch</Text>
            <Text style={styles.taskSub}>45 mins remaining</Text>
          </View>
        </View>
      </View>

      <View style={styles.forecastCard}>
        <Text style={styles.forecastLabel}>📈 Energy Forecast</Text>
        <View style={styles.barsRow}>
          {BARS.map((h, i) => (
            <View key={i} style={[styles.bar, { height: h, backgroundColor: i === 2 ? Colors.purple : Colors.purpleLight }]} />
          ))}
        </View>
        <Text style={styles.forecastSub}>Peak expected at 11:30 AM</Text>
      </View>
    </WalkthroughShell>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.lg, marginBottom: Spacing.md, borderLeftWidth: 3, borderLeftColor: Colors.purple },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  cardLabel: { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.purple, letterSpacing: 0.5 },
  peakBadge: { backgroundColor: Colors.orange + '30', paddingVertical: 2, paddingHorizontal: Spacing.sm, borderRadius: Radius.full },
  peakBadgeText: { fontFamily: Fonts.semiBold, fontSize: 10, color: Colors.orangeDark },
  cardTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.text.primary, marginBottom: Spacing.sm },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.md, padding: Spacing.sm },
  taskIcon: { width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: Colors.purple, alignItems: 'center', justifyContent: 'center' },
  taskTitle: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.primary },
  taskSub: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.text.muted },
  forecastCard: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  forecastLabel: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.text.primary, marginBottom: Spacing.md },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, height: 90, marginBottom: Spacing.sm },
  bar: { flex: 1, borderRadius: 4 },
  forecastSub: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.text.muted },
});
