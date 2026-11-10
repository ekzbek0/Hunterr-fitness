// Web layout check: the five-tab bar must hold every Turkish label inside its own
// tab at narrow (320 pt) and common (390 pt) widths, with no horizontal page scroll.
// This is a web measurement only; Dynamic Type on a real iPhone is NOT covered.
// Usage: npm run export:web && node e2e/web-layout.mjs
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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
const check = (cond, msg) => {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('ok -', msg);
};

const browser = await chromium.launch();
try {
  for (const width of [320, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 700 }, locale: 'tr-TR' });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.getByRole('tab', { name: 'Ayarlar' }).waitFor();
    const tabs = await page.getByRole('tab').evaluateAll((els) =>
      els.map((e) => {
        const leaf = [...e.querySelectorAll('*')].find((x) => x.children.length === 0);
        const t = e.getBoundingClientRect();
        const l = leaf.getBoundingClientRect();
        return { text: e.innerText, tabLeft: t.left, tabRight: t.right, textLeft: l.left, textRight: l.right, clipped: leaf.scrollWidth > leaf.clientWidth + 1 };
      }),
    );
    check(tabs.map((t) => t.text).join() === 'Bugün,Antrenman,Gelişim,Karakter,Ayarlar', `${width} px: five tabs in order`);
    for (const t of tabs) {
      check(t.textLeft >= t.tabLeft - 0.5 && t.textRight <= t.tabRight + 0.5 && !t.clipped, `${width} px: "${t.text}" fits inside its tab`);
    }
    for (let i = 1; i < tabs.length; i++) check(tabs[i - 1].textRight <= tabs[i].textLeft, `${width} px: "${tabs[i - 1].text}" does not overlap "${tabs[i].text}"`);
    check((await page.evaluate(() => document.documentElement.scrollWidth)) <= width, `${width} px: no horizontal page scroll`);
    await page.close();
  }
  console.log('PASS web layout');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
