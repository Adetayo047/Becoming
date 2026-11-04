import { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../ui/Button';
import { Colors, Fonts, Spacing } from '../../constants/theme';

interface WalkthroughShellProps {
  step: number; // 0-indexed
  total: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  onNext: () => void;
  onBack?: () => void;
  onSkip: () => void;
  nextLabel?: string;
}

export function WalkthroughShell({ step, total, title, subtitle, children, onNext, onBack, onSkip, nextLabel = 'Next' }: WalkthroughShellProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.brand}>Becoming</Text>
        <TouchableOpacity onPress={onSkip}>
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dots}>
        {Array.from({ length: total }).map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.content}>
        {children}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.cta}>
        <Button title={nextLabel} onPress={onNext} />
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  brand: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.purple },
  skip: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.muted },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: Spacing.lg },
  dot: { width: 24, height: 4, borderRadius: 2, backgroundColor: Colors.grey[200] },
  dotActive: { backgroundColor: Colors.purple, width: 32 },
  content: { flex: 1, paddingHorizontal: Spacing.lg },
  title: { fontFamily: Fonts.bold, fontSize: 26, color: Colors.text.primary, textAlign: 'center', lineHeight: 32, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.lg },
  cta: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
  backBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  backText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.purple },
});
