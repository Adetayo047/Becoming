import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { community, accountability, ApiSuggestedPartner } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Colors, Fonts, Spacing, Radius, CATEGORY_META } from '../../constants/theme';

export default function Discover() {
  const router = useRouter();
  const [partners, setPartners] = useState<ApiSuggestedPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  useEffect(() => {
    community.discover().then(({ data }) => {
      if (data) setPartners(data);
      setLoading(false);
    });
  }, []);

  async function handleConnect(partner: ApiSuggestedPartner) {
    setConnectingId(partner.id);
    try {
      const { error, upgrade } = await accountability.invite(partner.email);
      if (upgrade) return;
      if (error) {
        Alert.alert('Could not connect', error);
        return;
      }
      Alert.alert('Invite sent!', `${partner.fullName} will see your invite when they check Accountability Partners.`);
      setPartners((prev) => prev.filter((p) => p.id !== partner.id));
    } finally {
      setConnectingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Find your growth partner</Text>
        <Text style={styles.subtitle}>
          Self-actualization is a team sport. Connect with people working on similar goals.
        </Text>

        <TouchableOpacity onPress={() => router.push('/community/groups/create')} style={styles.groupBanner}>
          <View style={styles.groupBannerIcon}>
            <Text style={{ fontSize: 20 }}>👥</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.groupBannerTitle}>Start a Mastermind Group</Text>
            <Text style={styles.groupBannerSub}>Invite a few people for weekly progress syncs</Text>
          </View>
          <Text style={styles.groupBannerArrow}>→</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Suggested Partners</Text>

        {loading ? (
          <ActivityIndicator color={Colors.purple} style={{ marginTop: Spacing.xl }} />
        ) : partners.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>No suggestions right now</Text>
            <Text style={styles.emptySub}>Check back once more people join Becoming.</Text>
          </View>
        ) : (
          partners.map((p) => (
            <Card key={p.id} style={styles.partnerCard} variant="default">
              <View style={styles.partnerHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{p.fullName?.[0]?.toUpperCase() || '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partnerName}>{p.fullName}</Text>
                  <Text style={styles.matchScore}>⭐ {p.matchScore}% Match</Text>
                </View>
              </View>
              {p.growthAreas.length > 0 && (
                <View style={styles.tagRow}>
                  {p.growthAreas.map((cat) => {
                    const meta = CATEGORY_META[cat as keyof typeof CATEGORY_META];
                    return (
                      <View key={cat} style={styles.tag}>
                        <Text style={styles.tagText}>{meta?.emoji} {meta?.label ?? cat}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
              <TouchableOpacity
                onPress={() => handleConnect(p)}
                disabled={connectingId === p.id}
                style={styles.connectBtn}
              >
                <Text style={styles.connectBtnText}>
                  {connectingId === p.id ? 'Connecting…' : `Connect with ${p.fullName?.split(' ')[0]}`}
                </Text>
              </TouchableOpacity>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.purple },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  title: { fontFamily: Fonts.bold, fontSize: 24, color: Colors.text.primary, marginBottom: Spacing.sm },
  subtitle: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.text.secondary, lineHeight: 20, marginBottom: Spacing.lg },
  groupBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.purple, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.xl },
  groupBannerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  groupBannerTitle: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.white },
  groupBannerSub: { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  groupBannerArrow: { color: Colors.white, fontSize: 18 },
  sectionTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary, marginBottom: Spacing.md },
  empty: { alignItems: 'center', paddingTop: Spacing.xl },
  emptyEmoji: { fontSize: 40, marginBottom: Spacing.md },
  emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary, marginBottom: Spacing.xs },
  emptySub: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.muted, textAlign: 'center' },
  partnerCard: { padding: Spacing.md, marginBottom: Spacing.md },
  partnerHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.purple, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: Fonts.bold, fontSize: 22, color: Colors.white },
  partnerName: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary },
  matchScore: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.orangeDark, marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.md },
  tag: { backgroundColor: Colors.surfaceContainer, paddingVertical: 4, paddingHorizontal: Spacing.sm, borderRadius: Radius.full },
  tagText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.text.secondary },
  connectBtn: { backgroundColor: Colors.purple, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
  connectBtnText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.white },
});
