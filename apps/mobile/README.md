# AVCI mobil uygulaması (Expo SDK 58)

Türkçe, iPhone öncelikli, çevrimdışı çalışan spor RPG'si. Proje kuralları kök
dizindeki `CLAUDE.md` ve `docs/` altındadır; güncel durum `docs/PROGRESS.md`.

```bash
npm install
npm run web           # tarayıcı önizlemesi (IndexedDB ile kalıcı)
npm run typecheck     # tsc --noEmit
npm run lint          # expo lint
npm test              # vitest: alan kuralları + SQLite/IndexedDB servis testleri
npm run export:web    # dist/ web çıktısı
npm run test:web      # export sonrası: Playwright ile yenile/yeniden aç akışı
```

Yapı:

| Yol | İçerik |
|---|---|
| `src/domain/game` | XP, seviye, rütbe, görev slotları, görev günü kuralları (saf) |
| `src/domain/training` | check-in doğrulama ve ana görev önerisi (XP'den bağımsız) |
| `src/data` | depo arayüzü; native `expo-sqlite`, web IndexedDB adaptörü |
| `src/services` | tek işlemde tamamlama + XP defteri yazan uygulama servisi |
| `src/app`, `src/ui` | Expo Router ekranları (Bugün, Karakter, Ayarlar) |
| `tests`, `e2e` | Vitest testleri ve web kalıcılık akışı |
