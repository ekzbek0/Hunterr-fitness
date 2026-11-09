import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import type { Program, ProgramChange } from '@/domain/training/program';
import type { SetInput } from '@/domain/training/workout';
import type { CompletionResult, TrainingResult, TrainingSnapshot } from '@/services/avci-service';
import { useAvci } from '@/ui/avci-context';
import { Button, Card, Screen, StorageGate, T } from '@/ui/components';
import { PROGRAM_ERROR_LABELS, REASON_LABELS, TRAINING_REJECT_LABELS } from '@/ui/labels';
import { C } from '@/ui/theme';
import { TrainingProfileForm } from '@/ui/training/profile-form';
import { ExposureNote, ProgramEditor, ProposalPreview } from '@/ui/training/program-views';
import { WeekView, WorkoutLogger } from '@/ui/training/workout-views';

export default function TrainingScreen() {
  return (
    <StorageGate>
      <Training />
    </StorageGate>
  );
}

const JOINT_PAIN_NOTICE = `${REASON_LABELS['joint-pain']} Ağrıyan bölgeyi zorlayan hareketleri atla, yerine ağrılı bir hareket koyma; planlı toparlanma da aynı ödülü verir.`;

type Mode = 'main' | 'edit-profile' | 'edit-program' | 'proposal';
interface Proposal {
  program: Program;
  changes: ProgramChange[];
  baseVersionId: string | null;
  skippedPatterns: string[];
}

const rejectText = (r: TrainingResult<unknown>) =>
  r.status === 'rejected' ? (TRAINING_REJECT_LABELS[r.reason] ?? 'İşlem yapılamadı.') : null;

function rewardText(reward: CompletionResult): string {
  if (reward.status === 'awarded') return `Antrenman kaydedildi. Ana görev tamamlandı: +${reward.entry.awardedXp} XP.`;
  if (reward.status === 'already-completed') return 'Antrenman kaydedildi. Bugünün ana görevi zaten tamamlanmıştı; ek XP yok.';
  return `Antrenman kaydedildi. ${TRAINING_REJECT_LABELS[reward.reason]}`;
}

