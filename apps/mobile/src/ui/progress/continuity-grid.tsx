import { StyleSheet, Text, View } from 'react-native';

import type { ContinuityCell, ContinuityKind, ContinuityView } from '@/domain/progress/continuity';
import { Card, T } from '@/ui/components';
import { formatDate, WEEKDAY_SHORT } from '@/ui/labels';
import { C, MIN_TOUCH, S } from '@/ui/theme';

import { CONTINUITY_LABELS, CONTINUITY_MARKERS, continuitySummaryText } from './progress-labels';

/** Training and planned recovery share the same visual weight (solid fill, same colour family). */
const CELL_STYLE: Record<ContinuityKind, { bg: string; fg: string; border: string; dashed?: boolean }> = {
  training: { bg: C.success, fg: C.bg, border: C.success },
  recovery: { bg: C.recovery, fg: C.bg, border: C.recovery },
  'illness-recovery': { bg: C.violet, fg: C.bg, border: C.violet },
  'not-completed': { bg: C.surfaceRaised, fg: C.textMuted, border: C.border },
  'no-record': { bg: 'transparent', fg: C.textMuted, border: C.border, dashed: true },
  'today-open': { bg: C.surfaceRaised, fg: C.text, border: C.accent },
  future: { bg: 'transparent', fg: C.textMuted, border: 'transparent' },
};

const LEGEND: ContinuityKind[] = ['training', 'recovery', 'illness-recovery', 'not-completed', 'no-record', 'today-open'];

function Cell({ cell }: { cell: ContinuityCell }) {
  const st = CELL_STYLE[cell.kind];
  const day = Number(cell.date.slice(8, 10));
  const label = `${formatDate(cell.date)}: ${cell.isToday && cell.kind !== 'today-open' ? 'bugün, ' : ''}${CONTINUITY_LABELS[cell.kind]}`;
  return (
    <View
      testID="continuity-day"
      accessible
      accessibilityLabel={label}
      style={[
        styles.cell,
        { backgroundColor: st.bg, borderColor: cell.isToday ? C.accent : st.border, borderStyle: st.dashed ? 'dashed' : 'solid' },
        cell.isToday && styles.today,
      ]}>
      <Text style={[styles.dayNum, { color: st.fg }]} maxFontSizeMultiplier={1.4}>
        {day}
      </Text>
      {CONTINUITY_MARKERS[cell.kind] !== '' && (
        <Text style={[styles.marker, { color: st.fg }]} maxFontSizeMultiplier={1.4}>
          {CONTINUITY_MARKERS[cell.kind]}
        </Text>
      )}
    </View>
  );
}

export function ContinuityGrid({ view }: { view: ContinuityView }) {
  const slots: (ContinuityCell | null)[] = [...Array.from({ length: view.leadingBlanks }, () => null), ...view.cells];
  const rows: (ContinuityCell | null)[][] = [];
  for (let i = 0; i < slots.length; i += 7) rows.push(slots.slice(i, i + 7));
  const last = rows[rows.length - 1];
  while (last && last.length < 7) last.push(null);
  return (
    <View style={{ gap: S.md }}>
      <Text style={T.h2} accessibilityRole="header">
        Süreklilik
      </Text>
      <Card>
        <Text style={T.body} testID="continuity-summary">
          {continuitySummaryText(view.summary)}
        </Text>
        <Text style={T.muted}>
          Planlı toparlanma da antrenman kadar değerlidir: ana görev ödülü aynıdır. Boş günler borç oluşturmaz, telafi
          gerekmez.
        </Text>
        <View style={{ gap: S.xs }}>
          <View style={styles.row} importantForAccessibility="no-hide-descendants">
            {WEEKDAY_SHORT.map((w) => (
              <Text key={w} style={styles.weekday} maxFontSizeMultiplier={1.4}>
                {w}
              </Text>
            ))}
          </View>
          {rows.map((r, i) => (
            <View key={i} style={styles.row}>
              {r.map((c, j) => (c ? <Cell key={c.date} cell={c} /> : <View key={`b${j}`} style={styles.blank} />))}
            </View>
          ))}
        </View>
        <View style={{ gap: S.xs }} accessibilityLabel="Açıklama">
          <Text style={T.label}>Açıklama</Text>
          {LEGEND.map((k) => (
            <View key={k} style={styles.legendRow}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: CELL_STYLE[k].bg, borderColor: CELL_STYLE[k].border, borderStyle: CELL_STYLE[k].dashed ? 'dashed' : 'solid' },
                ]}>
                <Text style={[styles.marker, { color: CELL_STYLE[k].fg }]} maxFontSizeMultiplier={1.4}>
                  {CONTINUITY_MARKERS[k]}
                </Text>
              </View>
              <Text style={[T.muted, { flex: 1 }]}>{CONTINUITY_LABELS[k]}</Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: S.xs },
  weekday: { flex: 1, textAlign: 'center', color: C.textMuted, fontSize: 12, fontWeight: '600' },
  cell: {
    flex: 1,
    minHeight: MIN_TOUCH,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  today: { borderWidth: 2 },
  blank: { flex: 1, minHeight: MIN_TOUCH },
  dayNum: { fontSize: 13, fontWeight: '700' },
  marker: { fontSize: 11 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  swatch: { width: 24, minHeight: 24, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
