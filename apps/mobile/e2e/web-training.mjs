// Web M1 acceptance: profile -> check-in -> confirm training facts -> accept
// program -> start workout -> warm-up + work sets (unit, optional RIR) ->
// FULL browser restart mid-workout -> resume -> finish -> core reward once ->
// move a session -> edit program with preview -> XP unchanged.
// Clock is fixed to Monday 2026-11-09 09:00 Europe/Istanbul so the schedule is deterministic.
// Usage: npm run export:web && node e2e/web-training.mjs
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
const profileDir = mkdtempSync(join(tmpdir(), 'avci-web-m1-'));
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

async function logSet(page, { kind, reps, load, rir }) {
  await page.getByLabel(`${EX} set türü`).getByRole('radio', { name: kind === 'work' ? 'Çalışma seti' : 'Isınma seti' }).click();
  await page.getByLabel(`${EX} tekrar`, { exact: true }).fill(String(reps));
  await page.getByLabel(`${EX} ağırlık`, { exact: true }).fill(String(load));
  await page.getByLabel(`${EX} birim`).getByRole('radio', { name: 'kg' }).click();
  if (kind === 'work') {
    await page.getByLabel(`${EX} RIR`).getByRole('radio', { name: rir === null ? 'Belirtme' : String(rir), exact: true }).click();
  }
  await page.getByRole('button', { name: kind === 'work' ? `${EX}: çalışma setini kaydet` : `${EX}: ısınma setini kaydet` }).click();
  await page.getByTestId('training-message').getByText('Set kaydedildi').waitFor();
}

try {
  let { ctx, page, errors } = await launch();
  await page.getByText("AVCI'ye hoş geldin").waitFor();
  await page.getByRole('button', { name: 'Başla' }).click();
  await page.getByTestId('xp-total').waitFor();
  await page.getByRole('button', { name: 'Kontrolü kaydet' }).click();
  await page.getByText('+10 XP kaydedildi.').waitFor();

  // Training facts: draft is shown as a suggestion and needs confirmation.
  await tab(page, 'Antrenman');
  await page.getByText('yalnızca bir öneridir').waitFor();
  // Optional height/weight left empty on purpose.
  await page.getByRole('button', { name: 'Bilgileri onayla' }).click();
  await page.getByRole('heading', { name: 'Program önerisi' }).waitFor();
  check((await page.getByTestId('exposure').innerText()).includes('bacaklar 1 gün'), 'proposal states legs once a week');
  await page.getByRole('button', { name: 'Programı kabul et' }).click();
  await page.getByText('Program kabul edildi').waitFor();
  check((await page.getByTestId('week-row').count()) === 5, 'week shows 5 planned sessions');

  await page.getByRole('button', { name: 'Antrenmana başla: İtiş A' }).click();
  await page.getByTestId('workout-summary').waitFor();
  await logSet(page, { kind: 'warmup', reps: 8, load: 20 });
  await logSet(page, { kind: 'work', reps: 10, load: '42,5', rir: 2 });
  await logSet(page, { kind: 'work', reps: 9, load: '42,5', rir: null });
  await page.getByTestId('set-row').nth(2).waitFor();
  check((await page.getByTestId('workout-summary').innerText()).includes('Çalışma seti: 2 · Isınma seti: 1'), 'warm-up counted separately');
  check(await page.getByText('RIR girilmedi').isVisible(), 'missing RIR stays empty, not 0');
  check(errors.length === 0, 'no page errors: ' + errors.join('; '));
  await ctx.close(); // app "killed" mid-workout

  ({ ctx, page, errors } = await launch(new Date('2026-11-09T07:00:00Z')));
  await page.getByTestId('xp-total').waitFor();
  check(await page.getByRole('button', { name: 'Antrenmana devam et: İtiş A' }).isVisible(), 'Today offers to resume the workout');
  await page.getByRole('button', { name: 'Antrenmana devam et: İtiş A' }).click();
  await page.getByTestId('workout-summary').waitFor();
  check((await page.getByTestId('workout-summary').innerText()).includes('Çalışma seti: 2 · Isınma seti: 1'), 'restart resumes with all sets');
  check((await page.getByTestId('set-row').count()) === 3, 'three logged sets restored');
  check(await page.getByText('42,5 kg (toplam yük)').first().isVisible(), 'decimal load and unit persisted');
  if (shots) await page.screenshot({ path: `${shots}/antrenman.png`, fullPage: true });

  await page.getByRole('button', { name: 'Antrenmanı bitir' }).click();
  await page.getByText('Ana görev tamamlandı: +60 XP').waitFor();
  await tab(page, 'Bugün');
  await page.getByText('Antrenman kaydıyla tamamlandı.').waitFor();
  check((await xp(page)).includes('Toplam 70 XP'), 'workout completes the daily core once (10 + 60)');

  // Move Tuesday's session to Thursday.
  await tab(page, 'Antrenman');
  const pullRow = page.getByTestId('week-row').filter({ hasText: 'Çekiş A' });
  await pullRow.getByRole('button', { name: 'Taşı' }).click();
  await page.getByRole('radio', { name: 'Per 12' }).click();
  await page.getByText('Antrenman taşındı').waitFor();
  check((await pullRow.innerText()).includes('taşındı'), 'moved session shows original date');

  // Edit program with preview; second plan version, no XP change.
  await page.getByRole('button', { name: 'Programı düzenle' }).click();
  await page.getByRole('button', { name: '+' }).first().click();
  await page.getByRole('button', { name: 'Önizle' }).click();
  await page.getByTestId('change-list').waitFor();
  check((await page.getByTestId('change-list').innerText()).includes('3×8–12'), 'preview shows before/after prescription');
  await page.getByRole('button', { name: 'Değişiklikleri onayla' }).click();
  await page.getByText('Program güncellendi').waitFor();
  check(await page.getByText('Program sürümü 2').isVisible(), 'new plan version stored');
  await page.reload();
  await tab(page, 'Antrenman');
  await page.getByText('Program sürümü 2').waitFor();
  check((await page.getByTestId('week-row').filter({ hasText: 'Çekiş A' }).innerText()).includes('taşındı'), 'move persists after reload');
  check((await page.getByTestId('week-row').filter({ hasText: 'İtiş A' }).innerText()).includes('Tamamlandı'), 'done session stays done after plan edit');
  await tab(page, 'Bugün');
  check((await xp(page)).includes('Toplam 70 XP'), 'plan/schedule edits create no second reward');
  if (shots) await page.screenshot({ path: `${shots}/bugun-m1.png`, fullPage: true });
  check(errors.length === 0, 'no page errors after restart: ' + errors.join('; '));
  await ctx.close();
  console.log('PASS web training flow');
} finally {
  server.close();
  rmSync(profileDir, { recursive: true, force: true });
}
