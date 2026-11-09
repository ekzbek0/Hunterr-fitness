import { useState } from 'react';
import { Text, View } from 'react-native';

import type { QuestSlot } from '@/data/types';
import { awardedXp, multiplierLabel, type MultiplierHalves } from '@/domain/game/economy';
import { DEFAULT_HABIT_KEYS, HABIT_CATALOG, SLOT_KEYS, type CoreResolution } from '@/domain/game/quests';
import type { CheckinInput, CoreSuggestion, TriState } from '@/domain/training/readiness';
import type { CompletionResult } from '@/services/avci-service';
import { useAvci } from '@/ui/avci-context';
import { Button, Card, Chip, Screen, StorageGate, T, XpBar } from '@/ui/components';
import { formatDate, RANK_TITLES, REASON_LABELS, RESOLUTION_LABELS } from '@/ui/labels';
import { C } from '@/ui/theme';

export default function TodayScreen() {
  return (
    <StorageGate>
      <Today />
    </StorageGate>
  );
}

function resultMessage(r: CompletionResult | unknown): string | null {
  const res = r as CompletionResult;
  if (!res || typeof res !== 'object' || !('status' in res)) return null;
  if (res.status === 'awarded') return `+${res.entry.awardedXp} XP kaydedildi.`;
  if (res.status === 'already-completed') return 'Bu görev zaten tamamlanmış; ödül bir kez verilir.';
  const reasons: Record<string, string> = {
    'day-changed': 'Gün değişti. Bugünün görevleri yüklendi.',
    'clock-frozen': 'Cihaz saati geri alınmış görünüyor. Saat düzelene kadar yeni ödül verilmez.',
    invalid: 'Girilen değerler geçersiz.',
    'no-profile': 'Önce profil oluştur.',
    'unknown-slot': 'Görev bulunamadı.',
  };
  return reasons[res.reason] ?? 'İşlem yapılamadı.';
}

function Today() {
  const { snapshot, act, error } = useAvci();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!snapshot) return null;
  if (!snapshot.profile) return <Onboarding />;

  const { today, slots, progress, rewardsFrozen } = snapshot;
  if (!today) return null;
  const mult = today.multiplierHalves as MultiplierHalves;
  const slot = (key: string) => slots.find((s) => s.slotKey === key) as QuestSlot;

  const run = async (fn: Parameters<typeof act>[0]) => {
    if (busy) return;
    setBusy(true);
    try {
      setMessage(resultMessage(await act(fn)));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Bugün">
      <Text style={T.muted}>
        {formatDate(today.localDate)} · Gün {today.sequence} · XP çarpanı {multiplierLabel(mult)}
      </Text>

      <Card accent={C.violet}>
        <View style={[T.row, { justifyContent: 'space-between' }]}>
          <Text style={T.h2} testID="level">
            Seviye {progress.level} · Rütbe {progress.rank}
          </Text>
          <Text style={T.muted}>{RANK_TITLES[progress.rank]}</Text>
        </View>
        <XpBar fraction={progress.fraction} />
        <Text style={T.muted} testID="xp-total">
          Toplam {progress.totalXp} XP
          {progress.nextLevelXp !== null ? ` · sonraki seviye ${progress.nextLevelXp} XP` : ''} · bugün {snapshot.todayXp} XP
        </Text>
      </Card>

      {rewardsFrozen && (
        <Card accent={C.warning}>
          <Text style={T.body}>
            Cihaz saati son kayıttan daha eski görünüyor. Kayıtların korunuyor; saat düzelene kadar yeni ödül verilmez.
          </Text>
        </Card>
      )}
      {message && (
        <Text style={[T.body, { color: C.accent }]} accessibilityLiveRegion="polite" testID="message">
          {message}
        </Text>
      )}
      {error && <Text style={[T.body, { color: C.danger }]}>{error}</Text>}

      <CheckinCard
        slot={slot(SLOT_KEYS.checkin)}
        xp={awardedXp(slot(SLOT_KEYS.checkin).baseXp, mult)}
        initial={snapshot.checkin}
        disabled={busy}
        onSubmit={(input) => run((s) => s.recordCheckin(today.id, input))}
      />

      <CoreCard
        slot={slot(SLOT_KEYS.core)}
        xp={awardedXp(slot(SLOT_KEYS.core).baseXp, mult)}
        suggestion={snapshot.suggestion}
        disabled={busy}
        onComplete={(r) => run((s) => s.completeCore(today.id, r))}
      />

      <Card>
        <Text style={T.h3}>Yan görevler</Text>
        {[SLOT_KEYS.habit1, SLOT_KEYS.habit2].map((key) => {
          const s = slot(key);
          const done = s.status === 'completed';
          return (
            <View key={key} style={[T.row, { justifyContent: 'space-between' }]}>
              <Text style={[T.body, { flex: 1, minWidth: 160 }]}>
                {done ? '✓ ' : ''}
                {s.title}
              </Text>
              {done ? (
                <Text style={[T.muted, { color: C.success }]}>Tamamlandı</Text>
              ) : (
                <Button
                  label={`Yaptım (+${awardedXp(s.baseXp, mult)} XP)`}
                  variant="secondary"
                  disabled={busy}
                  onPress={() => run((svc) => svc.completeHabit(today.id, key))}
                />
              )}
            </View>
          );
        })}
      </Card>

      <Text style={T.muted}>
        Görevler kendi beyanınla tamamlanır. Her görev günde bir kez XP verir; ek set veya ekstra hacim XP getirmez.
        Kaçırılan günler borç veya ceza üretmez. Kayıtların bu cihazda saklanır ({snapshot.storageKind}).
      </Text>
    </Screen>
  );
}

