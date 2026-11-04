import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { WalkthroughShell } from '../../components/onboarding/WalkthroughShell';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';

export default function Walkthrough4() {
  const router = useRouter();

  return (
    <WalkthroughShell
      step={3}
      total={4}
      title="Social Momentum"
      subtitle="Growth is a team sport. Sync with accountability partners to celebrate wins and maintain momentum together."
      onNext={() => router.push('/(auth)/sign-up')}
      onBack={() => router.back()}
      onSkip={() => router.push('/(auth)/sign-up')}
      nextLabel="Get Started →"
    >
      <View style={styles.feedCard}>
        <View style={styles.feedBadge}>
          <Text style={styles.feedBadgeText}>SHARED PROGRESS FEED</Text>
        </View>
        <Text style={styles.feedTitle}>Real-time Inspiration</Text>
        {[
          { emoji: '👩🏾', text: 'Amaka completed "Morning Focus"', time: '5m ago' },
          { emoji: '👨🏾', text: 'Tunde hit a 7-day streak!', time: 'Now' },
        ].map((item) => (
          <View key={item.text} style={styles.feedRow}>
            <View style={styles.feedAvatar}><Text>{item.emoji}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.feedText}>{item.text}</Text>
              <Text style={styles.feedTime}>✓ {item.time}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.groupCard}>
        <Text style={styles.groupIcon}>👥</Text>
        <Text style={styles.groupTitle}>Mastermind Groups</Text>
        <Text style={styles.groupSub}>Curated micro-communities pursuing similar targets. No noise, just growth.</Text>
      </View>
    </WalkthroughShell>
  );
}

const styles = StyleSheet.create({
  feedCard: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  feedBadge: { alignSelf: 'flex-start', backgroundColor: Colors.surfaceContainer, paddingVertical: 3, paddingHorizontal: Spacing.sm, borderRadius: Radius.full, marginBottom: 4 },
  feedBadgeText: { fontFamily: Fonts.semiBold, fontSize: 9, color: Colors.text.secondary, letterSpacing: 0.5 },
  feedTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.text.primary, marginBottom: Spacing.sm },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.md, padding: Spacing.sm },
  feedAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.purpleLight, alignItems: 'center', justifyContent: 'center' },
  feedText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.primary },
  feedTime: { fontFamily: Fonts.regular, fontSize: 10, color: Colors.success },
  groupCard: { backgroundColor: Colors.purple, borderRadius: Radius.lg, padding: Spacing.lg },
  groupIcon: { fontSize: 24, marginBottom: Spacing.sm },
  groupTitle: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.white, marginBottom: 4 },
  groupSub: { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 17 },
});
