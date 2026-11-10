import { useMemo, useState } from 'react';

import type { Profile } from '@/data/types';
import { Text, View } from 'react-native';

import { MULTIPLIER_HALVES, multiplierLabel, type MultiplierHalves } from '@/domain/game/economy';
import { HABIT_CATALOG } from '@/domain/game/quests';
import { BackupService } from '@/services/backup-service';
import { useAvci } from '@/ui/avci-context';
import { BackupPanel } from '@/ui/backup-panel';
import { ReminderSettings, SpeechSettings } from '@/ui/settings/m3-settings';
import { Button, Card, Chip, Screen, StorageGate, T } from '@/ui/components';
import { C } from '@/ui/theme';

export default function SettingsScreen() {
  const { status } = useAvci();
  // Loading uses the shared gate. An error does NOT hide this screen: the data
  // section is the user's way out when the stored records cannot be opened.
  if (status === 'loading') {
    return (
      <StorageGate>
        <></>
      </StorageGate>
    );
  }
  return <Settings />;
}

function Settings() {
  const { snapshot, status, error, retry, repo } = useAvci();
  const [saved, setSaved] = useState<string | null>(null);
  const broken = status === 'error';
  const profile = broken ? null : snapshot?.profile;
  // One stable tree: the data section keeps its state (and messages) when the profile
  // appears or disappears (restore on a fresh install, delete all, recovery from an error).
  return (
    <Screen title="Ayarlar">
      {broken ? (
        <Card accent={C.danger}>
          <View testID="storage-error" style={{ gap: 8 }}>
            <Text style={T.h3}>Kayıtlar açılamadı</Text>
            <Text style={T.muted}>{error}</Text>
            <Text style={T.body}>
              {repo
                ? 'Önce tekrar dene. Sorun sürerse aşağıdan mevcut kayıtların yedeğini alabilir, sağlam bir yedeği geri yükleyebilir ya da tüm verileri silip baştan başlayabilirsin. Hiçbir kayıt kendiliğinden silinmez veya onarılmaz.'
                : 'Depolama hiç açılamadığı için yedekleme ve silme de kullanılamıyor. Tekrar dene; sorun sürerse uygulamayı kapatıp yeniden aç.'}
            </Text>
            <Button label="Tekrar dene" onPress={retry} />
          </View>
        </Card>
      ) : profile ? (
        // Re-key on save so the form re-initialises from the stored profile.
        <SettingsForm key={profile.confirmedAt} profile={profile} saved={saved} setSaved={setSaved} />
      ) : (
        <Card>
          <Text style={T.body}>
            Oyun ayarları profilini oluşturduktan sonra açılır. Bir yedeğin varsa aşağıdan geri yükleyebilirsin.
          </Text>
        </Card>
      )}
      {!broken && <SpeechSettings />}
      {!broken && profile && <ReminderSettings />}
      <DataSection timezone={profile ? (snapshot?.today?.timezone ?? profile.timezone) : undefined} />
    </Screen>
  );
}

function SettingsForm({
  profile,
  saved,
  setSaved,
}: {
  profile: Profile;
  saved: string | null;
  setSaved: (msg: string | null) => void;
}) {
  const { act } = useAvci();
  const [mult, setMult] = useState<MultiplierHalves>(profile.multiplierHalves);
  const [habits, setHabits] = useState<string[]>(profile.habitKeys);
  const toggle = (key: string) =>
    setHabits((h) => (h.includes(key) ? h.filter((k) => k !== key) : h.length < 2 ? [...h, key] : [h[1], key]));
  const dirty = mult !== profile.multiplierHalves || habits.join() !== profile.habitKeys.join();

  return (
    <>
      <Card>
        <Text style={T.h3}>XP çarpanı</Text>
        <View style={T.row} accessibilityRole="radiogroup">
          {MULTIPLIER_HALVES.map((h) => (
            <Chip key={h} label={multiplierLabel(h)} selected={h === mult} onPress={() => setMult(h)} />
          ))}
        </View>
        <Text style={T.muted}>
          Çarpan yalnızca oyundaki XP ödülünü değiştirir; set, tekrar, ağırlık veya kardiyo miktarını asla değiştirmez.
          Yeni değer bir sonraki görev gününden itibaren geçerlidir; bugünün ve geçmişin ödülleri değişmez.
        </Text>
      </Card>
      <Card>
        <Text style={T.h3}>Alışkanlık görevleri (iki tane)</Text>
        <View style={T.row} accessibilityRole="radiogroup">
          {HABIT_CATALOG.map((h) => (
            <Chip key={h.key} label={h.title} selected={habits.includes(h.key)} onPress={() => toggle(h.key)} />
          ))}
        </View>
        <Text style={T.muted}>Değişiklik ertesi gün geçerli olur; aynı gün görev değiştirerek ek XP kazanılmaz.</Text>
      </Card>
      <Button
        label="Kaydet"
        disabled={!dirty || habits.length !== 2}
        onPress={async () => {
          await act((s) => s.updateSettings({ multiplierHalves: mult, habitKeys: habits }));
          setSaved('Kaydedildi. Yarınki görev gününden itibaren uygulanacak.');
        }}
      />
      {saved && <Text style={[T.body, { color: C.success }]}>{saved}</Text>}
    </>
  );
}

function DataSection({ timezone }: { timezone?: string }) {
  const { repo, reminders, refresh } = useAvci();
  const backup = useMemo(() => (repo ? new BackupService(repo) : null), [repo]);
  return (
    <>
      <Card>
        <Text style={T.h3}>Veri</Text>
        <Text style={T.muted}>Depolama: {repo?.kind ?? 'açılamadı'}</Text>
        {timezone && <Text style={T.muted}>Gün sınırı için saat dilimi: {timezone}</Text>}
      </Card>
      {backup && (
        <BackupPanel backup={backup} afterChange={refresh} cancelReminders={() => reminders?.wipe() ?? Promise.resolve()} />
      )}
    </>
  );
}
