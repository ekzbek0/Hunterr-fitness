import { useState } from 'react';
import { Text, View } from 'react-native';

import type { Measurement, MeasurementType, MeasurementUnit } from '@/data/types';
import {
  MEASUREMENT_TYPES,
  UNITS_FOR_TYPE,
  type MeasurementError,
  type MeasurementGroup,
} from '@/domain/progress/measurements';
import type { AddMeasurementResult, DeleteMeasurementResult } from '@/services/progress-service';
import { Button, Card, Chip, Field, T } from '@/ui/components';
import { fmtLoad } from '@/ui/labels';
import { C, S } from '@/ui/theme';

import { DatedBarChart } from './dated-bar-chart';
import {
  longDate,
  MEASUREMENT_TYPE_LABELS,
  MEASUREMENT_UNIT_LABELS,
  measurementErrorText,
  shortDate,
  signedDiff,
} from './progress-labels';

type FieldErrors = Partial<Record<'type' | 'unit' | 'value' | 'date', MeasurementError>>;

export function MeasurementForm({
  today,
  busy,
  onSave,
}: {
  today: string;
  busy: boolean;
  onSave: (input: { type: MeasurementType; unit: MeasurementUnit; valueText: string; measuredOn: string }) => Promise<AddMeasurementResult | null>;
}) {
  const [type, setType] = useState<MeasurementType>('body-weight');
  const [unit, setUnit] = useState<MeasurementUnit>('kg');
  const [valueText, setValueText] = useState('');
  const [date, setDate] = useState(today);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState<string | null>(null);

  const chooseType = (t: MeasurementType) => {
    setType(t);
    if (!UNITS_FOR_TYPE[t].includes(unit)) setUnit(UNITS_FOR_TYPE[t][0]);
    setErrors({});
  };

  const save = async () => {
    setSaved(null);
    const r = await onSave({ type, unit, valueText, measuredOn: date });
    if (!r) return;
    if (r.status === 'invalid') {
      setErrors(r.errors);
      return;
    }
    setErrors({});
    setValueText('');
    setSaved(`Kaydedildi: ${MEASUREMENT_TYPE_LABELS[r.value.type]} ${fmtLoad(r.value.value)} ${MEASUREMENT_UNIT_LABELS[r.value.unit]}, ${longDate(r.value.measuredOn)}.`);
  };

  const errorLines = (['type', 'unit', 'value', 'date'] as const)
    .filter((k) => errors[k])
    .map((k) => measurementErrorText(errors[k]!, unit));

  return (
    <Card>
      <Text style={T.h3}>Yeni ölçüm</Text>
      <Text style={T.label}>Tür</Text>
      <View style={T.row} accessibilityRole="radiogroup" accessibilityLabel="Ölçüm türü">
        {MEASUREMENT_TYPES.map((t) => (
          <Chip key={t} label={MEASUREMENT_TYPE_LABELS[t]} selected={type === t} onPress={() => chooseType(t)} />
        ))}
      </View>
      <Text style={T.label}>Birim</Text>
      <View style={T.row} accessibilityRole="radiogroup" accessibilityLabel="Ölçüm birimi">
        {UNITS_FOR_TYPE[type].map((u) => (
          <Chip key={u} label={MEASUREMENT_UNIT_LABELS[u]} selected={unit === u} onPress={() => setUnit(u)} />
        ))}
      </View>
      <Field
        label={`Değer (${MEASUREMENT_UNIT_LABELS[unit]})`}
        a11yLabel="Ölçüm değeri"
        value={valueText}
        onChangeText={setValueText}
        placeholder={type === 'body-weight' ? 'ör. 72,5' : 'ör. 81'}
        numeric
        testID="measurement-value"
      />
      <Field
        label="Tarih (YYYY-AA-GG)"
        a11yLabel="Ölçüm tarihi"
        value={date}
        onChangeText={setDate}
        placeholder={today}
        testID="measurement-date"
      />
      {errorLines.length > 0 && (
        <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ gap: 2 }}>
          {errorLines.map((e) => (
            <Text key={e} style={[T.body, { color: C.danger }]} testID="measurement-error">
              {e}
            </Text>
          ))}
        </View>
      )}
      {saved && (
        <Text style={[T.body, { color: C.success }]} accessibilityLiveRegion="polite">
          {saved}
        </Text>
      )}
      <Button label="Ölçümü kaydet" onPress={() => void save()} disabled={busy} testID="measurement-save" />
    </Card>
  );
}

