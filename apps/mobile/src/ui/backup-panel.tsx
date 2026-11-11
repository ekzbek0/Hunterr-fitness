import { useState } from 'react';
import { Text, View } from 'react-native';

import { COUNT_LABELS } from '@/domain/backup/summary';
import { pickBackupFile, saveBackupFile, sweepBackupTemp, TEMP_LEFT_NOTICE } from '@/platform/backup-file';
import type { BackupService, ImportPreview } from '@/services/backup-service';
import { formatBackupError } from '@/ui/backup-errors';
import { Button, Card, T } from '@/ui/components';
import { formatDate } from '@/ui/labels';
import { C } from '@/ui/theme';

type Msg = { text: string; tone: 'ok' | 'error' } | null;

/** Export, restore (with impact preview and explicit confirmation) and delete-all. */
export function BackupPanel({
  backup,
  afterChange,
  cancelReminders,
}: {
  backup: BackupService;
  /** Reloads every screen and reconciles reminders after data was replaced. */
  afterChange: () => Promise<void>;
  cancelReminders: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [picked, setPicked] = useState<{ name: string; text: string; preview: ImportPreview } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setMsg({ text: formatBackupError(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const doExport = () =>
    run(async () => {
      const out = await backup.exportBackup();
      const saved = await saveBackupFile(out.fileName, out.json);
      const parts = [
        saved.outcome === 'downloaded'
          ? `Yedek indirildi: ${out.fileName} (${out.summary.totalXp} XP, ${out.summary.counts.sessions} antrenman).`
          : `Yedek hazırlandı: ${out.fileName}. Paylaşım menüsünden bir konum seçtiysen oraya kaydedildi.`,
      ];
      if (out.issues.length > 0) {
        parts.push(`Uyarı: mevcut kayıtlarda ${out.issues.length} tutarsızlık var; bu dosya geri yüklemede reddedilebilir (${out.issues[0].message})`);
      }
      if (!saved.tempCopyRemoved) parts.push(TEMP_LEFT_NOTICE);
      setMsg({ text: parts.join(' '), tone: out.issues.length > 0 || !saved.tempCopyRemoved ? 'error' : 'ok' });
    });

  const doPick = () =>
    run(async () => {
      setMsg(null);
      const file = await pickBackupFile();
      if (!file) return;
      if (!file.tempCopyRemoved) setMsg({ text: TEMP_LEFT_NOTICE, tone: 'error' });
      setPicked({ name: file.name, text: file.text, preview: await backup.previewImport(file.text) });
    });

  const doRestore = () =>
    run(async () => {
      if (!picked) return;
      const r = await backup.importBackup(picked.text);
      if (r.status === 'restored') {
        setPicked(null);
        setMsg({ text: `Geri yükleme tamamlandı. Toplam ${r.summary.totalXp} XP.`, tone: 'ok' });
        await afterChange();
      } else if (r.status === 'rejected') {
        setMsg({ text: `Dosya reddedildi; mevcut verilerin değişmedi. ${r.errors[0]?.message ?? ''}`, tone: 'error' });
      } else {
        setMsg({ text: r.message, tone: 'error' });
      }
    });

  const doDelete = () =>
    run(async () => {
      const r = await backup.deleteAllData(cancelReminders);
      setConfirmDelete(false);
      if (r.status === 'deleted') {
        setPicked(null);
        const tempsGone = sweepBackupTemp();
        const parts = ['Uygulamadaki tüm AVCI kayıtları ve planlı hatırlatıcılar silindi.'];
        if (!r.storagePurged) parts.push('Depolama katmanı, silinen kayıtların izlerinin dosyadan tamamen temizlendiğini doğrulayamıyor.');
        if (!tempsGone) parts.push(TEMP_LEFT_NOTICE);
        parts.push('Dışa aktardığın yedek dosyaları ve daha önce alınmış cihaz/iCloud yedekleri bu işlemle silinmez.');
        setMsg({ text: parts.join(' '), tone: r.storagePurged && tempsGone ? 'ok' : 'error' });
        await afterChange();
      } else {
        setMsg({ text: r.message, tone: 'error' });
      }
    });

  const preview = picked?.preview;
  return (
    <Card>
      <Text style={T.h3}>Yedekleme ve geri yükleme</Text>
      <Text style={T.muted}>
        Yedek, bu cihazdaki tüm kayıtları (görevler, günlük kontroller, antrenman profili, program sürümleri, setler, XP
        defteri, öneri kararları, ölçümler, ayarlar) sürümlü tek bir dosyaya yazar. Sildiğin ölçümler yedeğe girmez. Dosya
        şifrelenmez ve sağlık verisi içerir; güvendiğin bir yerde sakla.
      </Text>
      <Button label="Yedeği dışa aktar" disabled={busy} onPress={doExport} testID="backup-export" />
      <Button label="Yedek dosyası seç" variant="secondary" disabled={busy} onPress={doPick} testID="backup-pick" />

      {picked && preview && !preview.ok && (
        <View style={{ gap: 4 }} testID="backup-rejected">
          <Text style={[T.body, { color: C.danger }]}>
            “{picked.name}” geri yüklenemez; mevcut verilerine dokunulmadı. {preview.totalErrors} sorun bulundu:
          </Text>
          {preview.errors.slice(0, 5).map((e, i) => (
            <Text key={i} style={T.muted}>
              • {e.message}
              {e.path ? ` (${e.path})` : ''}
            </Text>
          ))}
          <Button label="Kapat" variant="secondary" onPress={() => setPicked(null)} />
        </View>
      )}

      {picked && preview?.ok && (
        <View style={{ gap: 6 }} testID="backup-preview">
          <Text style={T.label}>Geri yükleme önizlemesi</Text>
          <Text style={T.body}>
            {picked.name} · dışa aktarma {new Date(preview.exportedAt).toLocaleString('tr-TR')}
            {preview.backup.firstDate && preview.backup.lastDate
              ? ` · kayıtlar ${formatDate(preview.backup.firstDate)} – ${formatDate(preview.backup.lastDate)}`
              : ''}
          </Text>
          {!preview.current && (
            <Text style={[T.body, { color: C.danger }]} testID="backup-current-unreadable">
              Mevcut kayıtlar okunamadığı için şu anki kayıt sayıları ve XP bilinmiyor. Geri yükleme, okunamayanlar dahil
              tüm mevcut kayıtların yerine bu yedeği yazacak. Onaylamadan önce yedekteki tarihleri ve sayıları kontrol et.
            </Text>
          )}
          <Text style={T.body} testID="backup-preview-xp">
            Toplam XP: şimdi {preview.current?.totalXp ?? 'bilinmiyor'} → geri yüklemeden sonra {preview.backup.totalXp}
          </Text>
          {COUNT_LABELS.map(([key, label]) => (
            <Text key={key} style={T.muted}>
              {label}: şimdi {preview.current?.counts[key] ?? 'bilinmiyor'} → sonra {preview.backup.counts[key]}
            </Text>
          ))}
          <Text style={T.muted} testID="backup-preview-reminders">
            Hatırlatıcılar:{' '}
            {preview.backupReminders.enabled && preview.backupReminders.times.length > 0
              ? `yedekte açık (${preview.backupReminders.times.join(', ')}); bildirim izni varsa geri yüklemeden sonra yeniden planlanır`
              : 'yedekte kapalı'}
          </Text>
          <Text style={[T.body, { color: C.warning }]}>{preview.notice}</Text>
          <View style={T.row}>
            <Button label="Geri yüklemeyi onayla" disabled={busy} onPress={doRestore} testID="backup-restore-confirm" />
            <Button label="Vazgeç" variant="secondary" disabled={busy} onPress={() => setPicked(null)} />
          </View>
        </View>
      )}

      <Text style={T.label}>Tüm yerel verileri sil</Text>
      <Text style={T.muted}>
        Uygulamadaki tüm AVCI kayıtlarını, planlı ve gösterilmiş hatırlatıcıları siler. Geri alınamaz; hiçbir şey
        kendiliğinden geri yüklenmez. Dışa aktardığın yedek dosyalarına ve daha önce alınmış cihaz/iCloud yedeklerine
        uygulama dokunamaz; onları sen silersin. Önce yedek almak isteyebilirsin.
      </Text>
      {confirmDelete ? (
        <View style={T.row}>
          <Button label="Evet, her şeyi kalıcı olarak sil" disabled={busy} onPress={doDelete} testID="delete-all-confirm" />
          <Button label="Vazgeç" variant="secondary" disabled={busy} onPress={() => setConfirmDelete(false)} />
        </View>
      ) : (
        <Button label="Tüm yerel verileri sil" variant="secondary" disabled={busy} onPress={() => setConfirmDelete(true)} testID="delete-all" />
      )}
      {msg && (
        <Text style={[T.body, { color: msg.tone === 'ok' ? C.success : C.danger }]} testID="backup-message" accessibilityLiveRegion="polite">
          {msg.text}
        </Text>
      )}
    </Card>
  );
}
