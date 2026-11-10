// Web recovery check: when the stored records cannot be opened ("Kayıtlar açılamadı"),
// Ayarlar must still offer backup export and delete-all, so the user is not locked out.
// The broken state is produced by editing the browser's stored document directly
// (a later task day with an earlier date), which no app path can write any more.
// Web/IndexedDB only; the SQLite path on a real iPhone is NOT covered here.
// Usage: npm run export:web && node e2e/web-recovery.mjs
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
const profileDir = mkdtempSync(join(tmpdir(), 'avci-web-recovery-'));
const check = (cond, msg) => {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('ok -', msg);
};
const tab = (page, name) => page.getByRole('tab', { name }).click();

const ctx = await chromium.launchPersistentContext(profileDir, {
  viewport: { width: 390, height: 844 },
  timezoneId: 'Europe/Istanbul',
  locale: 'tr-TR',
  acceptDownloads: true,
});
try {
  await ctx.clock.install({ time: new Date('2026-11-09T06:00:00Z') });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(url);
  await page.getByRole('button', { name: 'Başla' }).click();
  await page.getByTestId('xp-total').waitFor();
  await page.getByRole('button', { name: 'Kontrolü kaydet' }).click();
  await page.getByText('+10 XP kaydedildi.').waitFor();

  // Break the stored document: a task day with a higher sequence but an earlier date.
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('avci', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('documents', 'readwrite');
          const store = tx.objectStore('documents');
          const get = store.get('main');
          get.onsuccess = () => {
            const stored = get.result;
            const day = stored.doc.taskDays[0];
            stored.doc.taskDays.push({ ...day, id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', sequence: 99, localDate: '2026-11-01' });
            store.put(stored, 'main');
          };
          tx.oncomplete = () => (open.result.close(), resolve(null));
          tx.onabort = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await page.getByText('Kayıtlar açılamadı').waitFor();
  check(true, 'a broken store shows the "Kayıtlar açılamadı" screen on Bugün');

  await tab(page, 'Ayarlar');
  await page.getByTestId('storage-error').waitFor();
  check(await page.getByRole('button', { name: 'Tekrar dene' }).isVisible(), 'Ayarlar still offers "Tekrar dene"');
  check(await page.getByTestId('backup-export').isVisible(), 'Ayarlar offers a backup export while records cannot be opened');
  check(await page.getByTestId('backup-pick').isVisible(), 'Ayarlar offers restore from a backup');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('backup-export').click()]);
  const saved = JSON.parse(readFileSync(await download.path(), 'utf8'));
  check(saved.format === 'avci-backup' && saved.data.ledger.length === 1, 'the export still contains the records (1 XP entry)');
  await page.getByTestId('backup-message').waitFor();
  check(/tutarsızlık/i.test(await page.getByTestId('backup-message').innerText()), 'the export warns that this file has problems');

  await page.getByTestId('delete-all').click();
  await page.getByTestId('delete-all-confirm').click();
  await tab(page, 'Bugün');
  await page.getByRole('button', { name: 'Başla' }).waitFor();
  check(true, 'after delete-all the app opens again (empty start)');
  await page.reload();
  await page.getByRole('button', { name: 'Başla' }).waitFor();
  check(true, 'and stays openable after a reload');
  console.log('PASS web recovery');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await ctx.close();
  server.close();
  rmSync(profileDir, { recursive: true, force: true });
}
