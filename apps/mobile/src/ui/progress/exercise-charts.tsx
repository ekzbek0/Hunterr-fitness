import { useState } from 'react';
import { Text, View } from 'react-native';

import { pointValue, type ExerciseSeries, type SeriesPoint } from '@/domain/progress/series';
import { Button, Card, T } from '@/ui/components';
import { exerciseName, fmtLoad } from '@/ui/labels';
import { C, S } from '@/ui/theme';

import { DatedBarChart } from './dated-bar-chart';
import { longDate, seriesUnitLabel, shortDate } from './progress-labels';

/** Points shown in the bar chart; the table can show all. */
const CHART_POINTS = 10;
const TABLE_PREVIEW = 5;

function pointText(s: ExerciseSeries, p: SeriesPoint): string {
  const top =
    s.loadConvention === 'band'
      ? `en çok ${p.bestReps} tekrar`
      : `en yüksek ${fmtLoad(p.topLoad)} ${s.unit} × ${p.repsAtTop} tekrar`;
  const parts = [top, `${p.workSets} çalışma seti`];
  if (p.volume !== null) parts.push(`hacim ${fmtLoad(p.volume)} ${s.unit}×tekrar`);
  if (p.warmupSets > 0) parts.push(`ısınma ${p.warmupSets} set (sayılmaz)`);
  return parts.join(' · ');
}

function chartSummary(s: ExerciseSeries, name: string): string {
  const what = s.metric === 'load' ? `en yüksek çalışma seti yükü (${s.unit})` : 'en çok tekrar';
  const pts = s.points;
  if (pts.length === 0) return `${name}, ${seriesUnitLabel(s)}: çalışma seti yok.`;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const val = (p: SeriesPoint) => (s.metric === 'load' ? `${fmtLoad(p.topLoad)} ${s.unit}` : `${p.bestReps} tekrar`);
  if (pts.length === 1) return `${name}, ${seriesUnitLabel(s)}, ${what}: tek kayıt, ${longDate(first.date)} ${val(first)}.`;
  return `${name}, ${seriesUnitLabel(s)}, ${what}: ${pts.length} tarih. İlk ${longDate(first.date)} ${val(first)}, son ${longDate(last.date)} ${val(last)}.`;
}

export function ExerciseSeriesCard({ series }: { series: ExerciseSeries }) {
  const [showAll, setShowAll] = useState(false);
  const name = exerciseName(series.exerciseId);
  const shown = series.points.slice(-CHART_POINTS);
  const tableRows = [...series.points].reverse();
  const visibleRows = showAll ? tableRows : tableRows.slice(0, TABLE_PREVIEW);
  return (
    <Card>
      <View style={{ gap: 2 }}>
        <Text style={T.h3}>{name}</Text>
        <Text style={[T.muted, { color: C.accent }]}>{seriesUnitLabel(series)}</Text>
      </View>
      {series.points.length === 0 ? (
        <Text style={T.muted}>Bu seride yalnızca ısınma seti var; grafik çalışma setlerinden çizilir.</Text>
      ) : (
        <>
          <Text style={T.muted}>
            {series.metric === 'load'
              ? `Çubuk: o günkü en yüksek çalışma seti yükü (${series.unit}).`
              : 'Çubuk: o günkü en çok tekrar (yük kg/lb olarak karşılaştırılmaz).'}
            {series.points.length > CHART_POINTS ? ` Son ${CHART_POINTS} tarih gösteriliyor.` : ''}
          </Text>
          <DatedBarChart
            testID="progress-chart"
            a11yLabel={chartSummary(series, name)}
            bars={shown.map((p) => ({
              date: p.date,
              value: pointValue(series, p),
              valueLabel: series.metric === 'load' ? fmtLoad(p.topLoad) : String(p.bestReps),
            }))}
          />
          <View style={{ gap: S.xs }} accessibilityLabel="Değer tablosu">
            <Text style={T.label}>Tarihli değerler</Text>
            {visibleRows.map((p) => (
              <Text key={p.date} style={T.body} testID="progress-table-row">
                <Text style={{ fontWeight: '700' }}>{shortDate(p.date)}</Text>
                {` · ${pointText(series, p)}`}
              </Text>
            ))}
            {tableRows.length > TABLE_PREVIEW && (
              <Button
                variant="secondary"
                label={showAll ? 'Daha az göster' : `Tüm ${tableRows.length} tarihi göster`}
                onPress={() => setShowAll((v) => !v)}
              />
            )}
          </View>
        </>
      )}
      {series.warmupSetsTotal > 0 && (
        <Text style={T.muted}>
          Isınma setleri ({series.warmupSetsTotal}) kaydedildi ama grafiğe ve çalışma seti sayısına katılmaz.
        </Text>
      )}
    </Card>
  );
}

export function ExerciseCharts({ series }: { series: ExerciseSeries[] }) {
  return (
    <View style={{ gap: S.md }}>
      <Text style={T.h2} accessibilityRole="header">
        Performans
      </Text>
      {series.length === 0 ? (
        <Card>
          <Text style={T.body}>Henüz tamamlanmış antrenman yok.</Text>
          <Text style={T.muted}>Bir antrenmanı bitirdiğinde her hareket için tarihli grafik burada görünür.</Text>
        </Card>
      ) : (
        <>
          <Text style={T.muted}>
            Her grafik tek bir hareket, birim ve yük türü içindir: kg ile lb, dambıl başına ile toplam yük asla birleştirilmez ve
            dönüştürülmez. Tahmini 1TM hesaplanmaz.
          </Text>
          {series.map((s) => (
            <ExerciseSeriesCard key={s.key} series={s} />
          ))}
        </>
      )}
    </View>
  );
}
