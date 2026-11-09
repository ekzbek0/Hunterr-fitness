import { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';

import type { SetLog } from '@/data/types';
import { exerciseById } from '@/domain/training/catalog';
import type { LoadTarget } from '@/domain/training/program';
import { formatRest, REST_PRESETS_S, restRemainingSeconds } from '@/domain/training/rest';
import { addDays } from '@/domain/training/schedule';
import type { PlannedSession } from '@/domain/training/schedule';
import { parseDecimal, type LoadUnit, type SetInput, type SetKind } from '@/domain/training/workout';
import type { ActiveWorkout } from '@/services/avci-service';
import { Button, Card, Chip, Field, T } from '@/ui/components';
import { exerciseName, formatDate, LOAD_CONVENTION_LABELS, loadText, prescriptionText, WEEKDAY_SHORT } from '@/ui/labels';
import { C } from '@/ui/theme';

const STATE_LABELS: Record<PlannedSession['state'], string> = {
  planned: 'Planlı',
  'in-progress': 'Devam ediyor',
  done: 'Tamamlandı',
  missed: 'Kaçırıldı (borç yok)',
};

export function WeekView({
  week,
  weekStart,
  today,
  activeSlotId,
  onStart,
  onMove,
}: {
  week: PlannedSession[];
  weekStart: string;
  today: string;
  activeSlotId: string | null;
  onStart: (slotId: string) => void;
  onMove: (slotId: string, toDate: string) => void;
}) {
  const [moving, setMoving] = useState<string | null>(null);
  const occupied = new Set(week.map((w) => w.date));
  return (
    <Card>
      <Text style={T.h3}>Bu hafta</Text>
      {week.map((w) => {
        const canMove = w.state === 'planned' || w.state === 'missed';
        const targets = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter(
          (d) => d >= today && d !== w.date && !occupied.has(d),
        );
        const accent = w.state === 'done' ? C.success : w.state === 'missed' ? C.textMuted : w.date === today ? C.accent : C.border;
        return (
          <View key={w.slotId} style={{ gap: 6, borderLeftWidth: 3, borderLeftColor: accent, paddingLeft: 10 }} testID="week-row">
            <Text style={T.body}>
              {formatDate(w.date)} · {w.title}
            </Text>
            <Text style={T.muted}>
              {STATE_LABELS[w.state]}
              {w.moved ? ` · ${formatDate(w.plannedDate)} gününden taşındı` : ''}
            </Text>
            <View style={T.row}>
              {w.date === today && w.state === 'planned' && !activeSlotId && (
                <Button label={`Antrenmana başla: ${w.title}`} onPress={() => onStart(w.slotId)} />
              )}
              {canMove && targets.length > 0 && (
                <Button label="Taşı" variant="secondary" onPress={() => setMoving(moving === w.slotId ? null : w.slotId)} />
              )}
            </View>
            {moving === w.slotId && (
              <View style={T.row} accessibilityLabel={`${w.title} için yeni gün`}>
                {targets.map((d) => (
                  <Chip key={d} label={`${WEEKDAY_SHORT[(new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7]} ${d.slice(8)}`}
                    selected={false}
                    onPress={() => {
                      setMoving(null);
                      onMove(w.slotId, d);
                    }} />
                ))}
              </View>
            )}
          </View>
        );
      })}
      {week.length === 0 && <Text style={T.muted}>Bu hafta planlı antrenman yok.</Text>}
    </Card>
  );
}

const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });

function setText(s: SetLog): string {
  const conv = exerciseById(s.exerciseId)?.loadConvention ?? s.loadConvention;
  const load =
    conv === 'band'
      ? 'lastik direnci'
      : conv === 'bodyweight' && s.load === 0
        ? 'vücut ağırlığı'
        : `${fmt(s.load)} ${s.unit} (${LOAD_CONVENTION_LABELS[s.loadConvention]})`;
  if (s.kind === 'warmup') return `${s.reps} tekrar × ${load}`;
  return `${s.reps} tekrar × ${load} · ${s.rir === null ? 'RIR girilmedi' : `RIR ${s.rir}`}`;
}

