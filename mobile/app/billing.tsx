import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { billing, ApiBillingInfo } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Colors, Fonts, Spacing, Radius } from '../constants/theme';

export default function Billing() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [info, setInfo] = useState<ApiBillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingTo, setChangingTo] = useState<string | null>(null);
  const [demoTier, setDemoTier] = useState<'pro' | 'plus' | null>(null);
  const [demoPaying, setDemoPaying] = useState(false);

  async function load() {
    const { data } = await billing.get();
    if (data) setInfo(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handleSwitch(tier: 'free' | 'pro' | 'plus') {
    if (tier !== 'free' && info?.demoPayments) {
      setDemoTier(tier);
      return;
    }
    handleChangePlan(tier);
  }

  async function handleDemoPay() {
    if (!demoTier) return;
    const tier = demoTier;
    setDemoPaying(true);
    // Simulated processing delay so the demo checkout feels like a real one
    await new Promise((r) => setTimeout(r, 1500));
    setDemoPaying(false);
    setDemoTier(null);
    await handleChangePlan(tier);
  }

  async function handleChangePlan(tier: 'free' | 'pro' | 'plus') {
    setChangingTo(tier);
    try {
      const { error } = await billing.changePlan(tier);
      if (error) {
        Alert.alert(tier === 'free' ? 'Could not change plan' : 'Payments not set up yet', error);
        return;
      }
      if (user) setUser({ ...user, tier });
      await load();
      Alert.alert('Plan updated', `You're now on the ${info?.plans[tier].label ?? tier} plan.`);
    } finally {
      setChangingTo(null);
    }
  }

  function handleCancel() {
    Alert.alert('Cancel subscription?', "You'll move back to the Free plan.", [
      { text: 'Keep Plan', style: 'cancel' },
      {
        text: 'Cancel Plan',
        style: 'destructive',
        onPress: async () => {
          setChangingTo('free');
          try {
            await billing.cancel();
            if (user) setUser({ ...user, tier: 'free' });
            await load();
          } finally {
            setChangingTo(null);
          }
        },
      },
    ]);
  }

  if (loading || !info) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.purple} style={{ marginTop: Spacing.xxl }} />
      </SafeAreaView>
    );
  }

  const currentPlan = info.plans[info.currentTier];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Billing</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!info.paystackConfigured && (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeText}>
              {info.demoPayments
                ? '🧪 Demo mode — upgrading runs a demo checkout. No card is charged and no money moves.'
                : "💳 Payments aren't connected yet — you can preview plans here, but upgrading won't charge a card until that's set up."}
            </Text>
          </View>
        )}

        <Card style={styles.currentCard} variant="elevated">
          <Text style={styles.currentLabel}>CURRENT PLAN</Text>
          <Text style={styles.currentTier}>{currentPlan.label}</Text>
          <Text style={styles.currentPrice}>
            {currentPlan.priceNaira === 0 ? '₦0 — no card needed' : `₦${currentPlan.priceNaira.toLocaleString()}/mo`}
          </Text>
          {info.currentTier !== 'free' && (
            <Button title="Cancel Plan" variant="secondary" onPress={handleCancel} loading={changingTo === 'free'} style={styles.cancelBtn} />
          )}
        </Card>

        <Text style={styles.sectionTitle}>Plans</Text>
        {(Object.entries(info.plans) as [keyof typeof info.plans, typeof currentPlan][]).map(([key, plan]) => {
          const isCurrent = key === info.currentTier;
          return (
            <Card key={key} style={{ ...styles.planCard, ...(isCurrent && styles.planCardActive) }} variant={isCurrent ? 'default' : 'outlined'}>
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.label}</Text>
                <Text style={styles.planPrice}>{plan.priceNaira === 0 ? 'Free' : `₦${plan.priceNaira.toLocaleString()}/mo`}</Text>
              </View>
              {plan.benefits.map((b) => (
                <Text key={b} style={styles.benefit}>✓ {b}</Text>
              ))}
              {!isCurrent && (
                <Button
                  title={`Switch to ${plan.label}`}
                  variant={key === 'free' ? 'secondary' : 'primary'}
                  onPress={() => handleSwitch(key)}
                  loading={changingTo === key}
                  style={styles.switchBtn}
                />
              )}
              {isCurrent && <Text style={styles.currentBadge}>Current Plan</Text>}
            </Card>
          );
        })}
      </ScrollView>

      <Modal visible={!!demoTier} animationType="slide" transparent onRequestClose={() => !demoPaying && setDemoTier(null)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>DEMO CHECKOUT · NO REAL CHARGE</Text>
            </View>
            <Text style={styles.sheetTitle}>Upgrade to {demoTier && info.plans[demoTier].label}</Text>
            <Text style={styles.sheetAmount}>
              ₦{demoTier ? info.plans[demoTier].priceNaira.toLocaleString() : 0}
              <Text style={styles.sheetPer}>/month</Text>
            </Text>

            <Input label="Card number" value="4084 0840 8408 4081" editable={false} containerStyle={styles.sheetInput} />
            <View style={styles.sheetRow}>
              <Input label="Expiry" value="12/30" editable={false} containerStyle={styles.sheetHalf} />
              <Input label="CVV" value="408" editable={false} containerStyle={styles.sheetHalf} />
            </View>
            <Text style={styles.sheetHint}>Test card details are pre-filled. Nothing is charged.</Text>

            <Button
              title={demoPaying ? 'Processing…' : `Pay ₦${demoTier ? info.plans[demoTier].priceNaira.toLocaleString() : 0} (demo)`}
              onPress={handleDemoPay}
              loading={demoPaying}
            />
            <Button title="Cancel" variant="ghost" onPress={() => setDemoTier(null)} disabled={demoPaying} style={styles.sheetCancel} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  headerTitle: { fontFamily: Fonts.bold, fontSize: 28, color: Colors.text.primary, marginTop: Spacing.md },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  noticeCard: { backgroundColor: Colors.orange + '15', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.orange + '40' },
  noticeText: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary, lineHeight: 18 },
  currentCard: { padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.xl },
  currentLabel: { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.text.muted, letterSpacing: 0.5, marginBottom: Spacing.xs },
  currentTier: { fontFamily: Fonts.bold, fontSize: 24, color: Colors.purple, marginBottom: 4 },
  currentPrice: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.secondary, marginBottom: Spacing.md },
  cancelBtn: { marginTop: Spacing.sm },
  sectionTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary, marginBottom: Spacing.md },
  planCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  planCardActive: { borderWidth: 2, borderColor: Colors.purple },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  planName: { fontFamily: Fonts.bold, fontSize: 17, color: Colors.text.primary },
  planPrice: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.purple },
  benefit: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary, marginBottom: 6, lineHeight: 18 },
  switchBtn: { marginTop: Spacing.md },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.cream, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  demoBadge: { alignSelf: 'center', backgroundColor: Colors.orange + '20', borderRadius: Radius.full, paddingVertical: 4, paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  demoBadgeText: { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.orange, letterSpacing: 0.5 },
  sheetTitle: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.text.primary, textAlign: 'center' },
  sheetAmount: { fontFamily: Fonts.bold, fontSize: 28, color: Colors.purple, textAlign: 'center', marginVertical: Spacing.md },
  sheetPer: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.text.secondary },
  sheetInput: { marginBottom: Spacing.sm },
  sheetRow: { flexDirection: 'row', gap: Spacing.md },
  sheetHalf: { flex: 1, marginBottom: Spacing.sm },
  sheetHint: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted, textAlign: 'center', marginBottom: Spacing.md },
  sheetCancel: { marginTop: Spacing.sm },
  currentBadge: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.purple, marginTop: Spacing.sm, textAlign: 'center' },
});
