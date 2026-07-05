import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '../../lib/store';
import { Button } from '../../components/ui/Button';
import { StepIndicator } from '../../components/onboarding/StepIndicator';
import { Colors, Fonts, Spacing, Radius, CATEGORY_META } from '../../constants/theme';

const CATEGORIES = Object.entries(CATEGORY_META);

export default function OnboardingStep1() {
  const router = useRouter();
  const { setCategories } = useOnboardingStore();
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(cat: string) {
    setSelected((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat].slice(0, 3)
    );
  }

  function handleNext() {
    if (selected.length === 0) return;
    setCategories(selected);
    router.push('/(onboarding)/step-2');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Progress */}
        <View style={styles.topBar}>
          <StepIndicator total={3} current={1} />
          <Text style={styles.stepLabel}>Step 1 of 3</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.emoji}>🎯</Text>
            <Text style={styles.title}>What areas of your life do you want to grow?</Text>
            <Text style={styles.subtitle}>Pick up to 3. You can always add more later.</Text>
          </View>

          {/* Category cards */}
          <View style={styles.grid}>
            {CATEGORIES.map(([key, meta]) => {
              const isSelected = selected.includes(key);
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => toggle(key)}
                  activeOpacity={0.7}
                  style={[
                    styles.card,
                    isSelected && { borderColor: meta.color, backgroundColor: meta.color + '12' },
                  ]}
                >
                  <Text style={styles.cardEmoji}>{meta.emoji}</Text>
                  <Text style={[styles.cardLabel, isSelected && { color: meta.color }]}>
                    {meta.label}
                  </Text>
                  {isSelected && (
                    <View style={[styles.check, { backgroundColor: meta.color }]}>
                      <Text style={styles.checkMark}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {selected.length > 0 && (
            <Text style={styles.selectionHint}>
              {selected.length} area{selected.length > 1 ? 's' : ''} selected
              {selected.length === 3 ? ' (max)' : ''}
            </Text>
          )}
        </ScrollView>

        {/* CTA */}
        <View style={styles.cta}>
          <Button
            title="Continue →"
            onPress={handleNext}
            disabled={selected.length === 0}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  stepLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.muted },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  header: { marginBottom: Spacing.xl, marginTop: Spacing.lg },
  emoji: { fontSize: 40, marginBottom: Spacing.md },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    color: Colors.text.primary,
    lineHeight: 32,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  card: {
    width: '47%',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'flex-start',
    position: 'relative',
    minHeight: 90,
    justifyContent: 'center',
  },
  cardEmoji: { fontSize: 28, marginBottom: Spacing.xs },
  cardLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.text.primary,
  },
  check: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: Colors.white, fontSize: 12, fontFamily: Fonts.bold },
  selectionHint: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.purple,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  cta: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cream,
  },
});
