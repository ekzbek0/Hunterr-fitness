import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  DRAFT_TRAINING_PROFILE,
  EQUIPMENT,
  EXPERIENCE_LEVELS,
  GOALS,
  LIMITATIONS,
  TrainingProfileError,
  validateTrainingProfile,
  type Equipment,
  type Experience,
  type Goal,
  type Limitation,
  type TrainingProfileInput,
} from '@/domain/training/profile';
import { parseDecimal } from '@/domain/training/workout';
import { Button, Card, Chip, Field, T, ToggleChip } from '@/ui/components';
import {
  EQUIPMENT_LABELS,
  EXPERIENCE_LABELS,
  GOAL_LABELS,
  LIMITATION_LABELS,
  WEEKDAY_SHORT,
} from '@/ui/labels';
import { C } from '@/ui/theme';

const FIELD_ERRORS: Record<TrainingProfileError['field'], string> = {
  goal: 'Bir hedef seç.',
  'training-days': 'Haftada 2–6 antrenman günü seç.',
  'session-minutes': 'Süre 15–180 dakika olmalı.',
  equipment: 'En az bir ekipman seç.',
  experience: 'Deneyimini seç.',
  limitations: 'Geçersiz kısıt.',
  height: 'Boy 100–250 cm arasında olmalı ya da boş bırakılmalı.',
  weight: 'Kilo 30–300 kg arasında olmalı ya da boş bırakılmalı.',
};

const MINUTES: (number | null)[] = [null, 30, 45, 60, 75, 90];

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/**
 * Confirmation of current training facts. Prefilled values are an editable
 * suggestion (not current measurements) until the user confirms them.
 */
export function TrainingProfileForm({
  initial,
  isDraft,
  onConfirm,
  onCancel,
}: {
  initial: TrainingProfileInput | null;
  isDraft: boolean;
  onConfirm: (input: TrainingProfileInput) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const start = initial ?? DRAFT_TRAINING_PROFILE;
  const [goal, setGoal] = useState<Goal>(start.goal);
  const [days, setDays] = useState<number[]>([...start.trainingDays]);
  const [minutes, setMinutes] = useState<number | null>(start.sessionMinutes);
  const [equipment, setEquipment] = useState<string[]>([...start.equipment]);
  const [experience, setExperience] = useState<Experience>(start.experience);
  const [limitations, setLimitations] = useState<string[]>([...start.limitations]);
  const [height, setHeight] = useState(start.heightCm === null ? '' : String(start.heightCm));
  const [weight, setWeight] = useState(start.weightKg === null ? '' : String(start.weightKg));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const input: TrainingProfileInput = {
      goal,
      trainingDays: days,
      sessionMinutes: minutes,
      equipment,
      experience,
      limitations,
      heightCm: parseDecimal(height),
      weightKg: parseDecimal(weight),
    };
    try {
      validateTrainingProfile(input);
    } catch (e) {
      setError(e instanceof TrainingProfileError ? FIELD_ERRORS[e.field] : 'Bilgiler geçersiz.');
      return;
    }
    setBusy(true);
    setError(await onConfirm(input));
    setBusy(false);
  };

  return (
    <View style={{ gap: 16 }}>
      {isDraft && (
        <Card accent={C.warning}>
          <Text style={T.body}>
            Aşağıdaki seçimler yalnızca bir öneridir (planlama notlarındaki 5 günlük İtiş/Çekiş/Bacak tercihi). Güncel
            durumuna göre düzelt ve onayla; onaylamadan hiçbir şey kaydedilmez.
          </Text>
        </Card>
      )}
      <Card>
        <Text style={T.h3}>Güncel hedefin</Text>
        <View style={T.row} accessibilityRole="radiogroup" accessibilityLabel="Hedef">
          {GOALS.map((g) => (
            <Chip key={g} label={GOAL_LABELS[g]} selected={goal === g} onPress={() => setGoal(g)} />
          ))}
        </View>
      </Card>
      <Card>
        <Text style={T.h3}>Antrenman günleri ({days.length} gün)</Text>
        <View style={T.row} accessibilityLabel="Antrenman günleri">
          {WEEKDAY_SHORT.map((label, i) => (
            <ToggleChip key={label} label={label} selected={days.includes(i)} onPress={() => setDays((d) => toggle(d, i))} />
          ))}
        </View>
        <Text style={T.label}>Seans süresi (isteğe bağlı)</Text>
        <View style={T.row} accessibilityRole="radiogroup" accessibilityLabel="Seans süresi">
          {MINUTES.map((m) => (
            <Chip key={String(m)} label={m === null ? 'Belirtme' : `${m} dk`} selected={minutes === m} onPress={() => setMinutes(m)} />
          ))}
        </View>
      </Card>
      <Card>
        <Text style={T.h3}>Erişebildiğin ekipman</Text>
        <View style={T.row}>
          {EQUIPMENT.map((e: Equipment) => (
            <ToggleChip key={e} label={EQUIPMENT_LABELS[e]} selected={equipment.includes(e)}
              onPress={() => setEquipment((l) => toggle(l, e))} />
          ))}
        </View>
      </Card>
      <Card>
        <Text style={T.h3}>Deneyim</Text>
        <View style={T.row} accessibilityRole="radiogroup" accessibilityLabel="Deneyim">
          {EXPERIENCE_LEVELS.map((x) => (
            <Chip key={x} label={EXPERIENCE_LABELS[x]} selected={experience === x} onPress={() => setExperience(x)} />
          ))}
        </View>
      </Card>
      <Card>
        <Text style={T.h3}>Hareket kısıtların</Text>
        <Text style={T.muted}>
          Seçtiğin kısıtlara giren hareketler programa hiç eklenmez. Bu bir teşhis değildir; ağrın varsa bir sağlık
          profesyoneline danış.
        </Text>
        <View style={T.row}>
          {LIMITATIONS.map((l: Limitation) => (
            <ToggleChip key={l} label={LIMITATION_LABELS[l]} selected={limitations.includes(l)}
              onPress={() => setLimitations((x) => toggle(x, l))} />
          ))}
        </View>
      </Card>
      <Card>
        <Text style={T.h3}>Boy ve kilo (isteğe bağlı)</Text>
        <Text style={T.muted}>Boş bırakabilirsin. Program bu değerlere göre değişmez; XP de vermez.</Text>
        <View style={[T.row, { alignItems: 'flex-start' }]}>
          <Field label="Boy (cm)" value={height} onChangeText={setHeight} numeric width={130} placeholder="Boş" />
          <Field label="Kilo (kg)" value={weight} onChangeText={setWeight} numeric width={130} placeholder="Boş" />
        </View>
      </Card>
      {error && (
        <Text style={[T.body, { color: C.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
      <View style={T.row}>
        <Button label="Bilgileri onayla" disabled={busy} onPress={submit} />
        {onCancel && <Button label="Vazgeç" variant="secondary" onPress={onCancel} />}
      </View>
    </View>
  );
}
