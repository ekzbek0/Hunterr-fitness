import { useState } from 'react';
import { Text, View } from 'react-native';

import type { ProgressionProposal } from '@/data/types';
import { INCREMENT_KEYS, type IncrementKey } from '@/domain/training/catalog';
import type { ProgressionDecision } from '@/domain/training/progression';
import { parseDecimal, type LoadUnit } from '@/domain/training/workout';
import type { WeeklyReviewSnapshot } from '@/services/avci-service';
import { Button, Card, Chip, Field, T, ToggleChip } from '@/ui/components';
import {
  exerciseName,
  fmtLoad,
  formatDate,
  HOLD_REASON_LABELS,
  INCREMENT_KEY_LABELS,
  loadText,
  REBASELINE_LABELS,
} from '@/ui/labels';
import { C } from '@/ui/theme';

const STATUS_LABELS: Record<ProgressionProposal['status'], string> = {
  pending: 'Karar bekliyor',
  accepted: 'Kabul edildi · yeni program sürümü kaydedildi',
  declined: 'Reddedildi · plan değişmedi',
  stale: 'Geçersiz oldu (veri veya program değişti) · uygulanmadı',
};

function ProposalCard({
  p,
  busy,
  blocked,
  onAccept,
  onDecline,
}: {
  p: ProgressionProposal;
  busy: boolean;
  /** Today's check-in missing or blocking: accept is unavailable, the proposal stays pending. */
  blocked: boolean;
  onAccept: (id: string, techniqueConfirmed: boolean) => void;
  onDecline: (id: string) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const name = exerciseName(p.exerciseId);
  // Readiness holds prevent deterministic re-evaluation. Stored backup numbers
  // are audit data, never an actionable prescription until revalidated today.
  if (p.status === 'pending' && blocked) {
    return (
      <Card>
        <View testID="proposal-card" style={{ gap: 8 }}>
          <Text style={T.h3}>{name}</Text>
          <Text style={T.muted}>{STATUS_LABELS[p.status]}</Text>
          <Text style={[T.body, { color: C.warning }]} testID="proposal-unverified">
            Bugünkü kontrol eksik veya yük artışını engelliyor. Önerinin yükü ve gerekçesi yeniden doğrulanana kadar
            gösterilmez; mevcut programın değişmez.
          </Text>
          <View style={T.row}>
            <Button label={`Öneriyi kabul et: ${name}`} disabled onPress={() => onAccept(p.id, false)} />
            <Button label={`Reddet: ${name}`} variant="secondary" disabled={busy} onPress={() => onDecline(p.id)} />
          </View>
        </View>
      </Card>
    );
  }
  const pct = (p.percentHundredths / 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  const reps = `${p.before.sets} set × ${p.before.repMin}–${p.before.repMax} tekrar`;
  return (
    <Card accent={p.status === 'pending' ? C.accent : C.border}>
      <View testID="proposal-card" style={{ gap: 8 }}>
        <Text style={T.h3}>{name}</Text>
        <Text style={T.muted}>{STATUS_LABELS[p.status]}</Text>
        <Text style={T.label}>Gerekçe</Text>
        <Text style={T.body}>
          Son iki karşılaştırılabilir seansta planlanan tüm çalışma setleri üst sınıra ({p.before.repMax} tekrar) ulaştı ve
          her sette RIR en az 2 idi; seanslar 14 gün içinde, ağrı/hastalık bildirimi yok. Doğruladığın en küçük artış{' '}
          {fmtLoad(p.increment.value)} {p.increment.unit} = mevcut yükün %{pct}’i (sınır %5).
        </Text>
        <Text style={T.label}>Önce / sonra</Text>
        <Text style={T.body} testID="proposal-before">
          Önce: {loadText(p.before.load, p.before.unit, p.before.convention)} · {reps}
        </Text>
        <Text style={T.body} testID="proposal-after">
          Sonra: {loadText(p.after.load, p.after.unit, p.after.convention)} · {reps} (tekrarlar aralığın altından yeniden
          başlar)
        </Text>
        {p.status === 'pending' && (
          <>
            <ToggleChip
              label="Teknik ve hareket açıklığı iki seansta da aynıydı"
              selected={confirmed}
              onPress={() => setConfirmed(!confirmed)}
            />
            {blocked && (
              <Text style={[T.body, { color: C.warning }]}>
                Bugünkü kontrol eksik veya yük artışını engelliyor; kabul şimdilik kapalı. Öneri bekliyor.
              </Text>
            )}
            <View style={T.row}>
              <Button label={`Öneriyi kabul et: ${name}`} disabled={busy || !confirmed || blocked} onPress={() => onAccept(p.id, confirmed)} />
              <Button label={`Reddet: ${name}`} variant="secondary" disabled={busy} onPress={() => onDecline(p.id)} />
            </View>
          </>
        )}
      </View>
    </Card>
  );
}

function decisionText(d: ProgressionDecision): string {
  if (d.kind === 'rebaseline') {
    return `${d.reasons.map((r) => REBASELINE_LABELS[r]).join(' ')} Yük artırılmaz; rahat bir yükle yeniden başla (son seans ${formatDate(d.lastDate)}). Plan değişmez.`;
  }
  if (d.kind === 'hold') return d.reasons.map((r) => HOLD_REASON_LABELS[r]).join(' ');
  return '';
}

function IncrementForm({ busy, onSave }: { busy: boolean; onSave: (key: IncrementKey, unit: LoadUnit, value: number) => void }) {
  const [key, setKey] = useState<IncrementKey>('barbell');
  const [unit, setUnit] = useState<LoadUnit>('kg');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={{ gap: 8 }}>
      <View style={T.row} accessibilityRole="radiogroup" accessibilityLabel="Ekipman">
        {INCREMENT_KEYS.map((k) => (
          <Chip key={k} label={INCREMENT_KEY_LABELS[k]} selected={key === k} onPress={() => setKey(k)} />
        ))}
      </View>
      <View style={[T.row, { alignItems: 'flex-end' }]}>
        <Field label="En küçük artış" a11yLabel="En küçük artış" value={value} onChangeText={setValue} numeric width={140} placeholder="ör. 2,5" />
        <View style={T.row} accessibilityRole="radiogroup" accessibilityLabel="Artış birimi">
          <Chip label="kg" selected={unit === 'kg'} onPress={() => setUnit('kg')} />
          <Chip label="lb" selected={unit === 'lb'} onPress={() => setUnit('lb')} />
        </View>
      </View>
      {error && <Text style={[T.body, { color: C.danger }]}>{error}</Text>}
      <Button
        label="Artışı doğrula"
        disabled={busy}
        onPress={() => {
          const v = parseDecimal(value);
          if (v === null || Number.isNaN(v) || v <= 0 || v > 50) return setError('0 ile 50 arasında bir sayı gir (ör. 2,5).');
          setError(null);
          setValue('');
          onSave(key, unit, v);
        }}
      />
    </View>
  );
}

export function WeeklyReviewView({
  review,
  busy,
  onComplete,
  onAccept,
  onDecline,
  onIncrement,
  onBack,
}: {
  review: WeeklyReviewSnapshot;
  busy: boolean;
  onComplete: () => void;
  onAccept: (id: string, techniqueConfirmed: boolean) => void;
  onDecline: (id: string) => void;
  onIncrement: (key: IncrementKey, unit: LoadUnit, value: number) => void;
  onBack: () => void;
}) {
  const { cycle, summary } = review;
  const holds = review.decisions;
  return (
    <View style={{ gap: 16 }}>
      <Card accent={C.violet}>
        <Text style={T.h3}>
          {formatDate(cycle.weekStart)} – {formatDate(cycle.weekEnd)}
        </Text>
        <Text style={T.body} testID="weekly-summary">
          Planlı {summary.planned} · tamamlanan {summary.done} · kaçırılan {summary.missed} (borç yok) · çalışma seti{' '}
          {summary.workSets} · kontrol {summary.checkins} gün · toparlanma {summary.recoveryDays} gün
        </Text>
        {review.review ? (
          <Text style={[T.body, { color: C.success }]} testID="weekly-done">
            Bu haftanın değerlendirmesi tamamlandı. Ödül bu hafta için bir kez verildi.
          </Text>
        ) : (
          <>
            <Text style={T.muted}>
              Değerlendirme bu hafta için bir kez {review.rewardXp} XP verir (taban 40; haftanın çarpanı hafta açılırken
              sabitlendi). Günlük üst sınırın dışındadır.
            </Text>
            {review.rewardsFrozen && (
              <Text style={[T.body, { color: C.warning }]}>Cihaz saati geri alınmış görünüyor; saat düzelene kadar ödül verilmez.</Text>
            )}
            <Button label="Haftalık değerlendirmeyi tamamla" disabled={busy} onPress={onComplete} />
          </>
        )}
      </Card>

      <Text style={T.muted} testID="rules-disclaimer">
        Öneriler sabit ürün varsayımlarıyla hesaplanır (son iki karşılaştırılabilir seans, RIR ≥ 2, 14 gün güncellik, artış en
        fazla %5). Bunlar doğrulanmış bir tıbbi algoritma değildir. Program sen onaylamadan değişmez.
      </Text>
      {!review.checkinToday && (
        <Card accent={C.warning}>
          <Text style={T.body}>Bugünkü kontrolü yapmadan yük artışı önerilmez. Bugün sekmesinden kontrolü kaydedebilirsin.</Text>
        </Card>
      )}

      <Text style={T.h3}>Yük önerileri</Text>
      {review.proposals.length === 0 && <Text style={T.muted}>Bu hafta için yük artışı önerisi yok.</Text>}
      {review.proposals.map((p) => (
        <ProposalCard key={p.id} p={p} busy={busy} blocked={review.readinessBlocked} onAccept={onAccept} onDecline={onDecline} />
      ))}

      {holds.length > 0 && (
        <Card>
          <Text style={T.h3}>Artış önerilmeyen hareketler</Text>
          {holds.map((d) => (
            <View key={d.exerciseId} testID="hold-row" style={{ gap: 2 }}>
              <Text style={T.body}>
                {exerciseName(d.exerciseId)}
                {d.before ? ` · son: ${loadText(d.before.load, d.before.unit, d.before.convention)}` : ''}
              </Text>
              <Text style={T.muted}>{decisionText(d)}</Text>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <Text style={T.h3}>Ekipman artışların</Text>
        <Text style={T.muted}>
          Yalnız senin doğruladığın en küçük artış kullanılır; kg ve lb ayrı tutulur, dönüştürülmez. Dambıl artışı tek dambıl
          içindir. Lastik direnci kilogram sayılmaz.
        </Text>
        {review.increments.length === 0 && <Text style={T.muted}>Henüz doğrulanmış artış yok.</Text>}
        {review.increments.map((i) => (
          <Text key={`${i.key}-${i.unit}`} style={T.body} testID="increment-row">
            {INCREMENT_KEY_LABELS[i.key]}: {fmtLoad(i.value)} {i.unit}
          </Text>
        ))}
        <IncrementForm busy={busy} onSave={onIncrement} />
      </Card>
      <Button label="Haftaya dön" variant="secondary" onPress={onBack} />
    </View>
  );
}
