import { useState } from 'react';
import { Text, View } from 'react-native';

import { alternativesFor, EXERCISES, exerciseById, isAvailable } from '@/domain/training/catalog';
import {
  LIMITS,
  ProgramError,
  validateProgram,
  weeklyExposure,
  type PrescribedExercise,
  type Program,
  type ProgramChange,
} from '@/domain/training/program';
import type { TrainingProfileFacts, Weekday } from '@/domain/training/profile';
import type { ScheduleConflict } from '@/domain/training/schedule';
import { Button, Card, Chip, Field, T } from '@/ui/components';
import {
  describeChange,
  describeConflict,
  exerciseName,
  PROGRAM_ERROR_LABELS,
  prescriptionText,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
} from '@/ui/labels';
import { C } from '@/ui/theme';

export function ExposureNote({ program }: { program: Program }) {
  const e = weeklyExposure(program);
  return (
    <Text style={T.muted} testID="exposure">
      Haftalık çalışma sıklığı: itiş kasları {e.push}, çekiş kasları {e.pull}, bacaklar {e.legs} gün.
      {e.legs === 1 ? ' Bacaklar haftada yalnız bir kez çalışıyor; iki kez istersen günleri düzenleyebilirsin.' : ''}
    </Text>
  );
}

export function ProgramSummary({ program }: { program: Program }) {
  return (
    <View style={{ gap: 12 }}>
      {program.days.map((d) => (
        <Card key={d.id}>
          <Text style={T.h3}>
            {WEEKDAY_LONG[d.weekday]} · {d.title}
          </Text>
          {d.exercises.map((e) => (
            <Text key={e.exerciseId} style={T.body}>
              • {exerciseName(e.exerciseId)} — {prescriptionText(e)}
            </Text>
          ))}
        </Card>
      ))}
    </View>
  );
}

/** Effective-week conflicts: shown explicitly; nothing is moved or deleted to resolve them. */
export function ConflictList({ conflicts }: { conflicts: ScheduleConflict[] }) {
  if (conflicts.length === 0) return null;
  return (
    <Card accent={C.danger}>
      <Text style={T.h3}>Takvim çakışması</Text>
      <View testID="conflict-list" style={{ gap: 4 }}>
        {conflicts.map((c) => (
          <Text key={c.date} style={T.body}>
            • {describeConflict(c)}
          </Text>
        ))}
      </View>
      <Text style={T.muted}>
        Bu haftaki taşınmış seanslar korunuyor; uygulama hiçbir seansı kendiliğinden taşımaz veya silmez. Taşınan seansı
        boş bir güne al ya da bu program gününü başka bir güne koy, sonra yeniden önizle.
      </Text>
    </Card>
  );
}

export function ChangeList({ changes }: { changes: ProgramChange[] }) {
  if (changes.length === 0) return <Text style={T.muted}>Mevcut programa göre değişiklik yok.</Text>;
  return (
    <View style={{ gap: 4 }} testID="change-list">
      {changes.map((c, i) => (
        <Text key={i} style={T.body}>
          • {describeChange(c)}
        </Text>
      ))}
    </View>
  );
}

/** Before/after preview of a generated proposal; nothing changes until accepted. */
export function ProposalPreview({
  program,
  changes,
  hasCurrent,
  skippedPatterns,
  onAccept,
  onCancel,
}: {
  program: Program;
  changes: ProgramChange[];
  hasCurrent: boolean;
  skippedPatterns: string[];
  onAccept: () => void;
  onCancel?: () => void;
}) {
  return (
    <View style={{ gap: 16 }}>
      <Card accent={C.accent}>
        <Text style={T.h3}>Program önerisi</Text>
        <Text style={T.muted}>
          Onayladığın bilgilere göre kurallarla oluşturuldu. Yük önerilmez: ilk antrenmanlarda rahat yaptığın ağırlığı
          kaydet. Hedef RIR 2, tükenişe gitmeden bırakmak için bir ürün varsayımıdır, tıbbi bir değer değildir.
        </Text>
        <ExposureNote program={program} />
        {skippedPatterns.length > 0 && (
          <Text style={[T.muted, { color: C.warning }]}>
            Ekipman/kısıtlar nedeniyle bazı hareket kalıpları için uygun hareket bulunamadı ve atlandı.
          </Text>
        )}
        {hasCurrent && (
          <>
            <Text style={T.label}>Mevcut programa göre değişiklikler</Text>
            <ChangeList changes={changes} />
          </>
        )}
      </Card>
      <ProgramSummary program={program} />
      <View style={T.row}>
        <Button label="Programı kabul et" onPress={onAccept} />
        {onCancel && <Button label="Vazgeç" variant="secondary" onPress={onCancel} />}
      </View>
    </View>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <View style={[T.row, { gap: 4 }]}>
      <Text style={[T.muted, { minWidth: 56 }]}>{label}</Text>
      <Button label="−" variant="secondary" disabled={value <= min} onPress={() => onChange(value - 1)} hint={`${label} azalt`} />
      <Text style={[T.body, { minWidth: 28, textAlign: 'center' }]} accessibilityLabel={`${label} ${value}`}>
        {value}
      </Text>
      <Button label="+" variant="secondary" disabled={value >= max} onPress={() => onChange(value + 1)} hint={`${label} artır`} />
    </View>
  );
}

