// Web M3 acceptance: rest timer clock-rollback regression (never extended, uncertain
// state persists across a restart), read-aloud with honest fallback and an off switch,
// reminders unsupported on web, Gelişim tab, backup export/restore/corrupt file, delete all.
// Usage: npm run export:web && node e2e/web-m3.mjs
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const dist = new URL('../dist/', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.ico': 'image/x-icon', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(dist, path);
  if (!file.startsWith(dist) || !existsSync(file) || path.endsWith('/')) file = join(dist, 'index.html');
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;
const profileDir = mkdtempSync(join(tmpdir(), 'avci-web-m3-'));
const shots = process.env.AVCI_SHOTS;
const START = new Date('2026-11-09T06:00:00Z'); // 09:00 in Istanbul, Monday

async function launch(time = START) {
  const ctx = await chromium.launchPersistentContext(profileDir, {
    viewport: { width: 390, height: 844 },
    timezoneId: 'Europe/Istanbul',
    locale: 'tr-TR',
  });
  await ctx.clock.install({ time });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  return { ctx, page, errors };
}
const check = (cond, msg) => {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('ok -', msg);
};
const tab = (page, name) => page.getByRole('tab', { name }).click();
const xp = (page) => page.getByTestId('xp-total').innerText();
const EX = 'Halter bench press';
const day = (d, hh = '06') => new Date(`${d}T${hh}:00:00Z`); // 09:00 Istanbul

async function logSet(page, { reps = 12, load = 60, rir = 2 } = {}) {
  await page.getByLabel(`${EX} set türü`).getByRole('radio', { name: 'Çalışma seti' }).click();
  await page.getByLabel(`${EX} tekrar`, { exact: true }).fill(String(reps));
  await page.getByLabel(`${EX} ağırlık`, { exact: true }).fill(String(load));
  await page.getByLabel(`${EX} birim`).getByRole('radio', { name: 'kg' }).click();
  await page.getByLabel(`${EX} RIR`).getByRole('radio', { name: String(rir), exact: true }).click();
  await page.getByRole('button', { name: `${EX}: çalışma setini kaydet` }).click();
  await page.getByTestId('training-message').getByText('Set kaydedildi').waitFor();
}
async function checkinToday(page) {
  await tab(page, 'Bugün');
  await page.getByRole('button', { name: 'Kontrolü kaydet' }).click();
  await page.getByText('+10 XP kaydedildi.').waitFor();
}
async function trainBench(page, title) {
  await tab(page, 'Antrenman');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: `Antrenmana başla: ${title}` }).filter({ visible: true }).click();
  await page.getByTestId('workout-summary').waitFor();
  for (let i = 0; i < 3; i++) await logSet(page);
  await page.getByRole('button', { name: 'Antrenmanı bitir' }).click();
  await page.getByText('Ana görev tamamlandı').waitFor();
}


// ---------- M3 part A: rest timer clock rollback, speech, reminders on web ----------
const restText = (page) => page.getByTestId('rest-remaining').innerText();

