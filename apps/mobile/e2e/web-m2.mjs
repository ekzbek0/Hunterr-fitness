// Web M2 acceptance (plus M1 regressions): reorder-only program edit persists;
// rest timer survives a full browser restart (derived from timestamp); weekly review
// +40 XP once; schedule move + conflicting edit refused and shown; two bench sessions
// -> user-confirmed increment -> proposal with reason and before/after -> explicit
// acceptance -> new plan version; level avatar/badges. Clock fixed per day (Istanbul).
// Usage: npm run export:web && node e2e/web-m2.mjs
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
const profileDir = mkdtempSync(join(tmpdir(), 'avci-web-m2-'));
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

try {
  // ---- Monday: setup, reorder (M1 fix), rest timer, weekly review XP ----
  let { ctx, page, errors } = await launch(day('2026-11-09'));
  await page.getByRole('button', { name: 'Başla' }).click();
  await page.getByTestId('xp-total').waitFor();
  await checkinToday(page);
  await tab(page, 'Antrenman');
  await page.getByRole('button', { name: 'Bilgileri onayla' }).click();
  await page.getByRole('button', { name: 'Programı kabul et' }).click();
  await page.getByText('Program kabul edildi').waitFor();

  await page.getByRole('button', { name: 'Programı düzenle' }).click();
  await page.getByRole('button', { name: `${EX} aşağı` }).first().click();
  await page.getByRole('button', { name: 'Önizle' }).click();
  await page.getByTestId('change-list').waitFor();
  check((await page.getByTestId('change-list').innerText()).includes('hareket sırası'), 'reorder-only edit appears in preview');
  await page.getByRole('button', { name: 'Değişiklikleri onayla' }).click();
  await page.getByText('Program sürümü 2').waitFor();
  await page.reload();
  await tab(page, 'Antrenman');
  await page.getByRole('button', { name: 'Programı düzenle' }).click();
  check((await page.getByText(`2. ${EX}`).count()) >= 1, 'reordered program persists after reload (bench is 2nd on İtiş A)');
  await page.getByRole('button', { name: 'Vazgeç' }).click();

  await page.getByRole('button', { name: 'Antrenmana başla: İtiş A' }).click();
  await page.getByTestId('workout-summary').waitFor();
  for (let i = 0; i < 3; i++) await logSet(page);
  await page.getByRole('button', { name: '1:30 dinlen' }).click();
  await page.getByTestId('rest-remaining').getByText(/Kalan 1:(30|29|28)/).waitFor();
  await page.clock.fastForward(40_000);
  await page.getByTestId('rest-remaining').getByText(/Kalan 0:(5\d|4\d)/).waitFor();
  check(true, 'rest countdown follows the clock');
  if (shots) await page.screenshot({ path: `${shots}/dinlenme.png`, fullPage: true });
  await ctx.close(); // app killed during rest

  ({ ctx, page, errors } = await launch(new Date('2026-11-09T06:01:00Z')));
  await page.getByRole('button', { name: 'Antrenmana devam et: İtiş A' }).click();
  const rest = await page.getByTestId('rest-remaining').innerText();
  const m = /Kalan (\d):(\d\d)/.exec(rest);
  check(m && Number(m[1]) * 60 + Number(m[2]) < 90 && Number(m[1]) * 60 + Number(m[2]) > 0, `restart resumes rest from timestamp (${rest})`);
  await page.clock.fastForward(120_000);
  await page.getByText('Dinlenme bitti').waitFor();
  await page.getByRole('button', { name: 'Antrenmanı bitir' }).click();
  await page.getByText('Ana görev tamamlandı').waitFor();

  await page.getByRole('button', { name: 'Haftalık değerlendirmeyi aç' }).click();
  await page.getByTestId('rules-disclaimer').waitFor();
  check((await page.getByTestId('rules-disclaimer').innerText()).includes('doğrulanmış bir tıbbi algoritma değildir'), 'thresholds not presented as medical');
  await page.getByRole('button', { name: 'Haftalık değerlendirmeyi tamamla' }).click();
  await page.getByText('Haftalık değerlendirme tamamlandı: +40 XP').waitFor();
  await page.reload();
  await tab(page, 'Antrenman');
  check((await page.getByTestId('weekly-status').innerText()).includes('tamamlandı'), 'weekly review state persists');
  await tab(page, 'Bugün');
  check((await xp(page)).includes('Toplam 110 XP'), 'weekly review +40 once (10 + 60 + 40)');
  check(errors.length === 0, 'no page errors (Mon): ' + errors.join('; '));
  await ctx.close();

  // ---- Tuesday: move Çekiş A to Thursday, then a conflicting program edit is refused ----
  ({ ctx, page, errors } = await launch(day('2026-11-10')));
  await checkinToday(page);
  await tab(page, 'Antrenman');
  const pullRow = page.getByTestId('week-row').filter({ hasText: 'Çekiş A' });
  await pullRow.getByRole('button', { name: 'Taşı' }).click();
  await page.getByRole('radio', { name: 'Per 12' }).click();
  await page.getByText('Antrenman taşındı').waitFor();
  await page.getByRole('button', { name: 'Programı düzenle' }).click();
  // İtiş B is the 4th day card; set its weekday to Thursday.
  await page.getByLabel('İtiş B günü').getByRole('radio', { name: 'Per' }).click();
  await page.getByRole('button', { name: 'Önizle' }).click();
  await page.getByTestId('conflict-list').waitFor();
  const conflictText = await page.getByTestId('conflict-list').innerText();
  check(conflictText.includes('Çekiş A') && conflictText.includes('İtiş B'), 'conflict names both sessions');
  check(await page.getByRole('button', { name: 'Değişiklikleri onayla' }).isDisabled(), 'conflicting change cannot be accepted');
  if (shots) await page.screenshot({ path: `${shots}/cakisma.png`, fullPage: true });
  await page.getByRole('button', { name: 'Düzenlemeye dön' }).click();
  await page.getByRole('button', { name: 'Vazgeç' }).click();
  check(await page.getByText('Program sürümü 2').isVisible(), 'no new plan version after the refused edit');
  check((await pullRow.innerText()).includes('taşındı'), 'move kept');
  await ctx.close();

  // ---- Friday: second bench session ----
  ({ ctx, page, errors } = await launch(day('2026-11-13')));
  await checkinToday(page);
  await trainBench(page, 'İtiş B');
  await ctx.close();

  // ---- Saturday: proposal with reason + before/after, explicit acceptance ----
  ({ ctx, page, errors } = await launch(day('2026-11-14')));
  await checkinToday(page);
  await tab(page, 'Antrenman');
  await page.getByRole('button', { name: 'Haftalık değerlendirmeyi aç' }).click();
  await page.getByText('Ekipman artışların').waitFor();
  check((await page.getByTestId('hold-row').filter({ hasText: EX }).innerText()).includes('doğrulamadın'), 'no increase before the user confirms an increment');
  await page.getByLabel('Ekipman').getByRole('radio', { name: 'Halter (toplam)' }).click();
  await page.getByLabel('En küçük artış', { exact: true }).fill('2,5');
  await page.getByLabel('Artış birimi').getByRole('radio', { name: 'kg' }).click();
  await page.getByRole('button', { name: 'Artışı doğrula' }).click();
  await page.getByText('Ekipman artışı doğrulandı.').waitFor();
  await page.getByTestId('proposal-card').waitFor();
  check((await page.getByTestId('proposal-before').innerText()).includes('60 kg'), 'preview shows before (60 kg total)');
  check((await page.getByTestId('proposal-after').innerText()).includes('62,5 kg'), 'preview shows after (62,5 kg)');
  check(await page.getByRole('button', { name: `Öneriyi kabul et: ${EX}` }).isDisabled(), 'acceptance needs technique confirmation');
  if (shots) await page.screenshot({ path: `${shots}/oneri.png`, fullPage: true });
  await page.getByRole('checkbox', { name: 'Teknik ve hareket açıklığı iki seansta da aynıydı' }).click();
  await page.getByRole('button', { name: `Öneriyi kabul et: ${EX}` }).click();
  await page.getByText('Öneri kabul edildi').waitFor();
  await page.reload();
  await tab(page, 'Antrenman');
  await page.getByText('Program sürümü 3').waitFor();
  await page.getByRole('button', { name: 'Haftalık değerlendirmeyi aç' }).click();
  await page.getByText('Kabul edildi · yeni program sürümü kaydedildi').waitFor();
  check(true, 'accepted decision and new plan version persist after reload');

  await tab(page, 'Karakter');
  await page.getByTestId('avatar-emblem').waitFor();
  check((await page.getByTestId('badge-row').count()) >= 5, 'character shows level-based emblem and badges');
  if (shots) await page.screenshot({ path: `${shots}/karakter-m2.png`, fullPage: true });
  check(errors.length === 0, 'no page errors: ' + errors.join('; '));
  await ctx.close();
  console.log('PASS web M2 flow');
} finally {
  server.close();
  rmSync(profileDir, { recursive: true, force: true });
}