/**
 * Editable weekly program. Edits are local until "Önizle" shows the diff and
 * the user accepts; then a new immutable plan version is written.
 */
export function ProgramEditor({
  initial,
  facts,
  onPreview,
  onAccept,
  onCancel,
}: {
  initial: Program;
  facts: TrainingProfileFacts;
  /** Service-side preview: structural diff + conflicts with this week's moves. */
  onPreview: (program: Program) => Promise<{ changes: ProgramChange[]; conflicts: ScheduleConflict[] } | string>;
  onAccept: (program: Program) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Program>(() => structuredClone(initial));
  const [preview, setPreview] = useState<{ changes: ProgramChange[]; conflicts: ScheduleConflict[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [addTo, setAddTo] = useState<string | null>(null);

  const edit = (fn: (p: Program) => void) => {
    setDraft((p) => {
      const next = structuredClone(p);
      fn(next);
      return next;
    });
    setPreview(null);
    setError(null);
  };
  const updateEx = (dayId: string, exId: string, patch: Partial<PrescribedExercise>) =>
    edit((p) => {
      const e = p.days.find((d) => d.id === dayId)!.exercises.find((x) => x.exerciseId === exId)!;
      Object.assign(e, patch);
    });

  const moveEx = (dayId: string, index: number, delta: -1 | 1) =>
    edit((p) => {
      const list = p.days.find((d) => d.id === dayId)!.exercises;
      const j = index + delta;
      if (j < 0 || j >= list.length) return;
      [list[index], list[j]] = [list[j], list[index]];
    });

  const showPreview = async () => {
    try {
      validateProgram(draft, facts);
    } catch (e) {
      setError(e instanceof ProgramError ? PROGRAM_ERROR_LABELS[e.code] : 'Program geçersiz.');
      return;
    }
    const r = await onPreview(draft);
    if (typeof r === 'string') setError(r);
    else setPreview(r);
  };

  if (preview) {
    return (
      <View style={{ gap: 16 }}>
        <Card accent={C.accent}>
          <Text style={T.h3}>Değişiklik önizlemesi</Text>
          <ChangeList changes={preview.changes} />
          <ExposureNote program={draft} />
          <Text style={T.muted}>
            Onaylarsan yeni bir program sürümü kaydedilir; önceki sürüm geçmişte kalır. Bugünün ödülü ve tamamlanan
            antrenmanlar değişmez. Başlamış bir antrenman kendi hareket sırasıyla devam eder.
          </Text>
        </Card>
        <ConflictList conflicts={preview.conflicts} />
        {error && (
          <Text style={[T.body, { color: C.danger }]} testID="editor-error">
            {error}
          </Text>
        )}
        <View style={T.row}>
          <Button label="Değişiklikleri onayla" disabled={preview.changes.length === 0 || preview.conflicts.length > 0}
            onPress={async () => setError(await onAccept(draft))} />
          <Button label="Düzenlemeye dön" variant="secondary" onPress={() => setPreview(null)} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      {draft.days.map((d) => {
        const used = new Set(draft.days.filter((x) => x.id !== d.id).map((x) => x.weekday));
        const addable = EXERCISES.filter(
          (e) => isAvailable(e, facts.equipment, facts.limitations) && !d.exercises.some((x) => x.exerciseId === e.id),
        );
        return (
          <Card key={d.id}>
            <Field label="Gün adı" value={d.title} onChangeText={(t) => edit((p) => void (p.days.find((x) => x.id === d.id)!.title = t))} />
            <Text style={T.label}>Haftanın günü</Text>
            <View style={T.row} accessibilityRole="radiogroup" accessibilityLabel={`${d.title} günü`}>
              {WEEKDAY_SHORT.map((w, i) => (
                <Chip key={w} label={w} selected={d.weekday === i}
                  onPress={() => {
                    if (used.has(i as Weekday)) {
                      setError(PROGRAM_ERROR_LABELS['duplicate-weekday']);
                      return;
                    }
                    edit((p) => void (p.days.find((x) => x.id === d.id)!.weekday = i as Weekday));
                  }} />
              ))}
            </View>
            {d.exercises.map((e, index) => {
              const key = `${d.id}:${e.exerciseId}`;
              const alts = alternativesFor(e.exerciseId, facts.equipment, facts.limitations).filter(
                (a) => !d.exercises.some((x) => x.exerciseId === a.id),
              );
              return (
                <View key={e.exerciseId} style={{ gap: 6, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 }}>
                  <View style={[T.row, { justifyContent: 'space-between' }]}>
                    <Text style={[T.body, { flex: 1, minWidth: 140 }]}>
                      {index + 1}. {exerciseName(e.exerciseId)}
                    </Text>
                    <Button label="↑" variant="secondary" disabled={index === 0}
                      hint={`${exerciseName(e.exerciseId)} yukarı taşı`} a11yLabel={`${exerciseName(e.exerciseId)} yukarı`}
                      onPress={() => moveEx(d.id, index, -1)} />
                    <Button label="↓" variant="secondary" disabled={index === d.exercises.length - 1}
                      hint={`${exerciseName(e.exerciseId)} aşağı taşı`} a11yLabel={`${exerciseName(e.exerciseId)} aşağı`}
                      onPress={() => moveEx(d.id, index, 1)} />
                  </View>
                  <Stepper label="Set" value={e.sets} min={LIMITS.setsMin} max={LIMITS.setsMax}
                    onChange={(v) => updateEx(d.id, e.exerciseId, { sets: v })} />
                  <Stepper label="Tekrar ≥" value={e.repMin} min={LIMITS.repsMin} max={e.repMax}
                    onChange={(v) => updateEx(d.id, e.exerciseId, { repMin: v })} />
                  <Stepper label="Tekrar ≤" value={e.repMax} min={e.repMin} max={LIMITS.repsMax}
                    onChange={(v) => updateEx(d.id, e.exerciseId, { repMax: v })} />
                  <View style={T.row}>
                    <Button label="Değiştir" variant="secondary" disabled={alts.length === 0}
                      onPress={() => setSwapFor(swapFor === key ? null : key)} />
                    <Button label="Çıkar" variant="secondary" disabled={d.exercises.length <= 1}
                      onPress={() => edit((p) => {
                        const day = p.days.find((x) => x.id === d.id)!;
                        day.exercises = day.exercises.filter((x) => x.exerciseId !== e.exerciseId);
                      })} />
                  </View>
                  {swapFor === key && (
                    <View style={T.row}>
                      {alts.map((a) => (
                        <Chip key={a.id} label={a.name} selected={false}
                          onPress={() => {
                            updateEx(d.id, e.exerciseId, { exerciseId: a.id });
                            setSwapFor(null);
                          }} />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
            {d.exercises.length < LIMITS.exercisesPerDayMax && (
              <Button label="Hareket ekle" variant="secondary" onPress={() => setAddTo(addTo === d.id ? null : d.id)} />
            )}
            {addTo === d.id && (
              <View style={T.row}>
                {addable.map((a) => (
                  <Chip key={a.id} label={a.name} selected={false}
                    onPress={() => {
                      const ex = exerciseById(a.id)!;
                      const iso = ['triceps', 'biceps', 'lateral-raise', 'calves', 'core'].includes(ex.pattern);
                      edit((p) => void p.days.find((x) => x.id === d.id)!.exercises.push({
                        exerciseId: a.id, sets: 2, repMin: iso ? 10 : 8, repMax: iso ? 15 : 12, targetRir: 2,
                      }));
                      setAddTo(null);
                    }} />
                ))}
              </View>
            )}
          </Card>
        );
      })}
      {error && (
        <Text style={[T.body, { color: C.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
      <View style={T.row}>
        <Button label="Önizle" onPress={showPreview} />
        <Button label="Vazgeç" variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}
