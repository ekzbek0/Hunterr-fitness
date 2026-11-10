import { useState } from 'react';
import { Text, View } from 'react-native';

import { isValidReminderTime, MAX_REMINDER_TIMES } from '@/domain/reminders/plan';
import type { ReminderSyncResult } from '@/services/reminder-service';
import { useAvci } from '@/ui/avci-context';
import { Button, Card, Chip, Field, T, ToggleChip } from '@/ui/components';
import { C } from '@/ui/theme';

const PRESET_TIMES = ['07:00', '08:00', '12:00', '18:00', '20:00'] as const;

export function SpeechSettings() {
  const { snapshot, act } = useAvci();
  const enabled = snapshot?.settings.speechEnabled ?? true;
  return (
    <Card>
      <Text style={T.h3}>Sesli okuma</Text>
      <Text style={T.muted}>
        Yalnızca sen “Sesli oku” düğmesine bastığında görevleri ve hareket açıklamalarını Türkçe okur; “Durdur” hemen keser.
        Mikrofon kullanılmaz, uygulama seni dinlemez. Kapalıyken düğmeler gizlenir, her şey metin olarak kalır.
      </Text>
      <ToggleChip
        label={enabled ? 'Sesli okuma açık' : 'Sesli okuma kapalı'}
        selected={enabled}
        onPress={() => void act((s) => s.setSpeechEnabled(!enabled))}
      />
    </Card>
  );
}

function syncText(r: ReminderSyncResult | null): { text: string; color: string } | null {
  if (!r) return null;
  switch (r.state) {
    case 'unsupported':
      return { text: 'Bu ortamda bildirim yok.', color: C.textMuted };
    case 'off':
      return { text: 'Hatırlatıcı planlı değil.', color: C.textMuted };
    case 'permission-denied':
      return {
        text:
          'Bildirim izni verilmedi; hatırlatıcı planlanmadı. Uygulama normal çalışır. İstersen iPhone Ayarlar › AVCI › Bildirimler bölümünden izin verebilirsin.',
        color: C.warning,
      };
    case 'scheduled':
      return {
        text: `${r.count} hatırlatıcı planlandı (önümüzdeki 7 gün).${
          r.nextAt
            ? ` Sıradaki: ${new Date(r.nextAt).toLocaleString('tr-TR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}.`
            : ''
        }`,
        color: C.success,
      };
    case 'error':
      return { text: `Hatırlatıcılar güncellenemedi: ${r.message}`, color: C.danger };
  }
}

export function ReminderSettings() {
  const { reminders, reminderSync, snapshot, refresh } = useAvci();
  const stored = snapshot?.settings.reminders ?? { enabled: false, times: [] };
  const [enabled, setEnabled] = useState(stored.enabled);
  const [times, setTimes] = useState<string[]>(stored.times);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReminderSyncResult | null>(null);
  const [busy, setBusy] = useState(false);

  if (!reminders) return null;
  if (!reminders.supported) {
    return (
      <Card>
        <Text style={T.h3}>Hatırlatıcılar</Text>
        <Text style={T.body} testID="reminders-unsupported">
          Web önizlemesinde bildirim desteklenmiyor; burada hatırlatıcı planlanmaz. iPhone uygulamasında seçtiğin saatlerde
          yerel bildirim olarak çalışır (sunucu veya hesap gerekmez).
        </Text>
      </Card>
    );
  }

  const toggleTime = (t: string) => {
    setError(null);
    setTimes((cur) =>
      cur.includes(t) ? cur.filter((x) => x !== t) : cur.length >= MAX_REMINDER_TIMES ? cur : [...cur, t].sort(),
    );
  };
  const dirty = enabled !== stored.enabled || times.join() !== stored.times.join();
  const status = syncText(result ?? reminderSync);

  return (
    <Card>
      <Text style={T.h3}>Hatırlatıcılar</Text>
      <Text style={T.muted}>
        Seçtiğin saatlerde günün görevini hatırlatan yerel bildirim (en fazla {MAX_REMINDER_TIMES} saat). İçerik plana göre
        güncellenir: antrenman günü, planlı toparlanma günü. Görev tamamlandıysa o günün hatırlatıcısı kalkar.
      </Text>
      <ToggleChip label={enabled ? 'Hatırlatıcılar açık' : 'Hatırlatıcılar kapalı'} selected={enabled} onPress={() => setEnabled(!enabled)} />
      {enabled && (
        <>
          <View style={T.row} accessibilityLabel="Hatırlatma saatleri">
            {[...new Set([...PRESET_TIMES, ...times])].sort().map((t) => (
              <Chip key={t} label={t} selected={times.includes(t)} onPress={() => toggleTime(t)} />
            ))}
          </View>
          <View style={[T.row, { alignItems: 'flex-end' }]}>
            <Field label="Başka saat" a11yLabel="Hatırlatma saati" value={custom} onChangeText={setCustom} width={120} placeholder="SS:DD" />
            <Button
              label="Saati ekle"
              variant="secondary"
              onPress={() => {
                const t = custom.trim();
                if (!isValidReminderTime(t)) return setError('Saati SS:DD biçiminde gir (ör. 06:45).');
                if (!times.includes(t) && times.length >= MAX_REMINDER_TIMES) return setError(`En fazla ${MAX_REMINDER_TIMES} saat seçebilirsin.`);
                setError(null);
                setCustom('');
                if (!times.includes(t)) setTimes([...times, t].sort());
              }}
            />
          </View>
        </>
      )}
      {error && <Text style={[T.body, { color: C.danger }]}>{error}</Text>}
      <Button
        label="Hatırlatıcıları kaydet"
        disabled={busy || !dirty || (enabled && times.length === 0)}
        onPress={async () => {
          setBusy(true);
          try {
            setResult(await reminders.save({ enabled, times }));
            await refresh();
          } finally {
            setBusy(false);
          }
        }}
      />
      {status && (
        <Text style={[T.body, { color: status.color }]} testID="reminder-status" accessibilityLiveRegion="polite">
          {status.text}
        </Text>
      )}
    </Card>
  );
}
