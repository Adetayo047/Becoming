import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { WalkthroughShell } from '../../components/onboarding/WalkthroughShell';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';

export default function Walkthrough1() {
  const router = useRouter();

  return (
    <WalkthroughShell
      step={0}
      total={4}
      title="Architect Your Vision"
      subtitle="Collaborate with your AI partner to turn abstract dreams into concrete, actionable milestones."
      onNext={() => router.push('/(auth)/walkthrough-2')}
      onSkip={() => router.push('/(auth)/sign-up')}
    >
      <View style={styles.visual}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>🧭</Text>
        </View>
        <View style={styles.blueprintCard}>
          <View style={styles.blueprintLine} />
          <View style={[styles.blueprintLine, { width: '70%' }]} />
          <View style={[styles.blueprintLine, { width: '85%' }]} />
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeEmoji}>📐</Text>
        </View>
      </View>
    </WalkthroughShell>
  );
}

const styles = StyleSheet.create({
  visual: { alignItems: 'center', marginTop: Spacing.xl, marginBottom: Spacing.lg },
  iconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.purple, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  icon: { fontSize: 56 },
  blueprintCard: { width: '100%', backgroundColor: Colors.white, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, gap: Spacing.sm },
  blueprintLine: { height: 8, borderRadius: 4, backgroundColor: Colors.surfaceContainer, width: '100%' },
  badge: { position: 'absolute', bottom: -12, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.cream },
  badgeEmoji: { fontSize: 18 },
});
