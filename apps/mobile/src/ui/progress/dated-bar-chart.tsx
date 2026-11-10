/**
 * Minimal View-based dated bar chart (no chart dependency). Bars start at zero
 * so heights are honest. The chart is one accessible element with a summary
 * label; callers always render a text table of the same values next to it.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { C, MIN_TOUCH, S } from '@/ui/theme';

import { shortDate } from './progress-labels';

export interface DatedBar {
  date: string;
  value: number;
  /** Text above the bar, e.g. "62,5". */
  valueLabel: string;
}

const PLOT_HEIGHT = 120;

export function DatedBarChart({
  bars,
  a11yLabel,
  color = C.accent,
  testID,
}: {
  bars: DatedBar[];
  a11yLabel: string;
  color?: string;
  testID?: string;
}) {
  const max = Math.max(0, ...bars.map((b) => b.value));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={a11yLabel} testID={testID}>
      <ScrollView horizontal showsHorizontalScrollIndicator={bars.length > 6} contentContainerStyle={styles.scroll}>
        {bars.map((b, i) => {
          const h = max > 0 ? Math.max(b.value > 0 ? 3 : 0, Math.round((b.value / max) * PLOT_HEIGHT)) : 0;
          const latest = i === bars.length - 1;
          return (
            <View key={`${b.date}-${i}`} style={styles.column} importantForAccessibility="no-hide-descendants">
              <Text style={[styles.value, latest && styles.valueLatest]} maxFontSizeMultiplier={1.6}>
                {b.valueLabel}
              </Text>
              <View style={styles.plot}>
                <View style={[styles.bar, { height: h, backgroundColor: color, opacity: latest ? 1 : 0.7 }]} />
              </View>
              <Text style={styles.date} maxFontSizeMultiplier={1.6}>
                {shortDate(b.date)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexDirection: 'row', alignItems: 'flex-end', gap: S.sm, paddingVertical: S.xs, minWidth: '100%' },
  column: { minWidth: MIN_TOUCH, alignItems: 'center', gap: S.xs },
  plot: { height: PLOT_HEIGHT, width: 28, justifyContent: 'flex-end', borderBottomWidth: 1, borderBottomColor: C.border },
  bar: { width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  value: { color: C.textMuted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  valueLatest: { color: C.text },
  date: { color: C.textMuted, fontSize: 12, textAlign: 'center' },
});
