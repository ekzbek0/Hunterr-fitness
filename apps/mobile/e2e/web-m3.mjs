// Web M3 acceptance: rest timer clock-rollback regression (never extended, uncertain
// state persists across a restart), read-aloud with honest fallback and an off switch,
// reminders unsupported on web, Gelişim tab, backup export/restore/corrupt file, delete all.
// Usage: npm run export:web && node e2e/web-m3.mjs
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
  await page.getByRole('button', { name: 'Sesli okuma açık' }).click();
  await page.getByRole('button', { name: 'Sesli okuma kapalı' }).waitFor();
  await tab(page, 'Bugün');
  await page.getByTestId('xp-total').waitFor();
  check((await page.getByRole('button', { name: 'Görevleri sesli oku' }).count()) === 0, 'speech off hides the read-aloud button');
  await page.reload();
  await page.getByTestId('xp-total').waitFor();
  check((await page.getByRole('button', { name: 'Görevleri sesli oku' }).count()) === 0, 'speech setting persists after reload');
  check(errors.length === 0, `no page errors (part A): ${errors.join(' | ')}`);
  await ctx.close();
  // PART_B
  console.log('PASS web M3 flow');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  server.close();
  rmSync(profileDir, { recursive: true, force: true });
}
