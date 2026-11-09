import { Text, View } from 'react-native';

import { MAX_LEVEL, multiplierLabel, type MultiplierHalves } from '@/domain/game/economy';
import { useAvci } from '@/ui/avci-context';
import { Card, Screen, StorageGate, T, XpBar } from '@/ui/components';
import { formatDate, RANK_TITLES, SLOT_LABELS } from '@/ui/labels';
import { C } from '@/ui/theme';

export default function CharacterScreen() {
  return (
    <StorageGate>
      <Character />
    </StorageGate>
  );
}

function Character() {
  const { snapshot } = useAvci();
  if (!snapshot?.profile) {
    return (
      <Screen title="Karakter">
        <Card>
          <Text style={T.body}>Henüz bir avcı profilin yok. Bugün sekmesinden başlayabilirsin.</Text>
        </Card>
      </Screen>
    );
  }
  const { progress, recentLedger, recentDays } = snapshot;
  const dayDate = new Map(recentDays.map((d) => [d.id, d.localDate]));
  return (
    <Screen title="Karakter">
      <Card accent={C.violet} style={{ alignItems: 'center' }}>
        <View
          style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: C.surfaceRaised, borderWidth: 3,
            borderColor: C.violet, alignItems: 'center', justifyContent: 'center' }}
          accessibilityLabel={`Rütbe ${progress.rank} amblemi`}>
          <Text style={{ color: C.text, fontSize: 44, fontWeight: '800' }}>{progress.rank}</Text>
        </View>
        <Text style={T.h2}>{RANK_TITLES[progress.rank]}</Text>
        <Text style={T.body}>
          Seviye {progress.level}
          {progress.level === MAX_LEVEL ? ' (en yüksek)' : ''} · {progress.totalXp} XP
        </Text>
        <View style={{ alignSelf: 'stretch' }}>
          <XpBar fraction={progress.fraction} />
        </View>
        {progress.nextLevelXp !== null && (
          <Text style={T.muted}>Sonraki seviye için {progress.nextLevelXp - progress.totalXp} XP</Text>
        )}
      </Card>
      <Text style={T.muted}>
        Rütbe yalnızca görünümdür; antrenman yükünü, güvenlik uyarılarını veya öğretici içerikleri etkilemez.
      </Text>

      <Card>
        <Text style={T.h3}>XP geçmişi</Text>
        {recentLedger.length === 0 && <Text style={T.muted}>Henüz XP kaydı yok.</Text>}
        {recentLedger.map((e) => (
          <View key={e.id} testID="ledger-row" style={[T.row, { justifyContent: 'space-between' }]}>
            <Text style={T.body}>
              {SLOT_LABELS[e.slotKey] ?? e.slotKey}
              <Text style={T.muted}>
                {' '}
                · {dayDate.get(e.scopeId) ? formatDate(dayDate.get(e.scopeId)!) : e.completedAt.slice(0, 10)}
              </Text>
            </Text>
            <Text style={[T.body, { color: C.success }]}>
              +{e.awardedXp}
              {e.multiplierHalves !== 2 ? ` (${multiplierLabel(e.multiplierHalves as MultiplierHalves)})` : ''}
            </Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
