# Current progress

## Status
M0 ve M1 (antrenman profili, düzenlenebilir haftalık program, gün taşıma, set
kaydı, yarıda kalan antrenmana devam, ana görev bağlantısı) web üzerinde çalışıyor
ve test edildi. Native (iPhone) davranışı henüz gerçek cihazda SINANMADI.

## 2026-11-09 / M0 düzeltmeleri + M1 / antrenman günlüğü

Dal: `claude/project-thread-aoxh7c` (`claude/project-thread-t29swh` üzerine). main'e birleştirilmedi.

### Oturum ve ajanlar
- `.claude/agents` (7 avci-* ajanı) ve `.claude/skills` repoda var, ancak bu bulut oturumu
  main dalından başladığı için (ajan dosyaları main'de yok) oturuma YÜKLENMEDİ; Agent
  listesinde avci-* türü görünmedi. Uygulama ana oturumda yapıldı; inceleme için
  avci-qa + avci-training tanımlarıyla genel amaçlı bir alt ajan çalıştırıldı (salt okuma).
  Ajanların yerel kullanımı için oturumu bu daldan başlat.

### M0 düzeltmeleri
1. `completeCore` hastalık kontrolü artık servis katmanında, aynı işlem içinde
   (`completeCoreInTx`): önce slot tamamlanmışsa mevcut ödül döner (iptal yok, çift XP yok),
   ancak YENİ bir `training` tamamlaması bugünkü check-in `illness: 'yes'` iken
   `rejected/illness` ile reddedilir. `recovery` ve `illness-recovery` aynı 60 XP'yi verir.
   `unknown` antrenmanı engellemez (yalnız yük artışı dondurulur; mevcut kural).
   Regresyon testleri `tests/service.test.ts` (SQLite + IndexedDB, 6×2): ret ve yeniden
   açılışta XP yok; toparlanma bir kez; tekrar çağrı `already-completed`; hastalık sonradan
   bildirilirse önceki antrenman ödülü korunur; eşzamanlı dokunuşlarda tek ödül.
2. `playwright@1.63.0` tam sürümle devDependency + `package-lock.json`. Chromium kurulumu
   `npm run e2e:install-browser` olarak README ve docs/SETUP.md'de belgelendi.
   Temiz kurulum doğrulaması: repo scratch dizine yeniden klonlandı → `npm ci` (14,6 sn)
   → `npx playwright --version` 1.63.0 → `npm run export:web` → `npm run test:web` PASS.
   Not: bu ortamda Chromium `/opt/pw-browsers` (PLAYWRIGHT_BROWSERS_PATH, revizyon 1243)
   üzerinden hazırdı; `playwright install` indirmesi burada çalıştırılmadı
   (`--dry-run` doğru revizyonu ve konumu gösterdi).

### M1 davranışı
- Antrenman profili (`src/domain/training/profile.ts`): hedef, 2–6 gün, isteğe bağlı seans
  süresi, ekipman, deneyim, hareket kısıtları (baş üstü, omurgaya eksenel yük, derin diz
  bükme, bilek); boy/kilo isteğe bağlı (boş = null, NaN/aralık dışı reddedilir).
  Varsayılan PPLPP değerleri "öneri" olarak gösterilir; onaylanmadan kaydedilmez.
- Program (`program.ts`, `catalog.ts`): 29 hareketlik özgün katalog (yük kuralı: toplam /
  dambıl başına / vücut ağırlığına ek). Gün sayısına göre bölünme (5 gün = İtiş/Çekiş/Bacak/
  İtiş/Çekiş; "bacak haftada 1 gün" UI'da açıkça yazılır). Yük önerilmez; set, tekrar aralığı,
  hedef RIR 2 (ürün varsayımı). Kısıtlı/ekipmansız hareket hiç üretilmez ve doğrulamada reddedilir.
- Düzenleme: gün adı, haftanın günü, set/tekrar, alternatif hareket (aynı kalıp), ekle/çıkar →
  önizleme (yapısal fark listesi) → onay → yeni değişmez `plan_version` (parentId, sequence,
  reason=JSON fark). Eski sürüme göre kaydetme (`baseVersionId` eskiyse) `plan-changed` ile reddedilir.
  Profil değişip program uyumsuz kalırsa antrenman başlatma `plan-invalid` ile engellenir,
  yeni öneri önizlenip onaylanır.
- Haftalık takvim (`schedule.ts`): Pazartesi başlangıçlı yerel hafta; planlı seans kimliği
  `${weekStart}:${programDayId}`. Taşıma yalnız bu haftada, bugün veya sonrasına, boş güne;
  tamamlanan/devam eden taşınamaz. Kaçırılan seans "Kaçırıldı (borç yok)" olarak kalır.
- Antrenman: yalnız bugüne düşen seans başlatılır; hastalıkta başlatma reddedilir. Hareket başına
  set türü (ısınma/çalışma), tekrar, ağırlık (Türkçe virgül kabul), kg/lb, isteğe bağlı RIR
  (yalnız çalışma setinde; boş = null). Her set anında yazılır; uygulama kapanınca
  açılışta Bugün "Antrenmana devam et" gösterir. Isınma setleri çalışma setine sayılmaz;
  bitirmek için ≥1 çalışma seti gerekir. Bırakma setleri saklar, ödül/borç yok.
  Son tamamlanan seansın çalışma setleri referans olarak gösterilir.
- Ödül bağlantısı: `finishWorkout` aynı işlemde seansı bitirir ve başlatıldığı görev gününün
  `core` slotunu `training` + `workoutSessionId` ile tamamlar. Ana görev zaten tamamlandıysa
  (toparlanma veya başka antrenman) kayıt saklanır, ödül `already-completed`. Gün kapandıysa
  `day-changed`, saat geri alındıysa `clock-frozen`, hastalık sonradan bildirildiyse `illness`:
  kayıt saklanır, XP verilmez. Program/gün değişikliği ve set düzenleme ödüle dokunmaz.
- Kalıcılık: SQLite migration 2 (ek sütun `quest_slot.workout_session_id`; tablolar
  `training_profile`, `plan_version`, `schedule_move`, `workout_session` (tek aktif seans ve
  slot başına tek bitmiş seans için kısmi UNIQUE indeksler), `set_log`). IndexedDB belge
  şeması 1→2 (ek alanlar, mevcut kayıtlar aynen taşınır). Bugün sekmesi program varsa
  "Antrenmana başla/devam et" gösterir; program yoksa M0'daki beyanla tamamlama sürer.

### Bağımsız inceleme (avci-qa + avci-training rolleri, salt okuma) ve düzeltmeler
Ciddi hata yok; XP çoğaltma ve veri kaybı yolu bulunmadı (eşzamanlı bitir ×2 + toparlanma
→ tek defter kaydı, iki depoda). Bulunan 7 sorun düzeltildi ve testlendi:
1. 0 tekrarlı çalışma seti ana görevi tamamlayabiliyordu → çalışma seti ≥1 tekrar.
2. Bazı ekipman/kısıt birleşimlerinde boş gün üretilip öneri kabul edilemiyordu →
   kısıtsız vücut ağırlığı yedekleri; 255×16×5 = 20.400 birleşimin tamamı test ediliyor.
3. Program günü kimlikleri sıra numarasıydı (d1…); farklı bölünme eski "tamamlandı"
   durumunu devralıyordu → kimlik şablon tekrarına bağlı (`push-1`, `full-a-1`…).
4–5. Saat anomalisi/hastalık yüzünden ödülü reddedilen bitmiş antrenman, durum düzelince
   ana göreve sayılamıyor ve tekrar denemede yanlışlıkla "zaten tamamlandı" diyordu →
   `finishWorkout` tekrarında ödül yeniden değerlendirilir (idempotent); Bugün'de
   "Kaydedilen antrenmanı ana göreve say" düğmesi.
6. Eklem ağrısı Antrenman ekranında görünmüyordu → hafta ve kayıt ekranında uyarı.
7. Devam eden antrenmanda sonradan hastalık bildirilince uyarı yoktu → kayıt ekranında
   uyarı + bırakma; önceki günden kalan seansta "ödül vermez" notu.
Açık bırakılan düşük öncelikliler: lastik direnci için yük birimi yok; program düzenlemesi
taşınmış bir seansla aynı güne gün koyabilir (XP etkisi yok).

### Değişen yollar
`apps/mobile/src/{domain/training/*,data/**,services/avci-service.ts,app/antrenman.tsx,app/index.tsx,
app/_layout.tsx,ui/**}`, `apps/mobile/tests/*` (helpers, migration, training-domain,
training-service), `apps/mobile/e2e/web-training.mjs`, `apps/mobile/package*.json`,
`apps/mobile/README.md`, `docs/SETUP.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md`.

### Çalıştırılan komutlar ve gerçek sonuçlar (apps/mobile)
- `npm run typecheck` → hata yok.
- `npm run lint` → hata/uyarı yok.
- `npm test` → 7 dosya, 167 test geçti (M0: 49 → 167; inceleme düzeltmeleri dahil). İki gerçek depo (node:sqlite,
  fake-indexeddb) üzerinde M1 servis senaryoları ve M0 v1 verisiyle migration testleri
  (SQLite: tüm satırlar korunur, migration hatasında v1 geri alınır; IndexedDB: v1 belge
  korunur, gelecekteki sürüm depoyu değiştirmeden reddedilir).
- `npm run export:web` → `dist/` üretildi.
- `npm run test:web` → `web-persistence.mjs` PASS (M0 akışı değişmedi) ve
  `web-training.mjs` PASS (Chromium 390×844, saat 2026-11-09 09:00 İstanbul'a sabit):
  profil → check-in → antrenman bilgileri onayı (boy/kilo boş) → öneri (bacak 1 gün) →
  kabul → İtiş A başlat → ısınma + 2 çalışma seti (42,5 kg, RIR 2 / boş) → tarayıcıyı
  tamamen kapatıp aç → Bugün'de "devam et" → 3 set geri geldi → bitir → +60 XP, toplam 70 →
  Çekiş A'yı Perşembe'ye taşı → programda set artır → önizleme → sürüm 2 → yenile →
  taşıma ve "Tamamlandı" korunuyor → toplam hâlâ 70 XP; sayfa hatası yok.
- `npx expo-doctor` → 18/20 kontrol geçti, **2 kontrol ağ nedeniyle başarısız**:
  "Expo config schema" (`getaddrinfo ENOTFOUND exp.host`) ve "React Native Directory"
  (sunucu yanıtı alınamadı). GEÇTİ SAYILMAZ; yerel makinede tekrar çalıştırılmalı.

### Doğrulanmamış / açık noktalar
- iPhone: migration 2'nin cihazdaki SQLite'ta çalışması, sayısal klavye, set girişi sırasında
  arka plana alma ve geri dönüş, uygulama sonlandırılıp açılınca devam — SINANMADI.
- Dinlenme sayacı yok (UX listesinde; sonraki dilim). Eklem ağrısı bölgesi sorulmadığı için
  "ağrıyan hareketleri duraklat" otomatik değil; ağrı bildiriminde uyarı gösteriliyor.
- Yük artışı önerisi (çift ilerleme) ve haftalık değerlendirme M2'de.
- Önceki program sürümüne dönme arayüzü yok (sürümler saklanıyor).

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
1. Oturumu bu daldan başlatıp `/agents` ile avci-* ajanlarını doğrula, `/resume-avci`.
2. M2: TRAINING_RULES çift ilerleme önerisi (son iki karşılaştırılabilir seans, RIR≥2,
   14 gün kapısı, en küçük artış ≤%5), önizleme/kabul/ret denetim kaydı, haftalık
   değerlendirme (40 XP, haftalık döngü kimliği). Dinlenme sayacı.
3. Yerel bilgisayarda `npx expo-doctor` ve `npx expo install --check`; EAS development
   build ile iPhone'da M0+M1 akışını (uçak modu dahil) sına.

## Completed milestones
- M0: web üzerinde tamam ve test edildi. Native kısmı gerçek cihazda doğrulanmadı.
- M1: web üzerinde tamam ve test edildi (2026-11-09). Native kısmı gerçek cihazda doğrulanmadı.

## Update template
For each slice: date / milestone / implemented behavior / changed paths /
commands with actual results / unresolved blockers / next concrete task.
Never store user secrets, personal health records or photos in this file.