function SetForm({
  exerciseId,
  last,
  target,
  disabled,
  onSave,
}: {
  exerciseId: string;
  last: SetLog | undefined;
  /** Accepted target load from the plan, used to pre-fill the first set only. */
  target: LoadTarget | null;
  disabled: boolean;
  onSave: (input: SetInput) => Promise<boolean>;
}) {
  const ex = exerciseById(exerciseId);
  const band = ex?.loadConvention === 'band';
  const [kind, setKind] = useState<SetKind>('work');
  const [reps, setReps] = useState(last ? String(last.reps) : '');
  const [load, setLoad] = useState(
    band
      ? '0'
      : last
        ? fmt(last.load).replace(/\./g, '')
        : target
          ? fmt(target.value).replace(/\./g, '')
          : ex?.loadConvention === 'bodyweight'
            ? '0'
            : '',
  );
  const [unit, setUnit] = useState<LoadUnit>(last?.unit ?? target?.unit ?? 'kg');
  const [rir, setRir] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const name = exerciseName(exerciseId);

  const save = async () => {
    const r = parseDecimal(reps);
    const l = parseDecimal(load);
    if (r === null || !Number.isInteger(r)) return setError('Tekrar sayısını tam sayı olarak gir.');
    if (l === null || Number.isNaN(l)) return setError('Ağırlığı sayı olarak gir (ör. 22,5). Ek yük yoksa 0.');
    setError(null);
    if (await onSave({ exerciseId, kind, reps: r, load: l, unit, rir: kind === 'work' ? rir : null })) setRir(null);
  };

  return (
    <View style={{ gap: 8 }} accessibilityLabel={`${name} set girişi`}>
      <View style={T.row} accessibilityRole="radiogroup" accessibilityLabel={`${name} set türü`}>
        <Chip label="Çalışma seti" selected={kind === 'work'} onPress={() => setKind('work')} />
        <Chip label="Isınma seti" selected={kind === 'warmup'} onPress={() => setKind('warmup')} />
      </View>
      <View style={[T.row, { alignItems: 'flex-end' }]}>
        <Field label="Tekrar" a11yLabel={`${name} tekrar`} value={reps} onChangeText={setReps} numeric width={110} placeholder="ör. 10" />
        {!band && (
          <>
            <Field label="Ağırlık" a11yLabel={`${name} ağırlık`} value={load} onChangeText={setLoad} numeric width={120} placeholder="ör. 22,5" />
            <View style={T.row} accessibilityRole="radiogroup" accessibilityLabel={`${name} birim`}>
              <Chip label="kg" selected={unit === 'kg'} onPress={() => setUnit('kg')} />
              <Chip label="lb" selected={unit === 'lb'} onPress={() => setUnit('lb')} />
            </View>
          </>
        )}
      </View>
      {ex && (
        <Text style={T.muted}>
          {band
            ? 'Lastik direnci kilogram olarak kaydedilmez; tekrar ve RIR yeterli.'
            : `Ağırlık: ${LOAD_CONVENTION_LABELS[ex.loadConvention]}.`}
        </Text>
      )}
      {kind === 'work' && (
        <View style={{ gap: 4 }}>
          <Text style={T.label}>RIR (isteğe bağlı: kaç tekrar daha yapabilirdin?)</Text>
          <View style={T.row} accessibilityRole="radiogroup" accessibilityLabel={`${name} RIR`}>
            {[null, 0, 1, 2, 3, 4, 5].map((v) => (
              <Chip key={String(v)} label={v === null ? 'Belirtme' : String(v)} selected={rir === v} onPress={() => setRir(v)} />
            ))}
          </View>
        </View>
      )}
      {error && <Text style={[T.body, { color: C.danger }]}>{error}</Text>}
      <Button label={kind === 'work' ? `${name}: çalışma setini kaydet` : `${name}: ısınma setini kaydet`} disabled={disabled} onPress={save} />
    </View>
  );
}

/**
 * Rest countdown derived from the stored start timestamp: correct after the
 * app was backgrounded, killed or reloaded. Ticks once per second, no animation.
 */
export function RestTimer({
  startedAt,
  durationS,
  busy,
  onStart,
  onClear,
}: {
  startedAt: string | null;
  durationS: number | null;
  busy: boolean;
  onStart: (seconds: number) => void;
  onClear: () => void;
}) {
  const timer = startedAt && durationS ? { startedAt, durationS } : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!timer) return;
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && setNow(Date.now()));
    return () => {
      clearTimeout(first);
      clearInterval(id);
      sub.remove();
    };
  }, [timer?.startedAt, timer?.durationS]); // eslint-disable-line react-hooks/exhaustive-deps
  const remaining = restRemainingSeconds(timer, now);
  return (
    <Card accent={C.recovery}>
      <Text style={T.h3}>Dinlenme</Text>
      {timer ? (
        <Text
          style={[T.h2, { color: remaining === 0 ? C.success : C.text }]}
          testID="rest-remaining"
          accessibilityLiveRegion={remaining === 0 ? 'polite' : 'none'}>
          {remaining === 0 ? 'Dinlenme bitti' : `Kalan ${formatRest(remaining)}`}
        </Text>
      ) : (
        <Text style={T.muted}>Sayaç kapalı. Süre seç; kalan süre başlangıç zamanından hesaplanır.</Text>
      )}
      <View style={T.row}>
        {REST_PRESETS_S.map((s) => (
          <Button key={s} label={`${formatRest(s)} dinlen`} variant="secondary" disabled={busy} onPress={() => onStart(s)} />
        ))}
        {timer && <Button label="Sayacı kapat" variant="secondary" disabled={busy} onPress={onClear} />}
      </View>
    </Card>
  );
}

