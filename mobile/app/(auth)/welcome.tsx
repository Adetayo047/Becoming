import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { Colors, Fonts, Spacing } from '../../constants/theme';

export default function Welcome() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.blob} />

      <View style={styles.content}>
        <View style={styles.logoArea}>
          <View style={styles.logoMark}>
            <Text style={styles.logoB}>B</Text>
            <View style={styles.logoAccent} />
          </View>
          <Text style={styles.logoText}>Becoming</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Your future is{'\n'}calling.</Text>
          <Text style={styles.heroAccent}>Answer it.</Text>
          <Text style={styles.heroSub}>
            Set goals. Take action. Become more.{'\n'}
            Built for ambitious young Nigerians.
          </Text>
        </View>

        <View style={styles.pills}>
          {['Goal Architecture', 'Daily Action', 'Growth Tracking', 'Accountability'].map((label) => (
            <View key={label} style={styles.pill}>
              <Text style={styles.pillText}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.cta}>
        <Button
          title="Get Started — It's Free"
          onPress={() => router.push('/(auth)/sign-up')}
        />
        <Button
          title="I already have an account"
          onPress={() => router.push('/(auth)/sign-in')}
          variant="ghost"
          style={styles.signInBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  blob: {
    position: 'absolute',
    top: -80, right: -80,
    width: 280, height: 280,
    borderRadius: 140,
    backgroundColor: Colors.purpleLight,
    opacity: 0.15,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    justifyContent: 'center',
  },
  logoArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  logoMark: {
    width: 44, height: 44,
    backgroundColor: Colors.purple,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoB: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 26, lineHeight: 30 },
  logoAccent: {
    position: 'absolute',
    bottom: 6, right: -4,
    width: 14, height: 14,
    backgroundColor: Colors.orange,
    borderRadius: 7,
  },
  logoText: { fontFamily: Fonts.bold, fontSize: 26, color: Colors.text.primary },
  hero: { marginBottom: Spacing.xl },
  heroTitle: { fontFamily: Fonts.bold, fontSize: 40, color: Colors.text.primary, lineHeight: 48 },
  heroAccent: { fontFamily: Fonts.bold, fontSize: 40, color: Colors.orange, lineHeight: 48, marginBottom: Spacing.lg },
  heroSub: { fontFamily: Fonts.regular, fontSize: 16, color: Colors.text.secondary, lineHeight: 24 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pill: {
    backgroundColor: Colors.white,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.secondary },
  cta: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
  signInBtn: { paddingVertical: Spacing.sm },
});
