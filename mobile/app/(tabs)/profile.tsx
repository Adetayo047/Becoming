import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { removeToken } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import { shareAppInvite } from '../../lib/invite';
import { Card } from '../../components/ui/Card';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await removeToken();
          signOut();
        },
      },
    ]);
  }

  const tierLabel = user?.tier === 'pro' ? 'Pro' : user?.tier === 'plus' ? 'Plus' : 'Free';
  const tierColor = user?.tier === 'pro' ? Colors.purple : user?.tier === 'plus' ? Colors.orange : Colors.grey[500];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>Profile</Text>

        <TouchableOpacity onPress={() => router.push('/growth-passport')} activeOpacity={0.8}>
        <Card style={styles.profileCard} variant="elevated">
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.fullName?.[0]?.toUpperCase() || 'B'}</Text>
          </View>
          <Text style={styles.name}>{user?.fullName || 'Becoming User'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={[styles.tierBadge, { backgroundColor: tierColor + '20' }]}>
            <Text style={[styles.tierText, { color: tierColor }]}>{tierLabel} Plan</Text>
          </View>
          <Text style={styles.passportLink}>View Growth Passport →</Text>
        </Card>
        </TouchableOpacity>

        {user?.tier === 'free' && (
          <TouchableOpacity style={styles.upgradeBanner} activeOpacity={0.8} onPress={() => router.push('/billing')}>
            <View style={styles.upgradeBody}>
              <Text style={styles.upgradeTitle}>Upgrade to Pro ✨</Text>
              <Text style={styles.upgradeSub}>Unlimited goals, AI Architect, growth trends</Text>
            </View>
            <Text style={styles.upgradePrice}>₦2,500/mo</Text>
          </TouchableOpacity>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          {[
            { icon: '📜', label: 'Activity History', sub: 'Your logged wins over time', onPress: () => router.push('/activity-history') },
            { icon: '🔔', label: 'Notifications & AI Coach', sub: 'Alerts, AI personality, wake-up call', onPress: () => router.push('/notifications-settings') },
            { icon: '💳', label: 'Plan & Billing', sub: user?.tier === 'free' ? 'Free plan · see what Pro unlocks' : `${user?.tier === 'plus' ? 'Plus' : 'Pro'} plan · manage your subscription`, onPress: () => router.push('/billing') },
            { icon: '📅', label: 'Calendar Sync', sub: 'Connect Google Calendar', onPress: () => router.push('/calendar-sync') },
            { icon: '🤝', label: 'Accountability Partner', sub: 'Invite someone you trust', onPress: () => router.push('/accountability') },
            { icon: '💌', label: 'Invite Friends', sub: 'Share Becoming on WhatsApp, SMS…', onPress: () => shareAppInvite(user?.email) },
            { icon: '🔒', label: 'Change Password', sub: 'Update your password', onPress: () => router.push('/change-password') },
          ].map((item) => (
            <TouchableOpacity key={item.label} style={styles.settingRow} onPress={item.onPress}>
              <Text style={styles.settingIcon}>{item.icon}</Text>
              <View style={styles.settingBody}>
                <Text style={styles.settingLabel}>{item.label}</Text>
                <Text style={styles.settingSub}>{item.sub}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={[styles.settingRow, styles.signOutRow]}
            onPress={handleSignOut}
          >
            <Text style={styles.settingIcon}>🚪</Text>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.settingRow, styles.signOutRow]} onPress={() => router.push('/delete-account')}>
            <Text style={styles.settingIcon}>🗑️</Text>
            <Text style={styles.deleteText}>Delete or Deactivate Account</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Becoming v1.0 · Made with ❤️ for Nigeria</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  pageTitle: { fontFamily: Fonts.bold, fontSize: 24, color: Colors.text.primary, marginBottom: Spacing.lg },
  profileCard: { alignItems: 'center', padding: Spacing.xl, marginBottom: Spacing.lg },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.purple, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  avatarText: { fontFamily: Fonts.bold, fontSize: 32, color: Colors.white },
  name: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.text.primary, marginBottom: 4 },
  email: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.muted, marginBottom: Spacing.md },
  tierBadge: { paddingVertical: 4, paddingHorizontal: Spacing.md, borderRadius: Radius.full },
  tierText: { fontFamily: Fonts.semiBold, fontSize: 12 },
  passportLink: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.purple, marginTop: Spacing.md },
  upgradeBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.purple, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.xl,
  },
  upgradeBody: { flex: 1, marginRight: Spacing.md },
  upgradeTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.white, marginBottom: 2 },
  upgradeSub: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.white + 'CC' },
  upgradePrice: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.orange },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  settingIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  settingBody: { flex: 1 },
  settingLabel: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.text.primary },
  settingSub: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted },
  chevron: { fontSize: 18, color: Colors.grey[400] },
  signOutRow: { borderBottomWidth: 0 },
  signOutText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.error, flex: 1 },
  deleteText: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.muted, flex: 1 },
  version: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted, textAlign: 'center', marginTop: Spacing.lg },
});