/**
 * Active workout. Every set is persisted when saved, so closing the app keeps
 * the session; reopening shows it here to resume.
 */
export function WorkoutLogger({
  active,
  lastPerformance,
  busy,
  onLog,
  onDelete,
  onFinish,
  onAbandon,
  onStartRest,
  onClearRest,
  notices,
}: {
  onStartRest: (seconds: number) => void;
  onClearRest: () => void;
  /** Safety/context notices shown above the log (illness, joint pain, previous day). */
  notices: string[];
  active: ActiveWorkout;
  lastPerformance: Record<string, SetLog[]>;
  busy: boolean;
  onLog: (input: SetInput) => Promise<boolean>;
  onDelete: (setId: string) => void;
  onFinish: () => void;
  onAbandon: () => void;
}) {
  const { session, sets, summary } = active;
  const [howTo, setHowTo] = useState<string | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  return (
    <View style={{ gap: 16 }}>
      <Card accent={C.violet}>
        <Text style={T.h2}>{session.title}</Text>
        <Text style={T.muted}>
          Başlangıç {new Date(session.startedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} · Kayıtlar
          her sette cihaza yazılır; uygulamayı kapatsan da buradan devam edersin.
        </Text>
        <Text style={T.body} testID="workout-summary">
          Çalışma seti: {summary.workSets} · Isınma seti: {summary.warmupSets}
        </Text>
      </Card>
      <RestTimer
        startedAt={session.restStartedAt}
        durationS={session.restDurationS}
        busy={busy}
        onStart={onStartRest}
        onClear={onClearRest}
      />
      {notices.map((n) => (
        <Card key={n} accent={C.warning}>
          <Text style={T.body}>{n}</Text>
        </Card>
      ))}
      {session.exercises.map((p) => {
        const ex = exerciseById(p.exerciseId);
        const logged = sets.filter((s) => s.exerciseId === p.exerciseId);
        const work = logged.filter((s) => s.kind === 'work').length;
        const last = lastPerformance[p.exerciseId];
        return (
          <Card key={p.exerciseId}>
            <Text style={T.h3}>{exerciseName(p.exerciseId)}</Text>
            <Text style={T.muted}>
              Plan: {prescriptionText(p)} · yapılan çalışma seti {work}/{p.sets}
            </Text>
            {p.targetLoad && ex && (
              <Text style={T.body} testID="target-load">
                Kabul ettiğin hedef: {loadText(p.targetLoad.value, p.targetLoad.unit, ex.loadConvention)}
              </Text>
            )}
            {last && last.length > 0 && (
              <Text style={T.muted}>Son antrenman: {last.map((s) => `${s.reps}×${fmt(s.load)} ${s.unit}`).join(', ')}</Text>
            )}
            <Button label={howTo === p.exerciseId ? 'Nasıl yapılır (gizle)' : 'Nasıl yapılır'} variant="secondary"
              onPress={() => setHowTo(howTo === p.exerciseId ? null : p.exerciseId)} />
            {howTo === p.exerciseId && ex && <Text style={T.body}>{ex.howTo}</Text>}
            {logged.map((s, i) => (
              <View key={s.id} style={[T.row, { justifyContent: 'space-between' }]} testID="set-row">
                <Text style={[T.body, { flex: 1, minWidth: 180, color: s.kind === 'warmup' ? C.textMuted : C.text }]}>
                  {i + 1}. {s.kind === 'warmup' ? 'Isınma' : 'Çalışma'} · {setText(s)}
                </Text>
                <Button label="Sil" variant="secondary" disabled={busy} onPress={() => onDelete(s.id)} hint="Bu seti sil" />
              </View>
            ))}
            <SetForm exerciseId={p.exerciseId} last={logged[logged.length - 1]} target={p.targetLoad ?? null} disabled={busy}
              onSave={onLog} />
          </Card>
        );
      })}
      <Text style={T.muted}>
        Plan dışı ek setler kaydedilir ama ek XP vermez. Antrenmanı bitirmek, başladığı günün ana görevini bir kez tamamlar.
      </Text>
      <View style={T.row}>
        <Button label="Antrenmanı bitir" disabled={busy} onPress={onFinish} />
        {!confirmAbandon ? (
          <Button label="Antrenmanı bırak" variant="secondary" disabled={busy} onPress={() => setConfirmAbandon(true)} />
        ) : (
          <Button label="Evet, bırak (setler saklanır)" variant="secondary" disabled={busy} onPress={onAbandon} />
        )}
      </View>
    </View>
  );
}
