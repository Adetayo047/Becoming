import { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ApiYearPlan, ApiYearPlanGoal, PlanKind } from '../../lib/api';
import { Card } from '../ui/Card';
import { Colors, Fonts, Spacing, Radius, CATEGORY_META, Category } from '../../constants/theme';
import { SHORT_MONTHS, addDays, dayLabel, monthLabel, mondayOf, sumTaskDays, weekRangeLabel, weeksOfMonth } from './dates';

type Item = { id: string; title: string; status: 'pending' | 'completed' };
export type RenderList = (kind: PlanKind, goalId: string, period: string, items: Item[], bullet?: boolean) => ReactNode;

function categoryEmoji(category: string) {
  return CATEGORY_META[category as Category]?.emoji ?? '🎯';
}

function countLabel(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

// Read-only reminder of the level above, so each level is planned as a
// breakdown of the one before it.
function Context({ icon, items, empty }: { icon: string; items: Item[]; empty: string }) {
  if (items.length === 0) return <Text style={styles.contextEmpty}>{empty}</Text>;
  return (
    <View style={styles.context}>
      {items.map((t) => (
        <Text key={t.id} style={styles.contextText} numberOfLines={2}>{icon} {t.title}</Text>
      ))}
    </View>
  );
}

function PeriodRow({ title, meta, sub, current, past, onPress }: { title: string; meta: string; sub?: string; current: boolean; past: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.row, current && styles.rowCurrent, past && styles.past]} onPress={onPress}>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, current && styles.rowTitleCurrent]}>{title}</Text>
        <Text style={styles.rowMeta}>{meta}</Text>
      </View>
      {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function GoalBlock({ goal, children }: { goal: ApiYearPlanGoal; children: ReactNode }) {
  return (
    <View style={styles.goalBlock}>
      <Text style={styles.goalName} numberOfLines={2}>{categoryEmoji(goal.category)} {goal.title}</Text>
      {children}
    </View>
  );
}

export function YearView({ plan, today, renderList, onOpenMonth }: { plan: ApiYearPlan; today: string; renderList: RenderList; onOpenMonth: (month: string) => void }) {
  const thisMonth = today.slice(0, 7);
  return (
    <>
      <Card style={{ ...styles.levelCard, borderLeftColor: Colors.purpleDark }}>
        <View style={styles.levelHeader}>
          <Text style={styles.levelLabel}>🎯  YEARLY OUTCOMES</Text>
          <View style={[styles.badge, { backgroundColor: Colors.purpleDark }]}><Text style={styles.badgeText}>{plan.year}</Text></View>
        </View>
        <Text style={styles.prompt}>What will be true by 31 December? Set 1–3 outcomes for each goal.</Text>
        {plan.goals.map((g) => (
          <GoalBlock key={g.id} goal={g}>{renderList('yearly', g.id, String(plan.year), g.yearlyTargets)}</GoalBlock>
        ))}
      </Card>

      <Text style={styles.sectionTitle}>Break it into months</Text>
      <View style={styles.grid}>
        {SHORT_MONTHS.map((name, i) => {
          const month = `${plan.year}-${String(i + 1).padStart(2, '0')}`;
          const focuses = plan.goals.reduce((n, g) => n + g.monthlyTargets.filter((t) => t.month === month).length, 0);
          const tasks = sumTaskDays(plan.taskDays, (d) => d.startsWith(month));
          return (
            <TouchableOpacity
              key={month}
              style={[styles.tile, month === thisMonth && styles.tileCurrent, month < thisMonth && styles.past]}
              onPress={() => onOpenMonth(month)}
            >
              <Text style={[styles.tileName, month === thisMonth && styles.tileNameCurrent]}>{name}</Text>
              <Text style={[styles.tileMeta, focuses > 0 && styles.tileMetaSet]}>{focuses > 0 ? countLabel(focuses, 'focus', 'focuses') : 'Not planned'}</Text>
              {tasks.total > 0 && <Text style={styles.tileMeta}>{tasks.done}/{tasks.total} done</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

export function MonthView({ plan, month, today, renderList, onOpenWeek }: { plan: ApiYearPlan; month: string; today: string; renderList: RenderList; onOpenWeek: (monday: string) => void }) {
  const thisWeek = mondayOf(today);
  return (
    <>
      <Card style={{ ...styles.levelCard, borderLeftColor: Colors.purple }}>
        <View style={styles.levelHeader}>
          <Text style={styles.levelLabel}>📅  MONTHLY FOCUS</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>{monthLabel(month)}</Text></View>
        </View>
        {plan.goals.map((g) => (
          <GoalBlock key={g.id} goal={g}>
            <Context icon="🎯" items={g.yearlyTargets} empty={`No ${plan.year} outcome yet — set one in Year`} />
            {renderList('monthly', g.id, month, g.monthlyTargets.filter((t) => t.month === month))}
          </GoalBlock>
        ))}
      </Card>

      <Text style={styles.sectionTitle}>Break it into weeks</Text>
      {weeksOfMonth(month).map((monday) => {
        const milestones = plan.goals.reduce((n, g) => n + g.weeklyFocuses.filter((w) => w.weekStart === monday).length, 0);
        const end = addDays(monday, 6);
        const tasks = sumTaskDays(plan.taskDays, (d) => d >= monday && d <= end);
        return (
          <PeriodRow
            key={monday}
            title={weekRangeLabel(monday)}
            meta={milestones > 0 ? countLabel(milestones, 'milestone', 'milestones') : 'Not planned'}
            sub={tasks.total > 0 ? `${tasks.done}/${tasks.total} done` : undefined}
            current={monday === thisWeek}
            past={end < today}
            onPress={() => onOpenWeek(monday)}
          />
        );
      })}
    </>
  );
}

export function WeekView({ plan, weekStart, today, renderList, onOpenDay }: { plan: ApiYearPlan; weekStart: string; today: string; renderList: RenderList; onOpenDay: (day: string) => void }) {
  const end = addDays(weekStart, 6);
  const months = [weekStart.slice(0, 7), end.slice(0, 7)];
  return (
    <>
      <Card style={{ ...styles.levelCard, borderLeftColor: Colors.orange }}>
        <View style={styles.levelHeader}>
          <Text style={styles.levelLabel}>🚩  WEEKLY MILESTONES</Text>
          <Text style={styles.weekText}>{weekRangeLabel(weekStart)}</Text>
        </View>
        {plan.goals.map((g) => (
          <GoalBlock key={g.id} goal={g}>
            <Context icon="📅" items={g.monthlyTargets.filter((t) => months.includes(t.month))} empty="No monthly focus yet — set one in Month" />
            {renderList('weekly', g.id, weekStart, g.weeklyFocuses.filter((w) => w.weekStart === weekStart), true)}
          </GoalBlock>
        ))}
      </Card>

      <Text style={styles.sectionTitle}>Break it into days</Text>
      {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day) => {
        const c = plan.taskDays[day];
        return (
          <PeriodRow
            key={day}
            title={dayLabel(day)}
            meta={c ? `${countLabel(c.total, 'action', 'actions')} · ${c.done} done` : 'No actions planned'}
            current={day === today}
            past={day < today}
            onPress={() => onOpenDay(day)}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  levelCard: { padding: Spacing.lg, marginBottom: Spacing.md, borderLeftWidth: 4 },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  levelLabel: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.onSurfaceVariant, letterSpacing: 0.8 },
  badge: { backgroundColor: Colors.purple, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.white },
  weekText: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.orange },
  prompt: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.text.secondary, lineHeight: 18 },
  goalBlock: { marginTop: Spacing.md },
  goalName: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.text.primary, marginBottom: Spacing.xs },
  context: { backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6, marginBottom: 4 },
  contextText: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.secondary, lineHeight: 18 },
  contextEmpty: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted, fontStyle: 'italic', marginBottom: 4 },
  sectionTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text.primary, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: Spacing.md },
  tile: { width: '31.5%', backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm, minHeight: 72 },
  tileCurrent: { borderColor: Colors.purple, borderWidth: 2, backgroundColor: Colors.surfaceContainerLow },
  tileName: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.text.primary, marginBottom: 2 },
  tileNameCurrent: { color: Colors.purple },
  tileMeta: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.text.muted },
  tileMetaSet: { fontFamily: Fonts.medium, color: Colors.purple },
  past: { opacity: 0.55 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.sm + 4, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  rowCurrent: { borderColor: Colors.purple, borderWidth: 2, backgroundColor: Colors.surfaceContainerLow },
  rowBody: { flex: 1 },
  rowTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.text.primary },
  rowTitleCurrent: { color: Colors.purple },
  rowMeta: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.text.muted, marginTop: 2 },
  rowSub: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.purple, marginRight: Spacing.sm },
  chevron: { fontSize: 22, color: Colors.text.muted },
});