function Training() {
  const { service, dataVersion, act } = useAvci();
  const [snap, setSnap] = useState<TrainingSnapshot | null>(null);
  const [mode, setMode] = useState<Mode>('main');
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!service) return;
    let cancelled = false;
    service
      .loadTraining()
      .then((s) => !cancelled && (setSnap(s), setLoadError(null)))
      .catch((e: unknown) => !cancelled && setLoadError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [service, dataVersion]);

  /** Runs a mutation through the shared context (which reloads every screen). */
  const run = useCallback(
    async <T,>(fn: () => Promise<TrainingResult<T>>): Promise<TrainingResult<T> | null> => {
      if (busy) return null;
      setBusy(true);
      try {
        return (await act(fn)) as TrainingResult<T>;
      } catch (e) {
        setMessage(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [act, busy],
  );

  const openProposal = useCallback(async () => {
    if (!service) return;
    const r = await service.proposeGeneratedProgram();
    if (r.status === 'ok') {
      setProposal(r.value);
      setMode('proposal');
    } else setMessage(rejectText(r));
  }, [service]);

  if (loadError) {
    return (
      <Screen title="Antrenman">
        <Card accent={C.danger}>
          <Text style={T.body}>Antrenman kayıtları okunamadı: {loadError}</Text>
        </Card>
      </Screen>
    );
  }
  if (!snap || !service) return null;

  if (!snap.profile) {
    return (
      <Screen title="Antrenman">
        <Card>
          <Text style={T.body}>Önce Bugün sekmesinden profilini oluştur.</Text>
        </Card>
      </Screen>
    );
  }

  const messageView = message && (
    <Text style={[T.body, { color: C.accent }]} accessibilityLiveRegion="polite" testID="training-message">
      {message}
    </Text>
  );

  // 1) Confirm training facts.
  if (!snap.trainingProfile || mode === 'edit-profile') {
    return (
      <Screen title="Antrenman bilgileri">
        {messageView}
        <TrainingProfileForm
          initial={snap.trainingProfile}
          isDraft={!snap.trainingProfile}
          onCancel={snap.trainingProfile ? () => setMode('main') : undefined}
          onConfirm={async (input) => {
            const r = await run(() => service.confirmTrainingProfile(input));
            if (!r || r.status !== 'ok') return r ? rejectText(r) : null;
            setMessage('Antrenman bilgilerin kaydedildi.');
            const fresh = await service.loadTraining();
            if (!fresh.plan || fresh.planIssue) await openProposal();
            else setMode('main');
            return null;
          }}
        />
      </Screen>
    );
  }

  // 2) Accept a generated program (first time, after a profile change, or on request).
  if (mode === 'proposal' || !snap.plan) {
    if (!proposal) {
      return (
        <Screen title="Program">
          {messageView}
          <Card>
            <Text style={T.body}>Onayladığın bilgilere göre bir program önerisi hazırlanabilir.</Text>
            <Button label="Program önerisini göster" onPress={openProposal} />
          </Card>
        </Screen>
      );
    }
    return (
      <Screen title="Program önerisi">
        {messageView}
        <ProposalPreview
          program={proposal.program}
          changes={proposal.changes}
          hasCurrent={proposal.baseVersionId !== null}
          skippedPatterns={proposal.skippedPatterns}
          onCancel={snap.plan ? () => (setMode('main'), setProposal(null)) : undefined}
          onAccept={async () => {
            const r = await run(() =>
              service.acceptProgram({ baseVersionId: proposal.baseVersionId, program: proposal.program, source: 'generated' }),
            );
            if (r?.status === 'ok') {
              setMessage('Program kabul edildi ve kaydedildi.');
              setProposal(null);
              setMode('main');
            } else if (r) setMessage(rejectText(r));
          }}
        />
      </Screen>
    );
  }

  // 3) Resume / continue the unfinished workout.
  if (snap.active) {
    const sessionId = snap.active.session.id;
    return (
      <Screen title="Antrenman">
        {messageView}
        <WorkoutLogger
          notices={[
            ...(snap.illnessToday ? [`${TRAINING_REJECT_LABELS.illness} Bu antrenmanı bırakabilirsin; setlerin saklanır.`] : []),
            ...(snap.jointPainToday ? [JOINT_PAIN_NOTICE] : []),
            ...(snap.today && snap.active.session.taskDayId !== snap.today.id
              ? ['Bu antrenman önceki görev gününde başladı. Kaydedebilirsin ama bugünün ödülünü vermez.']
              : []),
          ]}
          active={snap.active}
          lastPerformance={snap.lastPerformance}
          busy={busy}
          onLog={async (input: SetInput) => {
            const r = await run(() => service.logSet(sessionId, input));
            if (r?.status === 'ok') {
              setMessage(`Set kaydedildi (${input.kind === 'work' ? 'çalışma' : 'ısınma'}).`);
              return true;
            }
            if (r) setMessage(rejectText(r));
            return false;
          }}
          onDelete={async (setId) => {
            const r = await run(() => service.deleteSet(setId));
            setMessage(r?.status === 'ok' ? 'Set silindi.' : r ? rejectText(r) : null);
          }}
          onFinish={async () => {
            const r = await run(() => service.finishWorkout(sessionId));
            if (r?.status === 'ok') setMessage(rewardText(r.value.reward));
            else if (r) setMessage(rejectText(r));
          }}
          onAbandon={async () => {
            const r = await run(() => service.abandonWorkout(sessionId));
            setMessage(r?.status === 'ok' ? 'Antrenman bırakıldı. Kaydedilen setler saklandı; ceza veya borç yok.' : r ? rejectText(r) : null);
          }}
        />
      </Screen>
    );
  }

  // 4) Edit the weekly program.
  if (mode === 'edit-program') {
    const plan = snap.plan;
    return (
      <Screen title="Programı düzenle">
        <ProgramEditor
          initial={plan.program}
          facts={snap.trainingProfile}
          onCancel={() => setMode('main')}
          onAccept={async (program) => {
            const r = await run(() => service.acceptProgram({ baseVersionId: plan.id, program, source: 'user-edit' }));
            if (r?.status === 'ok') {
              setMessage('Program güncellendi. Yeni sürüm kaydedildi.');
              setMode('main');
              return null;
            }
            if (r?.status === 'rejected' && r.reason === 'invalid' && r.detail && r.detail in PROGRAM_ERROR_LABELS) {
              return PROGRAM_ERROR_LABELS[r.detail as keyof typeof PROGRAM_ERROR_LABELS];
            }
            return r ? rejectText(r) : null;
          }}
        />
      </Screen>
    );
  }

  // 5) Week overview.
  const today = snap.today!;
  return (
    <Screen title="Antrenman">
      {messageView}
      {snap.planIssue && (
        <Card accent={C.warning}>
          <Text style={T.body}>{PROGRAM_ERROR_LABELS[snap.planIssue]} Antrenman başlatmadan önce programı güncelle.</Text>
          <Button label="Yeni program önerisini göster" onPress={openProposal} />
        </Card>
      )}
      {snap.illnessToday && (
        <Card accent={C.recovery}>
          <Text style={T.body}>{TRAINING_REJECT_LABELS.illness}</Text>
        </Card>
      )}
      {snap.jointPainToday && (
        <Card accent={C.warning}>
          <Text style={T.body}>{JOINT_PAIN_NOTICE}</Text>
        </Card>
      )}
      {snap.coreCompleted && (
        <Text style={T.muted}>Bugünün ana görevi tamamlandı. Yeni bir antrenman kaydı ek XP vermez.</Text>
      )}
      <WeekView
        week={snap.week}
        weekStart={snap.weekStart!}
        today={today.localDate}
        activeSlotId={null}
        onStart={async (slotId) => {
          const r = await run(() => service.startWorkout(slotId));
          setMessage(r?.status === 'ok' ? 'Antrenman başladı.' : r ? rejectText(r) : null);
        }}
        onMove={async (slotId, toDate) => {
          const r = await run(() => service.moveSession(slotId, toDate));
          setMessage(r?.status === 'ok' ? 'Antrenman taşındı. Kaçırılan veya taşınan gün borç oluşturmaz.' : r ? rejectText(r) : null);
        }}
      />
      <Card>
        <Text style={T.h3}>Program</Text>
        <ExposureNote program={snap.plan.program} />
        <Text style={T.muted}>Program sürümü {snap.planCount}. Her değişiklik önizlenir ve onayınla yeni sürüm olarak saklanır.</Text>
        <View style={T.row}>
          <Button label="Programı düzenle" variant="secondary" onPress={() => setMode('edit-program')} />
          <Button label="Antrenman bilgilerini düzenle" variant="secondary" onPress={() => setMode('edit-profile')} />
          <Button label="Yeni öneri oluştur" variant="secondary" onPress={openProposal} />
        </View>
      </Card>
    </Screen>
  );
}
