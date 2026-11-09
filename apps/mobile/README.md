# AVCI mobil uygulaması (Expo SDK 58)

Türkçe, iPhone öncelikli, çevrimdışı çalışan spor RPG'si. Proje kuralları kök
dizindeki `CLAUDE.md` ve `docs/` altındadır; güncel durum `docs/PROGRESS.md`.

```bash
npm ci                # kilit dosyasından birebir kurulum (playwright 1.63.0 dahil)
npm run web           # tarayıcı önizlemesi (IndexedDB ile kalıcı)
npm run typecheck     # tsc --noEmit
npm run lint          # expo lint
npm test              # vitest: alan kuralları, migration, SQLite/IndexedDB servis testleri
npm run export:web    # dist/ web çıktısı
npm run test:web      # export sonrası: Playwright ile M0 kalıcılık + M1 antrenman akışı
```

### Tarayıcı testi için Chromium

`playwright` bir geliştirme bağımlılığıdır (sürüm `package.json`'da tam sabit,
`package-lock.json`'da kilitli). Paket tarayıcıyı içermez; temiz bir makinede
`npm ci` sonrasında bir kez:

```bash
npm run e2e:install-browser     # = npx playwright install chromium
# Linux'ta sistem kütüphaneleri eksikse: npx playwright install --with-deps chromium
```

Tarayıcılar varsayılan olarak kullanıcı önbelleğine (`~/.cache/ms-playwright`,
macOS'ta `~/Library/Caches/ms-playwright`) kurulur. `PLAYWRIGHT_BROWSERS_PATH`
tanımlıysa oradan okunur; bu sürüm Chromium revizyonu **1243** bekler.
Web testleri saati `2026-11-09 09:00 Europe/Istanbul` (Pazartesi) olarak sabitler;
böylece haftalık program her gün aynı sonucu verir.

Yapı:

| Yol | İçerik |
|---|---|
| `src/domain/game` | XP, seviye, rütbe, görev slotları, görev günü kuralları (saf) |
| `src/domain/training` | check-in/öneri, antrenman profili, hareket kataloğu, program üretimi/doğrulama/fark, haftalık takvim ve taşıma, set kuralları (XP'den bağımsız) |
| `src/data` | depo arayüzü; native `expo-sqlite`, web IndexedDB adaptörü |
| `src/services` | tek işlemde tamamlama + XP defteri yazan uygulama servisi |
| `src/app`, `src/ui` | Expo Router ekranları (Bugün, Antrenman, Karakter, Ayarlar); `src/ui/training` antrenman bileşenleri |
| `tests`, `e2e` | Vitest testleri (`helpers.ts` iki gerçek depoyu sağlar) ve iki Playwright akışı |