try {
  let { ctx, page, errors } = await launch(day('2026-11-09'));
  await page.getByRole('button', { name: 'Başla' }).click();
  await page.getByTestId('xp-total').waitFor();

  // Speech: user-initiated button exists; in headless Chromium there is no Turkish voice,
  // so the app must say so and keep working as text.
  await page.getByRole('button', { name: 'Görevleri sesli oku' }).click();
  await page.getByTestId('speak-quests-unavailable').waitFor();
  const why = await page.getByTestId('speak-quests-unavailable').innerText();
  check(/Türkçe ses bulunamadı|kullanılamıyor/.test(why), `no Turkish voice -> text fallback is stated (${why.slice(0, 40)}…)`);

  await checkinToday(page);
  await tab(page, 'Antrenman');
  await page.getByRole('button', { name: 'Bilgileri onayla' }).click();
  await page.getByRole('button', { name: 'Programı kabul et' }).click();
  await page.getByText('Program kabul edildi').waitFor();
  await page.getByRole('button', { name: 'Antrenmana başla: İtiş A' }).click();
  await page.getByTestId('workout-summary').waitFor();
  await logSet(page);

  // Regression: 90 s rest, 60 s pass -> 30 s left; clock set back 30 s -> NOT 60 s.
  await page.getByRole('button', { name: '1:30 dinlen' }).click();
  await page.getByTestId('rest-remaining').getByText(/Kalan 1:(30|29)/).waitFor();
  await page.clock.runFor(60_000);
  await page.getByTestId('rest-remaining').getByText(/Kalan 0:(30|29)/).waitFor();
  check(true, 'after 60 s of a 90 s rest, 30 s remain');
  const now = await page.evaluate(() => Date.now());
  await page.clock.setSystemTime(new Date(now - 30_000));
  await page.clock.runFor(1500);
  await page.getByText('Cihaz saati geri alındı').waitFor();
  const shown = await restText(page);
  check(!/Kalan 1:00|Kalan 0:5\d|Kalan 0:[3-4]\d/.test(shown), 'clock set back 30 s: remaining time is not extended (no "Kalan 1:00")');
  if (shots) await page.screenshot({ path: `${shots}/dinlenme-belirsiz.png`, fullPage: true });
  await page.clock.runFor(6000); // persisted
  await ctx.close();

  ({ ctx, page, errors } = await launch(new Date(now - 20_000)));
  await page.getByRole('button', { name: 'Antrenmana devam et: İtiş A' }).click();
  await page.getByTestId('rest-remaining').waitFor();
  check((await restText(page)).includes('Cihaz saati geri alındı'), 'reopened app shows the same uncertain state');
  await page.getByRole('button', { name: '1:00 dinlen' }).click();
  await page.getByTestId('rest-remaining').getByText(/Kalan (1:00|0:59)/).waitFor();
  check(true, 'restarting the rest gives a fresh, known countdown');

  // Reminders: web preview must not pretend notifications work.
  await tab(page, 'Ayarlar');
  await page.getByTestId('reminders-unsupported').waitFor();
  check((await page.getByTestId('reminders-unsupported').innerText()).includes('desteklenmiyor'), 'web says notifications are not supported');
  // Speech can be turned off: the button disappears.
  await page.getByRole('checkbox', { name: 'Sesli okuma açık' }).click();
  await page.getByRole('checkbox', { name: 'Sesli okuma kapalı' }).waitFor();
  await tab(page, 'Bugün');
  await page.getByTestId('xp-total').waitFor();
  check((await page.getByRole('button', { name: 'Görevleri sesli oku' }).count()) === 0, 'speech off hides the read-aloud button');
  await page.reload();
  await page.getByTestId('xp-total').waitFor();
  check((await page.getByRole('button', { name: 'Görevleri sesli oku' }).count()) === 0, 'speech setting persists after reload');
  check(errors.length === 0, `no page errors (part A): ${errors.join(' | ')}`);
  await ctx.close();

  // ---------- M3 part B: Gelişim, backup / restore / corrupt file, delete all ----------
  ({ ctx, page, errors } = await launch(new Date('2026-11-09T06:10:00Z')));
  await page.getByRole('button', { name: 'Antrenmana devam et: İtiş A' }).click();
  await page.getByTestId('workout-summary').waitFor();
  await page.getByLabel(`${EX} set türü`).getByRole('radio', { name: 'Isınma seti' }).click();
  await page.getByLabel(`${EX} tekrar`, { exact: true }).fill('10');
  await page.getByLabel(`${EX} ağırlık`, { exact: true }).fill('20');
  await page.getByRole('button', { name: new RegExp(`${EX}: ısınma setini kaydet`) }).click();
  await page.getByTestId('training-message').getByText('Set kaydedildi').waitFor();
  await page.getByRole('button', { name: 'Antrenmanı bitir' }).click();
  await page.getByText('Ana görev tamamlandı').waitFor();

  await tab(page, 'Gelişim');
  await page.getByTestId('progress-chart').first().waitFor();
  const chartLabel = await page.getByTestId('progress-chart').first().getAttribute('aria-label');
  check(chartLabel.includes(EX) && chartLabel.includes('kg'), `per-exercise chart is labelled with unit and load type (${chartLabel.slice(0, 60)}…)`);
  check((await page.getByTestId('history-row').count()) === 1, 'history lists the finished workout');
  const hist = await page.getByTestId('history-row').first().innerText();
  check(/1 çalışma/i.test(hist) && /1 ısınma/i.test(hist), `history keeps work and warm-up sets apart (${hist.replace(/\n/g, ' ').slice(0, 70)})`);
  const summary = await page.getByTestId('continuity-summary').innerText();
  check(summary.includes('1 antrenman'), `continuity counts the day (${summary})`);
  await page.getByLabel('Ölçüm değeri').fill('72,5');
  await page.getByRole('button', { name: 'Ölçümü kaydet' }).click();
  await page.getByTestId('measurement-row').first().waitFor();
  check((await page.getByTestId('measurement-row').count()) === 1, 'dated measurement saved (72,5)');
  if (shots) await page.screenshot({ path: `${shots}/gelisim.png`, fullPage: true });

  await tab(page, 'Bugün');
  const xpAtExport = await xp(page);
  check(xpAtExport.includes('Toplam 70 XP'), `XP before export: ${xpAtExport}`);
  await tab(page, 'Ayarlar');
  // Inject a synthetic platform failure at the UI boundary. No real user path
  // is used; the next export restores the original API and still downloads.
  await page.evaluate(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = () => {
      URL.createObjectURL = original;
      throw new Error('file:///synthetic-private/backup.json');
    };
  });
  await page.getByTestId('backup-export').click();
  const failureNotice = page.getByTestId('backup-message');
  await failureNotice.getByText('İşlem sırasında hata oluştu. Kayıtların son durumunu kontrol edip tekrar dene.', { exact: true }).waitFor();
  check(!(await failureNotice.innerText()).includes('synthetic-private'), 'backup failure hides raw platform path and offers retry');

  const dl = page.waitForEvent('download');
  await page.getByTestId('backup-export').click();
  const download = await dl;
  const backupPath = join(profileDir, 'yedek.json');
  await download.saveAs(backupPath);
  const env = JSON.parse(readFileSync(backupPath, 'utf8'));
  check(download.suggestedFilename() === 'avci-yedek-2026-11-09.json' && env.format === 'avci-backup' && env.version === 1, 'versioned backup file downloaded');
  check(env.data.sets.length === 2 && env.data.ledger.length === 2 && env.data.measurements.length === 1 && env.data.plans.length >= 1, 'backup holds sets, XP ledger, plan versions and measurements');

  // Change data after the export so a restore is visible.
  await tab(page, 'Bugün');
  await page.getByRole('button', { name: /Yaptım/ }).first().click();
  await page.getByTestId('xp-total').getByText('Toplam 85 XP').waitFor();

  const pick = async (path) => {
    await tab(page, 'Ayarlar');
    const fc = page.waitForEvent('filechooser');
    await page.getByTestId('backup-pick').click();
    await (await fc).setFiles(path);
  };
  // Corrupt file: tampered XP (checksum no longer matches) -> rejected, nothing changes.
  const corruptPath = join(profileDir, 'bozuk.json');
  env.data.ledger[0].awardedXp = 99999;
  writeFileSync(corruptPath, JSON.stringify(env));
  await pick(corruptPath);
  await page.getByTestId('backup-rejected').waitFor();
  check((await page.getByTestId('backup-restore-confirm').count()) === 0, 'corrupt file cannot be restored');
  const unsupportedPath = join(profileDir, 'yeni-surum.json');
  writeFileSync(unsupportedPath, readFileSync(backupPath, 'utf8').replace('"version": 1', '"version": 2'));
  await page.getByRole('button', { name: 'Kapat' }).click();
  await pick(unsupportedPath);
  await page.getByTestId('backup-rejected').waitFor();
  await tab(page, 'Bugün');
  check((await xp(page)).includes('Toplam 85 XP'), 'corrupt and unsupported files left the data unchanged (85 XP)');

  await pick(backupPath);
  await page.getByTestId('backup-preview').waitFor();
  const impact = await page.getByTestId('backup-preview-xp').innerText();
  check(impact.includes('85') && impact.includes('70'), `impact preview before restore: ${impact}`);
  check((await page.getByTestId('backup-preview').innerText()).includes('TÜM mevcut kayıtlar'), 'preview states that restore replaces all data');
  if (shots) await page.screenshot({ path: `${shots}/yedek-onizleme.png`, fullPage: true });
  await page.getByTestId('backup-restore-confirm').click();
  await page.getByTestId('backup-message').getByText('Geri yükleme tamamlandı').waitFor();
  await tab(page, 'Bugün');
  await page.getByTestId('xp-total').getByText('Toplam 70 XP').waitFor();
  check(true, 'restore brought back the exported state (70 XP)');
  await pick(backupPath);
  await page.getByTestId('backup-restore-confirm').click();
  await page.getByTestId('backup-message').getByText('Geri yükleme tamamlandı').waitFor();
  await page.reload();
  await tab(page, 'Bugün');
  await page.getByTestId('xp-total').getByText('Toplam 70 XP').waitFor();
  check(true, 'second import of the same file does not double XP (70 XP after reload)');
  await tab(page, 'Gelişim');
  await page.getByTestId('measurement-row').first().waitFor();
  check((await page.getByTestId('history-row').count()) === 1, 'restored history and measurement are shown');

  // Delete all: two steps, then the app is empty and stays empty.
  await tab(page, 'Ayarlar');
  await page.getByTestId('delete-all').click();
  await page.getByTestId('delete-all-confirm').click();
  await page.getByTestId('backup-message').getByText('silindi').waitFor();
  await tab(page, 'Bugün');
  await page.getByRole('button', { name: 'Başla' }).waitFor();
  await ctx.close();
  ({ ctx, page, errors } = await launch(new Date('2026-11-09T06:20:00Z')));
  await page.getByRole('button', { name: 'Başla' }).waitFor();
  check(true, 'after delete-all and a browser restart the app starts empty (no automatic restore)');
  await tab(page, 'Gelişim');
  await page.waitForTimeout(500);
  check((await page.getByTestId('history-row').count()) === 0 && (await page.getByTestId('measurement-row').count()) === 0, 'no history or measurements remain');
  // A backup can be restored on the empty install.
  await pick(backupPath);
  await page.getByTestId('backup-restore-confirm').click();
  await page.getByTestId('backup-message').getByText('Geri yükleme tamamlandı').waitFor();
  await tab(page, 'Bugün');
  await page.getByTestId('xp-total').getByText('Toplam 70 XP').waitFor();
  check(true, 'restore works on an empty install');
  check(errors.length === 0, `no page errors (part B): ${errors.join(' | ')}`);
  await ctx.close();
  console.log('PASS web M3 flow');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  server.close();
  rmSync(profileDir, { recursive: true, force: true });
}
