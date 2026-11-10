import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SetLog } from '@/data/types';
import type { HistoryEntry } from '@/services/progress-service';
import { Button, Card, T } from '@/ui/components';
import { exerciseName, formatDate, loadText } from '@/ui/labels';
import { C, MIN_TOUCH, S } from '@/ui/theme';

const PAGE = 10;

function setText(s: SetLog): string {
  const rir = s.rir === null ? 'RIR yok' : `RIR ${s.rir}`;
  return `${s.reps} tekrar × ${loadText(s.load, s.unit, s.loadConvention)} · ${rir}`;
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const [open, setOpen] = useState(false);
  const counts = `${entry.workSets} çalışma seti${entry.warmupSets > 0 ? ` · ${entry.warmupSets} ısınma seti` : ''}`;
  return (
    <View testID="history-row" style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${formatDate(entry.date)}, ${entry.title}, ${counts}`}
        accessibilityHint={open ? 'Set listesini gizler' : 'Hareketlere göre set listesini gösterir'}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [styles.header, pressed && { opacity: 0.8 }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={T.body}>
            <Text style={{ fontWeight: '700' }}>{entry.title}</Text>
          </Text>
          <Text style={T.muted}>{formatDate(entry.date)}</Text>
          <Text style={T.muted}>{counts}</Text>
        </View>
        <Text style={[T.body, { color: C.accent }]} importantForAccessibility="no">
          {open ? '▲' : '▼'}
        </Text>
      </Pressable>
      {open && (
        <View style={{ gap: S.sm, paddingTop: S.sm }}>
          {entry.exercises.map((e) => (
            <View key={e.exerciseId} style={{ gap: 2 }}>
              <Text style={T.h3}>{exerciseName(e.exerciseId)}</Text>
              {e.sets.map((s, i) => (
                <Text key={s.id} style={[T.body, s.kind === 'warmup' && { color: C.textMuted }]}>
                  {s.kind === 'warmup' ? 'Isınma' : `Set ${e.sets.slice(0, i + 1).filter((x) => x.kind === 'work').length}`}
                  {' · '}
                  {setText(s)}
                </Text>
              ))}
            </View>
          ))}
          {entry.warmupSets > 0 && <Text style={T.muted}>Isınma setleri çalışma seti sayısına katılmaz.</Text>}
        </View>
      )}
    </View>
  );
}

export function WorkoutHistory({ history }: { history: HistoryEntry[] }) {
  const [limit, setLimit] = useState(PAGE);
  return (
    <View style={{ gap: S.md }}>
      <Text style={T.h2} accessibilityRole="header">
        Antrenman geçmişi
      </Text>
      <Card>
        {history.length === 0 ? (
          <Text style={T.body}>Henüz tamamlanmış antrenman yok.</Text>
        ) : (
          <>
            <Text style={T.muted}>
              Yalnızca bitirilen antrenmanlar, en yenisi üstte. Yarıda bırakılan antrenmanlar geçmişte ve grafiklerde yer almaz.
            </Text>
            {history.slice(0, limit).map((h) => (
              <HistoryRow key={h.sessionId} entry={h} />
            ))}
            {history.length > limit && (
              <Button variant="secondary" label="Daha eski antrenmanlar" onPress={() => setLimit((n) => n + PAGE)} />
            )}
          </>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: S.sm },
  header: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: S.md },
});