function Onboarding() {
  const { act } = useAvci();
  const [habits, setHabits] = useState<string[]>([...DEFAULT_HABIT_KEYS]);
  const [busy, setBusy] = useState(false);
  const toggle = (key: string) =>
    setHabits((h) => (h.includes(key) ? h.filter((k) => k !== key) : h.length < 2 ? [...h, key] : [h[1], key]));
  return (
    <Screen title="AVCI'ye hoş geldin">
      <Card accent={C.accent}>
        <Text style={T.body}>
          Her gün kısa bir kontrol yap, ana görevini (antrenman ya da planlı toparlanma) ve iki küçük alışkanlığını
          tamamla. Kaydettiğin görevler XP kazandırır; XP yalnızca oyundaki ilerlemeni etkiler, antrenman yükünü asla
          değiştirmez.
        </Text>
        <Text style={T.muted}>Hesap, fotoğraf, kilo veya bildirim izni gerekmez. Kayıtlar bu cihazda kalır.</Text>
      </Card>
      <Card>
        <Text style={T.h3}>İki alışkanlık seç</Text>
        <View style={T.row} accessibilityRole="radiogroup">
          {HABIT_CATALOG.map((h) => (
            <Chip key={h.key} label={h.title} selected={habits.includes(h.key)} onPress={() => toggle(h.key)} />
          ))}
        </View>
        <Text style={T.muted}>Daha sonra Ayarlar’dan değiştirebilirsin; değişiklik ertesi gün geçerli olur.</Text>
      </Card>
      <Button
        label="Başla"
        disabled={busy || habits.length !== 2}
        onPress={async () => {
          setBusy(true);
          try {
            await act((s) => s.createProfile({ habitKeys: habits }));
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}

function Scale({
  label,
  values,
  value,
  onChange,
  format = String,
}: {
  label: string;
  values: readonly (number | null | string)[];
  value: number | null | string;
  onChange: (v: never) => void;
  format?: (v: never) => string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={T.label}>{label}</Text>
      <View style={T.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {values.map((v) => (
          <Chip key={String(v)} label={format(v as never)} selected={v === value} onPress={() => onChange(v as never)} />
        ))}
      </View>
    </View>
  );
}

const TRI: TriState[] = ['no', 'yes', 'unknown'];
const triLabel = (v: TriState) => ({ no: 'Hayır', yes: 'Evet', unknown: 'Bilmiyorum' })[v];

function CheckinCard({
  slot,
  xp,
  initial,
  disabled,
  onSubmit,
}: {
  slot: QuestSlot;
  xp: number;
  initial: CheckinInput | null;
  disabled: boolean;
  onSubmit: (input: CheckinInput) => void;
}) {
  const done = slot.status === 'completed';
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CheckinInput>(
    initial ?? { sleepHours: null, energy: 3, fatigue: 2, soreness: 1, jointPain: 'no', illness: 'no' },
  );
  const set = <K extends keyof CheckinInput>(k: K) => (v: CheckinInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  if (done && !editing) {
    return (
      <Card accent={C.success}>
        <Text style={T.h3}>✓ Günlük kontrol</Text>
        {initial && (
          <Text style={T.muted}>
            Uyku {initial.sleepHours ?? 'belirtilmedi'} · enerji {initial.energy}/5 · yorgunluk {initial.fatigue}/5 · kas
            hassasiyeti {initial.soreness}/3 · ağrı {triLabel(initial.jointPain)} · hastalık {triLabel(initial.illness)}
          </Text>
        )}
        <Button
          label="Düzelt"
          variant="secondary"
          onPress={() => {
            if (initial) setForm(initial);
            setEditing(true);
          }}
          hint="Düzeltme ek XP vermez"
        />
      </Card>
    );
  }
  return (
    <Card accent={C.accent}>
      <Text style={T.h3}>Günlük kontrol {done ? '(düzeltme, ek XP yok)' : `(+${xp} XP)`}</Text>
      <Scale label="Uyku (saat)" values={[null, 4, 5, 6, 7, 8, 9]} value={form.sleepHours} onChange={set('sleepHours')}
        format={(v: number | null) => (v === null ? 'Belirtme' : v === 9 ? '9+' : String(v))} />
      <Scale label="Enerji (1 düşük – 5 yüksek)" values={[1, 2, 3, 4, 5]} value={form.energy} onChange={set('energy')} />
      <Scale label="Yorgunluk (1 az – 5 çok)" values={[1, 2, 3, 4, 5]} value={form.fatigue} onChange={set('fatigue')} />
      <Scale label="Kas hassasiyeti (0 yok – 3 belirgin)" values={[0, 1, 2, 3]} value={form.soreness} onChange={set('soreness')} />
      <Scale label="Yeni veya artan eklem ağrısı" values={TRI} value={form.jointPain} onChange={set('jointPain')} format={triLabel} />
      <Scale label="Hastalık (ateş, grip vb.)" values={TRI} value={form.illness} onChange={set('illness')} format={triLabel} />
      <Text style={T.muted}>
        Göğüs ağrısı, bayılma veya alışılmadık şiddetli nefes darlığında egzersizi bırak ve acil tıbbi yardım al.
      </Text>
      <Button
        label={done ? 'Düzeltmeyi kaydet' : 'Kontrolü kaydet'}
        disabled={disabled}
        onPress={() => {
          onSubmit(form);
          setEditing(false);
        }}
      />
    </Card>
  );
}

function CoreCard({
  slot,
  xp,
  suggestion,
  disabled,
  onComplete,
}: {
  slot: QuestSlot;
  xp: number;
  suggestion: CoreSuggestion | null;
  disabled: boolean;
  onComplete: (r: CoreResolution) => void;
}) {
  if (slot.status === 'completed') {
    const recovery = slot.resolution !== 'training';
    return (
      <Card accent={recovery ? C.recovery : C.success}>
        <Text style={T.h3}>✓ Ana görev</Text>
        <Text style={T.body}>{slot.resolution ? RESOLUTION_LABELS[slot.resolution] : 'Tamamlandı'}</Text>
        {recovery && <Text style={T.muted}>Toparlanma da başarıdır: antrenmanla aynı ödülü kazandırır.</Text>}
      </Card>
    );
  }
  const paused = suggestion?.mode === 'pause-training';
  return (
    <Card accent={C.violet}>
      <Text style={T.h3}>Ana görev (+{xp} XP)</Text>
      <Text style={T.muted}>
        Planlı antrenmanını ya da planlı toparlanma gününü tamamla. İkisi de aynı ödülü verir. Antrenman programı ve set
        kaydı bir sonraki aşamada (M1) eklenecek.
      </Text>
      {suggestion?.reasons.map((r) => (
        <Text key={r} style={[T.body, { color: C.warning }]}>
          • {REASON_LABELS[r]}
        </Text>
      ))}
      {!suggestion && <Text style={T.muted}>Önce günlük kontrolü yaparsan bugüne uygun öneri görürsün.</Text>}
      <View style={T.row}>
        {paused ? (
          <Button label="Toparlanma gününü tamamladım" variant="recovery" disabled={disabled}
            onPress={() => onComplete('illness-recovery')} />
        ) : (
          <>
            <Button label="Antrenmanı tamamladım" disabled={disabled} onPress={() => onComplete('training')} />
            <Button label="Planlı toparlanma günü" variant="recovery" disabled={disabled} onPress={() => onComplete('recovery')} />
          </>
        )}
      </View>
    </Card>
  );
}
