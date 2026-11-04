import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';

const TERMS = `1. Acceptance of Terms

By accessing or using the Becoming platform, you agree to be bound by these Terms of Service. If you do not agree to all of the terms and conditions, you may not access the service. These terms represent a binding agreement between you and Becoming Nigeria.

2. Your Growth Account

To access certain features, you must create a Becoming Profile. You are responsible for maintaining the confidentiality of your credentials. You agree to provide accurate, current, and complete information during registration.

3. Accountability Partners & Community

Sharing goals, progress, or messages with an accountability partner or the Community feed is opt-in and visible according to your Privacy setting. You are responsible for what you choose to share.

4. AI Features

The AI Architect and related features use OpenAI to help you plan and reflect. Suggestions are generated from the information you provide and should be treated as guidance, not professional advice.

5. Termination

You may delete your account at any time. We may suspend accounts that violate these terms or misuse the Community features.`;

const PRIVACY = `1. What We Collect

We collect the information you provide directly (name, email, goals, tasks, reflections) and, if you opt in, calendar access and push notification tokens.

2. How We Use It

Your data powers your personal dashboard, streaks, and AI suggestions. We do not sell your personal data.

3. Visibility Controls

Your Progress Visibility setting (Only Me / Trusted Connections / Community) controls who can discover your profile and see your activity beyond what you explicitly post.

4. Third Parties

If you connect Google Calendar, we use your Google tokens only to create events you request. If you use AI features, your inputs are sent to OpenAI to generate a response.

5. Your Rights

You can request account deletion at any time from Settings, which removes your personal data from our systems.`;

export default function Terms() {
  const router = useRouter();
  const [tab, setTab] = useState<'terms' | 'privacy'>('terms');

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Legal Foundations</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={styles.tab} onPress={() => setTab('terms')}>
          <Text style={[styles.tabText, tab === 'terms' && styles.tabTextActive]}>Terms of Service</Text>
          {tab === 'terms' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setTab('privacy')}>
          <Text style={[styles.tabText, tab === 'privacy' && styles.tabTextActive]}>Privacy Policy</Text>
          {tab === 'privacy' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.body}>{tab === 'terms' ? TERMS : PRIVACY}</Text>
        <Text style={styles.updated}>Last updated: September 5, 2026</Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  headerTitle: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.text.primary, marginTop: 4 },
  tabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { paddingVertical: Spacing.md, marginRight: Spacing.lg },
  tabText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.text.muted },
  tabTextActive: { color: Colors.purple },
  tabUnderline: { height: 2, backgroundColor: Colors.purple, marginTop: 6, borderRadius: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  body: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary, lineHeight: 22 },
  updated: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted, marginTop: Spacing.lg, textAlign: 'center' },
  footer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  closeBtn: { backgroundColor: Colors.purple, borderRadius: Radius.full, paddingVertical: Spacing.md, alignItems: 'center' },
  closeBtnText: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.white },
});
