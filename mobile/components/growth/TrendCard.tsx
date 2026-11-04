import { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, TouchableOpacity } from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { Card } from '../ui/Card';
import { DashboardTrend } from '../../lib/api';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const CHART_HEIGHT = 90;
const BAR_HEIGHT = 110;

// "Personal Growth" card from the Stitch growth_dashboard design: this
// week's completions per day as bars, plus an 8-week completion-rate trend line.
export function TrendCard({ trend }: { trend: DashboardTrend }) {
  const [width, setWidth] = useState(0);
  const today = new Date().toISOString().split('T')[0];
  const maxCount = Math.max(1, ...trend.thisWeek.map((d) => d.count));

  const pad = 8;
  const points = trend.weekly.map((w, i) => {
    const x = pad + (i * (width - pad * 2)) / Math.max(1, trend.weekly.length - 1);
    const y = pad + (1 - w.rate / 100) * (CHART_HEIGHT - pad * 2);
    return { x, y };
  });

  const change = trend.changePercent;
  const changeText =
    change === null
      ? trend.thisWeekCompleted > 0
        ? `${trend.thisWeekCompleted} done this week`
        : 'No completions yet this week'
      : `${change >= 0 ? '+' : ''}${change}% vs last week`;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Personal Growth</Text>
        <View style={styles.dots}>
          <View style={[styles.dot, { opacity: 0.3 }]} />
          <View style={[styles.dot, { opacity: 0.6 }]} />
          <View style={styles.dot} />
        </View>
      </View>

      <View style={styles.bars}>
        {trend.thisWeek.map((d, i) => {
          const isToday = d.date === today;
          const h = d.count === 0 ? 10 : 18 + (d.count / maxCount) * (BAR_HEIGHT - 18);
          return (
            <View key={d.date} style={styles.barCol}>
              {d.count > 0 && <Text style={styles.barCount}>{d.count}</Text>}
              <View style={[styles.bar, { height: h, backgroundColor: isToday ? Colors.purple : Colors.surfaceContainerHigh }]} />
              <Text style={[styles.barLabel, isToday && styles.barLabelToday]}>{DAY_LETTERS[i]}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.subTitle}>Completion rate · last 8 weeks</Text>
      <View style={styles.chart} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={CHART_HEIGHT}>
            {[0.5].map((f) => (
              <Line key={f} x1={0} x2={width} y1={CHART_HEIGHT * f} y2={CHART_HEIGHT * f} stroke={Colors.outlineVariant} strokeDasharray="4 4" strokeWidth={1} />
            ))}
            <Polyline
              points={points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={Colors.purple}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 5 : 3} fill={i === points.length - 1 ? Colors.orange : Colors.purple} />
            ))}
          </Svg>
        )}
      </View>
      <View style={styles.chartAxis}>
        <Text style={styles.axisText}>8 wks ago</Text>
        <Text style={styles.axisText}>This week {trend.weekly[trend.weekly.length - 1]?.rate ?? 0}%</Text>
      </View>

      <View style={styles.insight}>
        <Text style={styles.insightText}>
          <Text style={styles.insightLabel}>Trend: </Text>
          <Text style={[styles.insightChange, change !== null && change < 0 && { color: Colors.error }]}>{changeText}</Text>
        </Text>
        <Text style={styles.insightSub}>
          {trend.peakDay
            ? `You are peaking on ${trend.peakDay}. Schedule your high-impact work then.`
            : 'Complete a few tasks and your peak day will show up here.'}
        </Text>
      </View>
    </Card>
  );
}

// Free-plan placeholder: a faded sample chart behind an upgrade prompt.
export function LockedTrendCard({ onUpgrade }: { onUpgrade: () => void }) {
  const sample = [3, 5, 4, 7, 6, 2, 4];
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Personal Growth</Text>
      <View style={styles.lockedArea}>
        <View style={[styles.bars, styles.lockedBars]}>
          {sample.map((v, i) => (
            <View key={i} style={styles.barCol}>
              <View style={[styles.bar, { height: v * 14, backgroundColor: i === 3 ? Colors.purple : Colors.surfaceContainerHigh }]} />
              <Text style={styles.barLabel}>{DAY_LETTERS[i]}</Text>
            </View>
          ))}
        </View>
        <View style={styles.lockOverlay}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.lockTitle}>See your growth trends</Text>
          <Text style={styles.lockSub}>Weekly trend lines, your peak day and week-over-week change are part of Pro.</Text>
          <TouchableOpacity style={styles.lockBtn} onPress={onUpgrade}>
            <Text style={styles.lockBtnText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  lockedArea: { marginTop: Spacing.md, minHeight: 230, justifyContent: 'flex-end' },
  lockedBars: { opacity: 0.2 },
  lockOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },
  lockIcon: { fontSize: 28, marginBottom: Spacing.xs },
  lockTitle: { fontFamily: Fonts.bold, fontSize: 17, color: Colors.text.primary },
  lockSub: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  lockBtn: { backgroundColor: Colors.purple, borderRadius: Radius.full, paddingVertical: 10, paddingHorizontal: Spacing.lg, marginTop: Spacing.md },
  lockBtnText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.white },
  card: { padding: Spacing.lg, marginBottom: Spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  title: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.text.primary },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.purple },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: BAR_HEIGHT + 36 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '62%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barCount: { fontFamily: Fonts.medium, fontSize: 10, color: Colors.text.muted, marginBottom: 2 },
  barLabel: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.text.muted, marginTop: 6 },
  barLabelToday: { fontFamily: Fonts.semiBold, color: Colors.purple },
  subTitle: { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.onSurfaceVariant, letterSpacing: 0.5, marginTop: Spacing.lg, marginBottom: Spacing.xs },
  chart: { height: CHART_HEIGHT },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  axisText: { fontFamily: Fonts.regular, fontSize: 10, color: Colors.text.muted },
  insight: { backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.md },
  insightText: { fontSize: 13 },
  insightLabel: { fontFamily: Fonts.semiBold, color: Colors.text.primary },
  insightChange: { fontFamily: Fonts.semiBold, color: Colors.purple },
  insightSub: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.secondary, marginTop: 2, lineHeight: 17 },
});
