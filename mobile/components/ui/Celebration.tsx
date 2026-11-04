import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';

interface CelebrationProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  stats: { label: string; value: string }[];
  onShareWin: () => void;
  partnerComment?: { name: string; body: string } | null;
}

export function Celebration({ visible, onClose, title, subtitle, stats, onShareWin, partnerComment }: CelebrationProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.badgeCircle}>
          <Text style={styles.badgeCheck}>✓</Text>
          <Text style={styles.badgeLabel}>WIN!</Text>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {partnerComment && (
          <View style={styles.commentCard}>
            <Text style={styles.commentAuthor}>{partnerComment.name}</Text>
            <Text style={styles.commentBody}>"{partnerComment.body}"</Text>
          </View>
        )}

        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statBox}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={onShareWin} style={styles.shareBtn}>
          <Text style={styles.shareBtnText}>📤 Share Win</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={styles.dismissBtn}>
          <Text style={styles.dismissText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(28,27,35,0.92)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  closeBtn: { position: 'absolute', top: 60, right: Spacing.lg },
  closeText: { color: Colors.white, fontSize: 20 },
  badgeCircle: { width: 140, height: 140, borderRadius: 70, borderWidth: 3, borderColor: Colors.orange, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl },
  badgeCheck: { fontSize: 40, color: Colors.orangeDark, marginBottom: 4 },
  badgeLabel: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.purple },
  title: { fontFamily: Fonts.bold, fontSize: 30, color: Colors.purpleLight, textAlign: 'center', marginBottom: Spacing.sm },
  subtitle: { fontFamily: Fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginBottom: Spacing.lg },
  commentCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg, maxWidth: 320 },
  commentAuthor: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.orangeLight, marginBottom: 4 },
  commentBody: { fontFamily: Fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.9)', fontStyle: 'italic', lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  statBox: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, alignItems: 'center' },
  statLabel: { fontFamily: Fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  statValue: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.white, marginTop: 2 },
  shareBtn: { backgroundColor: Colors.white, borderRadius: Radius.full, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl, marginBottom: Spacing.sm },
  shareBtnText: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.purple },
  dismissBtn: { paddingVertical: Spacing.sm },
  dismissText: { fontFamily: Fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.7)' },
});
