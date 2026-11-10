import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import type { MeasurementFormInput } from '@/domain/progress/measurements';
import {
  ProgressService,
  type AddMeasurementResult,
  type DeleteMeasurementResult,
  type ProgressSnapshot,
} from '@/services/progress-service';
import { useAvci } from '@/ui/avci-context';
import { Button, Card, Screen, StorageGate, T } from '@/ui/components';
import { ContinuityGrid } from '@/ui/progress/continuity-grid';
import { ExerciseCharts } from '@/ui/progress/exercise-charts';
import { MeasurementsSection } from '@/ui/progress/measurements-view';
import { WorkoutHistory } from '@/ui/progress/workout-history';
import { C, S } from '@/ui/theme';

export default function ProgressScreen() {
  return (
    <StorageGate>
      <Progress />
    </StorageGate>
  );
}

function Progress() {
  const { repo, dataVersion, refresh } = useAvci();
  const service = useMemo(() => (repo ? new ProgressService(repo) : null), [repo]);
  const [snap, setSnap] = useState<ProgressSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!service) return;
    let cancelled = false;
    service
      .loadProgress()
      .then((s) => {
        if (cancelled) return;
        setSnap(s);
        setLoadError(null);
      })
      .catch((e: unknown) => !cancelled && setLoadError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [service, dataVersion, attempt]);

  /** Runs a mutation once at a time, then reloads every screen from storage. */
  const run = useCallback(
    async <R,>(fn: (s: ProgressService) => Promise<R>): Promise<R | null> => {
      if (!service || busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      setActionError(null);
      try {
        return await fn(service);
      } catch (e) {
        setActionError(`İşlem kaydedilemedi: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      } finally {
        busyRef.current = false;
        setBusy(false);
        await refresh();
      }
    },
    [service, refresh],
  );

  const onSave = useCallback(
    (input: MeasurementFormInput): Promise<AddMeasurementResult | null> => run((s) => s.addMeasurement(input)),
    [run],
  );
  const onDelete = useCallback(
    async (id: string): Promise<DeleteMeasurementResult | null> => {
      const r = await run((s) => s.deleteMeasurement(id));
      if (r && r.status === 'not-found') setActionError('Ölçüm bulunamadı; liste yenilendi.');
      return r;
    },
    [run],
  );

  if (loadError && !snap) {
    return (
      <Screen title="Gelişim">
        <Card accent={C.danger}>
          <Text style={T.h3}>Gelişim verileri yüklenemedi</Text>
          <Text style={T.muted}>{loadError}</Text>
          <Button label="Tekrar dene" onPress={() => setAttempt((n) => n + 1)} />
        </Card>
      </Screen>
    );
  }
  if (!snap) {
    return (
      <Screen title="Gelişim">
        <View style={{ alignItems: 'center', gap: S.md, paddingVertical: S.xl }} accessibilityLabel="Gelişim verileri yükleniyor">
          <ActivityIndicator color={C.accent} size="large" />
          <Text style={T.muted}>Gelişim verileri yükleniyor…</Text>
        </View>
      </Screen>
    );
  }
  return (
    <Screen title="Gelişim">
      {loadError && (
        <Card accent={C.warning}>
          <Text style={T.body}>Son yenileme başarısız oldu; gösterilen veriler bir önceki yüklemeden.</Text>
          <Button variant="secondary" label="Tekrar dene" onPress={() => setAttempt((n) => n + 1)} />
        </Card>
      )}
      {actionError && (
        <Card accent={C.danger}>
          <Text style={T.body} accessibilityLiveRegion="polite">
            {actionError}
          </Text>
        </Card>
      )}
      {!snap.hasProfile && (
        <Card>
          <Text style={T.body}>Henüz bir avcı profilin yok. Bugün sekmesinden başlayabilirsin; ölçümler profil olmadan da kaydedilebilir.</Text>
        </Card>
      )}
      <ContinuityGrid view={snap.continuity} />
      <ExerciseCharts series={snap.series} />
      <WorkoutHistory history={snap.history} />
      <MeasurementsSection
        today={snap.today}
        groups={snap.measurementGroups}
        busy={busy}
        onSave={onSave}
        onDelete={onDelete}
      />
    </Screen>
  );
}
