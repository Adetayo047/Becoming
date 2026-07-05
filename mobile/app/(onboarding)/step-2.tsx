import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '../../lib/store';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { StepIndicator } from '../../components/onboarding/StepIndicator';
import { Colors, Fonts, Spacing, Radius, CATEGORY_META, Category } from '../../constants/theme';

const CATEGORIES = Object.entries(CATEGORY_META) as [Category, typeof CATEGORY_META[Category]][];

export default function OnboardingStep2() {
  const router = useRouter();
  const { selectedCategories, setFirstGoal } = useOnboardingStore();
  const [goalTitle, setGoalTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>(
    (selectedCategories[0] as Category) || 'career'
  );
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState('');

  async function fetchAISuggestions(title: string) {
    if (title.length < 10) return;
    setLoadingAI(true);
    try {
      // Will call our Next.js API once set up — mock for now
      await new Promise((r) => setTimeout(r, 800));
      setAiSuggestions([
        `Complete an online course in ${title.split(' ').slice(-2).join(' ')}`,
        `Build 1 real project that demonstrates this skill`,
        `Connect with 5 professionals already doing this`,
      ]);
    } catch {
      // Silently fail — suggestions are optional
    } finally {
      setLoadingAI(false);
    }
  }

  function handleNext() {
    if (goalTitle.trim().length < 5) {
      setError('Please describe your goal (at least 5 characters)');
      return;
    }
    setFirstGoal(goalTitle.trim(), selectedCategory);
    router.push('/(onboarding)/step-3');
  }

  const filteredCategories = selectedCategories.length > 0
    ? CATEGORIES.filter(([key]) => selectedCategories.includes(key))
    : CATEGORIES;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          {/* Progress */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.back}>← Back</Text>
            </TouchableOpacity>
            <StepIndicator total={3} current={2} />
            <Text style={styles.stepLabel}>Step 2 of 3</Text>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            <View style={styles.header}>
              <Text style={styles.emoji}>🌟</Text>
              <Text style={styles.title}>What's your biggest goal right now?</Text>
              <Text style={styles.subtitle}>
                Be specific. The clearer you are, the better your plan will be.
              </Text>
            </View>

            {/* Category picker */}
            <Text style={styles.sectionLabel}>Goal category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              {filteredCategories.map(([key, meta]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setSelectedCategory(key)}
                  style={[
                    styles.categoryChip,
                    selectedCategory === key && {
                      backgroundColor: meta.color,
                      borderColor: meta.color,
                    },
                  ]}
                >
                  <Text style={styles.categoryEmoji}>{meta.emoji}</Text>
                  <Text
                    style={[
                      styles.categoryChipText,
                      selectedCategory === key && { color: Colors.white },
                    ]}
                  >
                    {meta.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Goal input */}
            <Input
              label="Describe your goal"
              placeholder="e.g. Get a remote product design job by December"
              value={goalTitle}
              onChangeText={(t) => {
                setGoalTitle(t);
                setError('');
                if (t.length >= 15) fetchAISuggestions(t);
              }}
              multiline
              numberOfLines={3}
              error={error}
              containerStyle={styles.goalInput}
            />

            {/* AI milestone suggestions */}
            {(loadingAI || aiSuggestions.length > 0) && (
              <Card style={styles.aiCard} variant="outlined">
                <View style={styles.aiHeader}>
                  <Text style={styles.aiIcon}>✨</Text>
                  <Text style={styles.aiTitle}>AI suggests these milestones</Text>
                  {loadingAI && <ActivityIndicator size="small" color={Colors.purple} />}
                </View>
                {aiSuggestions.map((s, i) => (
                  <View key={i} style={styles.suggestion}>
                    <View style={styles.suggestDot} />
                    <Text style={styles.suggestText}>{s}</Text>
                  </View>
                ))}
                <Text style={styles.aiNote}>
                  You'll customise these in the next step.
                </Text>
              </Card>
            )}

            {/* Examples */}
            <Text style={styles.examplesLabel}>Need inspiration?</Text>
            {[
              'Land a software engineering job in 6 months',
              'Save ₦500,000 by end of year',
              'Launch my freelance design business',
            ].map((ex) => (
              <TouchableOpacity
                key={ex}
                onPress={() => setGoalTitle(ex)}
                style={styles.example}
              >
                <Text style={styles.exampleText}>"{ex}"</Text>
                <Text style={styles.useThis}>Use this →</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.cta}>
            <Button title="Continue →" onPress={handleNext} disabled={goalTitle.trim().length < 5} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  flex: { flex: 1 },
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  back: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.purple },
  stepLabel: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.text.muted },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  header: { marginBottom: Spacing.lg, marginTop: Spacing.md },
  emoji: { fontSize: 36, marginBottom: Spacing.sm },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: Colors.text.primary,
    lineHeight: 30,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  sectionLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  categoryRow: { gap: Spacing.sm, paddingBottom: Spacing.lg },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  categoryEmoji: { fontSize: 14 },
  categoryChipText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.text.secondary,
  },
  goalInput: { marginBottom: Spacing.lg },
  aiCard: { marginBottom: Spacing.lg, borderColor: Colors.purpleLight },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  aiIcon: { fontSize: 18 },
  aiTitle: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.purple, flex: 1 },
  suggestion: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  suggestDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.purple,
    marginTop: 7,
  },
  suggestText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.text.secondary,
    flex: 1,
    lineHeight: 20,
  },
  aiNote: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  examplesLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  example: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  exampleText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },
  useThis: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.purple,
  },
  cta: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cream,
  },
});
