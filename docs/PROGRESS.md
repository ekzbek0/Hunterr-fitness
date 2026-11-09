# Current progress

## Status
M0 (kalıcı günlük görev → XP → yeniden açılışta korunma) web üzerinde çalışıyor
ve test edildi. Native (iPhone) davranışı henüz gerçek cihazda sınanmadı.

## 2026-11-09 / M0 / ilk dikey dilim

### Ortam (bulut oturumu, Linux)
- Node 22.23.4, npm 10.9.9, Python 3 (başlatıcı).
- Expo SDK 58 (`expo@58.0.23`, `latest` etiketi; engines: Node ^22.13 || ^24.3 …),
  React Native 0.88.1, React 19.3, TypeScript ~6.0, `expo-sqlite@~58.0.15`
  (sürüm `expo/bundledNativeModules.json`'dan alındı).
- `npx expo install` ve `expo lint` otomatik kurulumu api.expo.dev'e erişemedi
  (proxy 403); paketler SDK'nın bundledNativeModules sürümleriyle npm ile kuruldu.
  `npx expo-doctor` bu nedenle çalıştırılmadı.
- Resmî Expo eklentisi/MCP bu bulut oturumunda yok; resmî belge + proje yönergeleri kullanıldı.
- `.claude/agents` ve `.claude/skills` bu oturumda başlatıcıyla sonradan oluşturulduğu
  için oturuma yüklenmedi; iş ana oturumda yapıldı. Yeni oturumda yüklenecekler.

### Uygulanan davranış
- `python3 AVCI_Claude_Baslat.py --self-test` → PASS 11; `--target .` → 36 dosya.
- `apps/mobile`: Expo Router uygulaması; sekmeler Bugün / Karakter / Ayarlar
  (Antrenman ve Gelişim sekmeleri M1/M3'te eklenecek; işlevsiz sekme gösterilmiyor).
- Profil oluşturma (iki alışkanlık seçimi, x1 varsayılan; hesap/kilo/fotoğraf yok).
- Görev günü: UUID + sıra + yakalanan saat dilimi + çarpan anlık görüntüsü; açılışta ve
  ön plana dönüşte devam/kapat-ve-yeni-gün kararı (`src/domain/game/task-day.ts`).
- Check-in (uyku isteğe bağlı, enerji, yorgunluk, kas hassasiyeti, ağrı/hastalık
  evet/hayır/bilmiyorum) → +10 XP; düzeltme ek XP vermez.
- Ana görev: antrenman veya planlı toparlanma, ikisi de 60 XP; hastalıkta yalnız
  toparlanma seçeneği. Tamamlandıktan sonra mod değişimi ikinci ödül vermez.
- İki alışkanlık slotu (15 XP). x1'de günlük temel azami 100 XP.
- XP defteri: `(profileId, scopeKind, scopeId, slotKey)` UNIQUE; slot güncelleme +
  defter kaydı tek işlemde. Toplam her zaman defterden hesaplanır.
- Seviye 50·(L-1)·L, rütbe E1/D5/C10/B20/A35/S50, en fazla seviye 100.
- Çarpan ve alışkanlık değişikliği sonraki görev gününde geçerli; bugün/geçmiş değişmez.
- Saat geri alınırsa ödüller dondurulur (veri korunur), saat düzelince devam eder.
- Kalıcılık: iOS/Android `expo-sqlite` (migration'lı tablolar, WAL, exclusive tx);
  web IndexedDB (tek belge, revizyon kontrollü atomik yazım). Bellek içi sessiz geri dönüş yok.

### Değişen yollar
`apps/mobile/**` (yeni), `docs/PROGRESS.md`, `docs/DECISIONS.md`, başlatıcı çıktısı (kök).

### Çalıştırılan komutlar ve gerçek sonuçlar (apps/mobile içinde)
- `npm run typecheck` → hata yok.
- `npm run lint` (expo lint, eslint-config-expo 58) → hata/uyarı yok.
- `npm test` → 4 dosya, 49 test geçti. Servis testleri hem gerçek SQLite (node:sqlite,
  expo-sqlite yerine aynı sürücü arayüzü) hem IndexedDB (fake-indexeddb) üzerinde:
  yeniden açılışta aynı geçmiş/toplam, eşzamanlı çift dokunuş tek ödül, antrenman→
  toparlanma değişiminde ikinci ödül yok, check-in düzeltmesi, gün içi ayar değişimi,
  kapanmış güne ödül yok, kaçırılan günlerde borç/negatif XP yok, saat geri alma,
  saat dilimi değişimi, DST, geçersiz giriş, yarım kalan işlemin geri alınması.
- `npm run export:web` → `dist/` üretildi; web paketinde expo-sqlite yok.
- `npm run test:web` (Playwright/Chromium, 390×844) → PASS: profil → check-in → ana
  görev → 70 XP → sayfa yenileme → tarayıcıyı tamamen kapatıp aynı profille açma →
  70 XP ve tamamlanan görevler korunuyor → alışkanlık +15 → Karakter'de 3 kayıt.

### Doğrulanmamış / açık noktalar
- iPhone: expo-sqlite migration, ön plana dönüş, uçak modu — cihaz/EAS build yok, SINANMADI.
- `expo-doctor` ve `npx expo install --check` ağ kısıtı nedeniyle çalıştırılmadı.
- Haftalık değerlendirme (40 XP, haftalık döngü kimliği) henüz yok (M2).
- Export/import/silme yok (M3).

## Next
1. Yeni oturumda proje ajanlarının yüklendiğini doğrula (`/agents`), `/resume-avci`.
2. M1: profil doğrulama (güncel kilo/gün/ekipman/kısıt), haftalık program (PPLPP taslağı
   doğrulanarak), antrenman günlüğü (set/tekrar/yük/birim/RIR, ısınma ayrımı,
   yarıda kalan antrenmana devam), gün taşıma; ana görev slotunu antrenman kaydına bağla.
3. Yerel bilgisayarda `npx expo-doctor` ve `npx expo install --check` çalıştır.

## Completed milestones
- M0: web üzerinde tamam ve test edildi. Native kısmı gerçek cihazda doğrulanmadı.

## Update template
For each slice: date / milestone / implemented behavior / changed paths /
commands with actual results / unresolved blockers / next concrete task.
Never store user secrets, personal health records or photos in this file.