function MeasurementRow({
  m,
  busy,
  onDelete,
}: {
  m: Measurement;
  busy: boolean;
  onDelete: (id: string) => Promise<DeleteMeasurementResult | null>;
}) {
  const [confirming, setConfirming] = useState(false);
  const text = `${fmtLoad(m.value)} ${MEASUREMENT_UNIT_LABELS[m.unit]}`;
  const name = `${MEASUREMENT_TYPE_LABELS[m.type]} ${text}, ${longDate(m.measuredOn)}`;
  return (
    <View testID="measurement-row" style={{ gap: S.sm, borderTopWidth: 1, borderTopColor: C.border, paddingTop: S.sm }}>
      <View style={[T.row, { justifyContent: 'space-between' }]}>
        <Text style={[T.body, { flexShrink: 1 }]}>
          <Text style={{ fontWeight: '700' }}>{text}</Text>
          <Text style={T.muted}> · {longDate(m.measuredOn)}</Text>
        </Text>
        {!confirming && (
          <Button variant="secondary" label="Sil" a11yLabel={`Ölçümü sil: ${name}`} onPress={() => setConfirming(true)} testID="measurement-delete" />
        )}
      </View>
      {confirming && (
        <View style={{ gap: S.sm }}>
          <Text style={T.body}>Bu ölçüm silinsin mi? Silinen ölçüm cihazdan kalıcı olarak silinir ve yedeğe girmez.</Text>
          <View style={T.row}>
            <Button
              label="Evet, sil"
              a11yLabel={`Silmeyi onayla: ${name}`}
              disabled={busy}
              testID="measurement-delete-confirm"
              onPress={() => void onDelete(m.id).then(() => setConfirming(false))}
            />
            <Button variant="secondary" label="Vazgeç" onPress={() => setConfirming(false)} />
          </View>
        </View>
      )}
    </View>
  );
}

function GroupCard({
  group,
  busy,
  onDelete,
}: {
  group: MeasurementGroup;
  busy: boolean;
  onDelete: (id: string) => Promise<DeleteMeasurementResult | null>;
}) {
  const unit = MEASUREMENT_UNIT_LABELS[group.unit];
  const title = `${MEASUREMENT_TYPE_LABELS[group.type]} · ${unit}`;
  const trend = group.trend;
  const first = trend[0];
  const last = trend[trend.length - 1];
  const a11y =
    trend.length === 1
      ? `${title}: tek kayıt, ${longDate(first.date)} ${fmtLoad(first.value)} ${unit}.`
      : `${title}: ${trend.length} tarih. İlk ${longDate(first.date)} ${fmtLoad(first.value)} ${unit}, son ${longDate(last.date)} ${fmtLoad(last.value)} ${unit}.`;
  return (
    <Card>
      <Text style={T.h3}>{title}</Text>
      <DatedBarChart
        testID="measurement-chart"
        color={C.violet}
        a11yLabel={a11y}
        bars={trend.slice(-10).map((p) => ({ date: p.date, value: p.value, valueLabel: fmtLoad(p.value) }))}
      />
      {trend.length > 1 && (
        <Text style={T.muted}>
          {shortDate(first.date)} → {shortDate(last.date)}: {signedDiff(last.value - first.value, unit)}
        </Text>
      )}
      {group.entries.map((m) => (
        <MeasurementRow key={m.id} m={m} busy={busy} onDelete={onDelete} />
      ))}
    </Card>
  );
}

export function MeasurementsSection({
  today,
  groups,
  busy,
  onSave,
  onDelete,
}: {
  today: string;
  groups: MeasurementGroup[];
  busy: boolean;
  onSave: (input: { type: MeasurementType; unit: MeasurementUnit; valueText: string; measuredOn: string }) => Promise<AddMeasurementResult | null>;
  onDelete: (id: string) => Promise<DeleteMeasurementResult | null>;
}) {
  return (
    <View style={{ gap: S.md }}>
      <Text style={T.h2} accessibilityRole="header">
        Ölçümler (isteğe bağlı)
      </Text>
      <Text style={T.muted}>
        Ölçüm girmek zorunlu değildir ve fotoğraf gerekmez. AVCI görünüm, yağ oranı veya vücut puanı hesaplamaz; yalnızca
        girdiğin değerleri tarihleriyle gösterir. kg ile lb, cm ile inç ayrı tutulur ve dönüştürülmez.
      </Text>
      <MeasurementForm today={today} busy={busy} onSave={onSave} />
      {groups.length === 0 ? (
        <Card>
          <Text style={T.body}>Henüz ölçüm yok.</Text>
        </Card>
      ) : (
        groups.map((g) => <GroupCard key={g.key} group={g} busy={busy} onDelete={onDelete} />)
      )}
    </View>
  );
}
