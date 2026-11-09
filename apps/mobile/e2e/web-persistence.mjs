// Web M0 acceptance: profile -> check-in -> core -> XP -> reload AND full
// browser restart (same profile dir) -> identical XP and completed tasks.
// Usage: npm run export:web && node e2e/web-persistence.mjs
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';

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
const profileDir = mkdtempSync(join(tmpdir(), 'avci-web-'));
const shots = process.env.AVCI_SHOTS;

async function launch() {
  const ctx = await chromium.launchPersistentContext(profileDir, { viewport: { width: 390, height: 844 } });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  return { ctx, page, errors };
}
const xpText = (page) => page.getByTestId('xp-total').innerText();
const check = (cond, msg) => {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('ok -', msg);
};

try {
  let { ctx, page, errors } = await launch();
  await page.getByText("AVCI'ye hoş geldin").waitFor();
  await page.getByRole('button', { name: 'Başla' }).click();
  await page.getByTestId('xp-total').waitFor();
  check((await xpText(page)).includes('Toplam 0 XP'), 'new profile starts at 0 XP');

  await page.getByRole('button', { name: 'Kontrolü kaydet' }).click();
  await page.getByText('+10 XP kaydedildi.').waitFor();
  await page.getByRole('button', { name: 'Antrenmanı tamamladım' }).click();
  await page.getByText('+60 XP kaydedildi.').waitFor();
  check((await xpText(page)).includes('Toplam 70 XP'), 'check-in + core = 70 XP');
  if (shots) await page.screenshot({ path: `${shots}/bugun.png`, fullPage: true });

  await page.reload();
  await page.getByTestId('xp-total').waitFor();
  check((await xpText(page)).includes('Toplam 70 XP'), 'reload keeps 70 XP');
  check(await page.getByText('Antrenman tamamlandı').isVisible(), 'reload keeps completed core');
  check(errors.length === 0, 'no page errors: ' + errors.join('; '));
  await ctx.close();

  ({ ctx, page, errors } = await launch());
  await page.getByTestId('xp-total').waitFor();
  check((await xpText(page)).includes('Toplam 70 XP'), 'browser restart keeps 70 XP');
  await page.getByRole('button', { name: /Yaptım \(\+15 XP\)/ }).first().click();
  await page.getByText('+15 XP kaydedildi.').waitFor();
  check((await xpText(page)).includes('Toplam 85 XP'), 'habit adds 15 XP once');
  await page.getByRole('tab', { name: 'Karakter' }).click();
  await page.getByText('XP geçmişi').waitFor();
  check((await page.getByTestId('ledger-row').count()) === 3, 'character ledger shows 3 rewards');
  if (shots) await page.screenshot({ path: `${shots}/karakter.png`, fullPage: true });
  check(errors.length === 0, 'no page errors after restart: ' + errors.join('; '));
  await ctx.close();
  console.log('PASS web persistence flow');
} finally {
  server.close();
  rmSync(profileDir, { recursive: true, force: true });
}
