# Current progress

## Status

## 2026-11-11 / Son öneri–plan düzeltmesinin tam web kabul kanıtı

- Uzak ref'ler kontrol edildi: Claude devam dalı hâlâ `claude/project-thread-odi8ww`
  (`cfd122b`); düzeltme dalı `codex/backup-recovery-preview` başı `e7176b4`.
- [GitHub Actions 42975467108](https://github.com/ekzbek0/Hunterr-fitness/actions/runs/42975467108),
  iş `130373421845` tamamlandı. Ham günlükte checkout SHA
  `e7176b46ae99a44de0ccf48cf71f3456d3309728` doğrulandı; test edilen ağaç
  `7c36cc73ea4e9cd1d92c80a5a3946b63e66f166f` yerelde test edilen ağaçla aynı.
- Temiz CI kurulumu, typecheck, lint, iki depoda **364/364 test**, web export ve altı
  Chromium akışı başarılı: persistence, training, M2, M3, layout, recovery.
  Günlükte gizlenen doğrulanmamış hedef, kontrol sonrası taze öneri ve okunamayan
  depodan açık onayla 10 XP kurtarma denetimleri ayrıca okundu.
- Bu tur ürün kodu değişmedi; kanıt kaydı güncellendi. Önceki satırlardaki bu commit
  için "web CI bekliyor" ifadeleri bu kayıtla sonuçlanmıştır; tarihî notlar korunur.
- Bağlı Browser aracı hâlâ `Unknown tool browser.js`; önceki alternatif tarayıcı
  gözleminde Claude oturumu giriş istiyordu. Doğrudan mesaj veya Superpowers canlı
  kullanım doğrulaması yapılmış sayılmaz. Aynı engel kullanıcıya tekrar bildirilmedi.
- M5 ve 22 gerçek iPhone kontrolü tamamlanmadı. Ses/bildirim/SQLite/paylaşım/arka plan
  için bu yeşil web işi cihaz kanıtı değildir. Safari test bağlantısı henüz yok.
- Sıradaki bağımsız kapsam: PROGRESS kalan QA/gizlilik notlarını önem ve meşru geçmiş
  düzenlemeleri açısından ayır; kanıtlı kusuru dar kapsamda düzelt. Kabul ölçütü 19'daki
  hareket bazlı eklem ağrısı duraklatması da açık; beta tamamlandı denemez.

## 2026-11-11 / Kabul edilmiş öneri–plan bağlarının bağımsız doğrulaması

- Uzak ref'ler tekrar doğrulandı: en yeni Claude devam dalı `claude/project-thread-odi8ww`
  (`cfd122b`); PR #1 başı inceleme başlangıcında `b980789`.
- `b980789` için Actions [42833401274](https://github.com/ekzbek0/Hunterr-fitness/actions/runs/42833401274),
  iş `129889096508` ham günlükleri okundu. Checkout SHA eşleşiyor: 362 test, tür/lint,
  web export ve altı Chromium akışı geçti. Gizlenen sahte 500 hedefi, kontrol sonrası taze
  62,5 hedefi ve okunamayan depodan açık onaylı kurtarma gerçekten çalıştı.
- Bağımsız salt okunur inceleyici P2 doğruladı: kabul edilmiş önerinin sonuç planı temel
  plana çevrilip sağlama yeniden hesaplanınca iki depoda da önizleme/içe aktarma kabul
  ediliyordu. Servis her zaman karşılıklı öneri–sonuç planı ve temel plan–alt plan bağları
  yazıyor; sonradan elle plan düzenlemek eski değişmez denetim kayıtlarını değiştirmiyor.
- Dar düzeltme: öneriye bağlı plan kabul kararıyla karşılıklı eşleşmeli; kabul edilmiş
  önerinin sonuç planı aynı öneriye ve temel planına bağlı olmalı. Geçersiz dosya bütünüyle
  reddedilir, otomatik onarım yok. Sonuç planının en güncel plan olması şart koşulmaz.
- Kalıcı regresyon önce iki depoda da kırmızı görüldü. Düzeltmeden sonra beş çapraz bağ
  bozulması için önizleme ve gerçek içe aktarma reddi, depoda değişiklik olmaması ve daha
  sonraki meşru plan düzenlemesinin yedeğinin geri yüklenmesi sınanıyor.
- Son diff ayrı salt okunur incelemeden geçti; yeni kusur bulunmadı. İnceleyici gerçekten
  77/77 odaklı testi, typecheck ve lint çalıştırdı.
- Bu son ağaçta typecheck, lint, 18 dosyada **364/364 test** ve web export geçti.
  Yeni düzeltmenin web CI sonucu ayrıca doğrulanmalı; önceki altı PASS bu ağaca taşınmaz.
- Bağlı Browser aracı `Unknown tool browser.js`; alternatif bulut tarayıcısında proje
  Claude giriş sayfasına yönlendi. Oturuma mesaj gönderilmedi, çalışan iş bilinmiyor,
  Superpowers canlı kullanım kanıtı yok. Önceki engel tekrar bildirilmedi.
- Main'e veya Claude dalına birleştirme, dağıtım, satın alma, hesap/imza işlemi yapılmadı.
  22 gerçek cihaz kontrolü BEKLİYOR; M5 tamam değil. Safari'de paylaşılabilir bir test
  bağlantısı henüz yok; web export oluşturmak telefonda kurulum veya barındırma değildir.

## 2026-11-10 / Son web regresyonunun CI hatası ve dar düzeltmesi

- Gerçek uzak ref listesinde en yeni Claude dalı hâlâ `cfd122b`; PR #1 başı `634adc3`.
- GitHub Actions `42827699547`, iş `129869224126` ham günlükleri okundu: tür/lint,
  362 test ve web export geçti. İlk iki web akışı geçti; M2, yeni güvenlik
  denetimlerini geçtikten sonra satır 211'de olmayan açma düğmesini bekleyerek durdu.
  Sonraki üç akış bu işte çalışmadı; tüm altı geçti denemez.
- Kaynak nedeni: sekme değişimi açık haftalık ekranın `mode` durumunu koruyor;
  kontrol kaydı sonrası `dataVersion` etkisi aynı ekranın önerilerini yeniden okuyor.
  Test artık ikinci kez açma düğmesine basmak yerine haftalık özeti ve taze
  öneriyi bekliyor. Gizlenen 500 yükü, kapalı kabul, taze 62,5 kg ve açık onay
  denetimleri korunuyor; ürün kodu değişmedi.
- Bu ağaçta `node --check`, typecheck, lint, iki depoda 362/362 test ve web export
  çalıştırıldı ve geçti. Yeni tam tarayıcı sonucu CI'da doğrulanmayı bekliyor.
- Browser bağlantısı yine `Unknown tool browser.js`; Claude'a doğrudan ileti yok.
  Önceden bildirilen engel tekrarlanmadı. Superpowers canlı kullanım doğrulaması yok.
  M5 gerçek cihaz/imza adımları bekliyor; native test veya dağıtım yapılmadı.


## 2026-11-10 / Kontrol engelinde doğrulanmamış yük önizlemesi

- `33043fb` için temiz GitHub Actions işi `42826440910` tamamlandı; ham günlüklerden
  362 test, tür/lint, web export ve altı PASS akışı doğrulandı. Birleştirme inceleyeni ayrıca
  75/75 odaklı test ve kurtarma betiğinin sözdizimini çalıştırdı; dar bütünleştirmede kusur yok.
- Sonraki bağımsız sınır incelemesinde P2 bulundu: geri yüklenmiş önerinin `after.load=500`
  değeri, yeni gün kontrolü yokken tekrar hesaplanamıyor; öneri `pending` kaldığından
  arayüz rakamı ve olumlu gerekçeyi gösterebiliyordu. Kabul yolu `readiness-blocked` ile
  reddediyor, kontrol sonrası `sameNumbers` uyuşmazlığı yakalıyordu; plan değişikliği açığı yok.
- İki gerçek depoda geçici tanısal test gerçekten çalıştırıldı (2/2): sağlaması yeniden
  hesaplanmış yedeğin kabulü → ertesi gün kontrolsüz değerlendirme → bekleyen 500 yükü →
  kabulün reddi. Tanısal ekleme çalıştırma sonunda geri alındı, ürün testine geçirilmedi.
  Ayrı inceleyen de kaynakta aynı sınırı doğruladı.
- Dar arayüz düzeltmesi: bugün yeniden doğrulanamayan bekleyen öneri yük/gerekçe göstermiyor;
  mevcut programın değişmediğini açıklıyor, kabul kapalı ve reddetme yolu korunuyor.
  Kontrol düzelince mevcut kurallar tekrar çalışır; oyun/XP veya yük reçetesi değiştirilmedi.
- `web-m2.mjs` sentetik bozuk öneri, kontrolsüz yeni gün, gizlenen yük/kabul engeli ve
  kontrol sonrası gerçek 62,5 kg önerisinin onayını sınayacak şekilde genişletildi.
- Bu son UI ağacında 362/362 test, typecheck, lint, web export ve `node --check` geçti.
  Yeni tarayıcı regresyonu CI'da ayrıca doğrulanmalıdır; önceki yeşil iş bu UI değişikliğine
  kanıt değildir. iPhone testleri yapılmadı; M5 tamam değil.


## 2026-11-10 / Güncel Claude dalıyla bağımsız bütünleştirme

- GitHub dal listesi ve uzak ref'ler doğrulandı: en yeni Claude dalı
  `claude/project-thread-odi8ww`, `cfd122ba13d1e5d78669fba38f58226844ac0456`.
- Claude'un yeni haftalık öneri tutarlılığı ve tek paylaşılan depo açma değişiklikleri
  koddan incelendi; kurtarma düzeltmesi kendi dalında da mevcut. `codex/backup-recovery-preview`
  dalına alınırken iki kurtarma senaryosu, gerçek bozuk SQLite/IndexedDB regresyonları,
  okunamayan veri uyarısı, CI ve 22 maddelik cihaz kayıt planı korundu.
- Birleştirmedeki aynı kapsamlı `goodPath` değişken çakışması giderildi;
  `node --check e2e/web-recovery.mjs` geçti.
- Birleşik uygulama ağacında gerçekten çalıştırıldı: 18 dosyada **362/362 test**,
  `npm run typecheck`, `npm run lint`, `npm run export:web` başarılı.
  Bu sayı ve derleme web/Node kanıtıdır, iPhone kanıtı değildir.
- Güncel ağaç için altı tarayıcı akışı henüz doğrulanmadı; önceki `bbe43f7` CI sonucu
  bu yeni ağaç için yeniden kullanılamaz. CI yeni push ile tekrar çalıştırılacak.
- Claude raporundaki Superpowers kullanım beyanı depoda görüldü, ancak bağlı Browser
  yine `Unknown tool browser.js` verdi. Canlı oturum/kullanım bağımsız doğrulanmadı;
  Claude'a bu tur doğrudan mesaj gönderilmedi. Önceki erişim engeli tekrar bildirilmedi.
- QA 6'daki sıfır çalışma setli bitmiş seans notu tek başına ret kuralı yapılmadı:
  `updateSet` bitişten sonra set türünü değiştirmeye izin verir ve ödülü geri almaz.
  Meşru geçmiş düzenlemesini reddeden bir yedek kuralı eklenmedi.
- Main'e birleştirme, yayın, ücretli işlem, Expo/Apple kimliği veya imza işlemi yok.
  M5 gerçek cihaz kaydı hâlâ bekliyor. Aşağıdaki kayıtlar kendi commit/ortamlarına aittir.

M0–M3 web üzerinde çalışıyor ve test edildi. 2026-11-10 bütünlük turu: iki yönlü yedek
doğrulaması, geçici dosya temizliği, bağımsız gizlilik + QA incelemesi ve bulgularının
düzeltilmesi, `preview` (günlük kullanım) derleme profili. Native (iPhone) davranışı —
SQLite migration 4, tek bağlantılı SQLite sürücüsü, bildirimler, sesli okuma, paylaşım/dosya
seçici dahil — gerçek cihazda SINANMADI. M5 hesap/cihaz kararını bekliyor.

## 2026-11-10 / Bütünlük turu: yedek doğrulaması, bağımsız inceleme, iPhone beta hazırlığı

Dal: `claude/project-thread-odi8ww`. main'e birleştirilmedi. Yayın, mağaza gönderimi, ücretli
hizmet, uydurma hesap/paket kimliği/imza yok. Commitler (bu turda, sırayla): `fece84c`,
`40e3c76`, `0380dd2`, `3d26ffd`, `590a20d`, `102c888`, `4ec91f4`, `ca96d62` ve bu belgeyi
içeren son commit.

### Yapılanlar
- **Yedek doğrulaması iki yönlü** (`src/domain/backup/validate.ts`): her görev gününde tam dört
  görev (kontrol, ana görev, alışkanlık 1–2; tür ve taban XP sabit), tamamlanmış görev ⇔ tek XP
  kaydı, açık göreve XP yok, kontrol görevi ⇔ kontrol kaydı, haftalık değerlendirme ⇔ hafta XP
  kaydı, antrenman bağlantısı doğru göreve gününe/haftaya ait. Kullanıcının bildirdiği iki dosya
  (boş görev listesi; XP kaydı olmayan tamamlanmış görev) artık reddediliyor; onarma yok.
- **QA bulgularıyla eklenenler**: tarih/hafta sırası sıra numarasını izlemeli ve hiçbir hafta
  son görev gününden sonra başlamamalı (aksi dosya uygulamayı açılamaz yapıyordu); cihaz
  saatinden ileri yedek reddi (`src/domain/backup/clock.ts`); öneri kabulünde saklanan hedef
  yeniden hesaplananla aynı değilse "bayat" (elle değiştirilmiş yedekten gelen hedef uygulanmıyor);
  bitmiş görülen dinlenme sayacı saat geri alınsa da "bitti" kalır.
- **Kayıtlar açılamazsa çıkış yolu**: Ayarlar açık kalır; yedek alma, geri yükleme ve tümünü
  silme kullanılabilir. Hiçbir şey kendiliğinden onarılmaz/silinmez.
- **Tek bağlantılı SQLite sürücüsü** (`src/data/sqlite/serial-driver.ts`): uygulama ve testler
  aynı sarmalayıcıyı kullanır; `withExclusiveTransactionAsync` bırakıldı (ikinci bağlantı
  pragmaları taşımıyordu). iPhone'da çalıştırılmadı.
- **Geçici dosya temizliği** (`src/platform/backup-file-core.ts`, saf ve testli): büyük dosya,
  okuma hatası, paylaşım hatası ve iptal yollarında yalnız uygulamanın kendi önbellek kopyası
  silinir; kullanıcının kaydettiği yedeğe dokunulmaz; temizlik başarısız/doğrulanamazsa arayüz
  "gizli kopya kalmadı" demez, bunu söyler. Açılışta artakalan kopyalar süpürülür.
- **Gizlilik düzeltmeleri**: ölçüm silme kalıcı ve yedeğe girmez; "tümünü sil" sonrası SQLite
  temizliği (`secure_delete`, checkpoint, `VACUUM`) ve sonucun dürüst gösterimi; teslim edilmiş
  bildirimlerin temizlenmesi; kilit ekranı açıklaması; geri yüklemenin hatırlatıcıları yeniden
  açacağı önizlemede yazıyor; sesli okuma ekrandan çıkınca duruyor.
- **Arayüz**: beş sekme 320 pt ve 390 pt genişlikte sığıyor (yalnız web ölçümü); web `lang="tr"`.
- **EAS `preview`**: dahili dağıtım, Release, dev client yok; kod derlemenin içinde, geliştirme
  sunucusu gerekmez. `docs/SETUP.md` günlük kullanım derlemesi (A) ile dev client (B) adımlarını
  ayırıyor. Derleme ÇALIŞTIRILMADI (hesap/imza yok).

### Bağımsız inceleme ve ajanlar (gerçekte olan)
- avci-privacy (salt okuma, kodun yazarı değil): tamamladı; F1–F6 ve C1–C4 bulguları. F1–F6
  ve C1–C2 düzeltildi; C3 (iCloud/cihaz yedeği) yalnız açıklandı, doğrulanamaz; C4 (hata
  metninde olası dosya yolu) değiştirilmedi.
- avci-qa: ilk ajan kullanım sınırı nedeniyle yarıda kesildi; ikinci avci-qa ajanı `0380dd2`
  üzerinde tamamladı (tsc/lint/vitest çalıştırdı, 13 meşru durum dışa aktarıldı ve hiçbiri
  reddedilmedi). Bulgu 1 (YÜKSEK), 2, 3, 4 ve 5'in ilgili kısmı düzeltildi; 6 (DÜŞÜK) kalan
  bulgular arasında.
- Superpowers (obra/superpowers 6.4.2) bu bulut oturumunda yüklü ve çağrılabilir. Gerçekten
  çağrılan beceriler: `systematic-debugging`, `test-driven-development`,
  `verification-before-completion` (QA düzeltmelerinde: önce kırmızı test, düzeltmeyi geri
  alıp kırmızıyı yeniden görme, sonra tam paket) ve `requesting-code-review` (`3d26ffd..ca96d62`
  için ayrı, salt okuma bir gözden geçirici alt ajan; ilk denemesi kullanım sınırına takıldı,
  sınır sıfırlanınca kaldığı yerden tamamladı; kendisi vitest 356 PASS ve tsc çalıştırdı).
  Gözden geçirme sonucu: Kritik yok. Önemli 1 (haftalık değerlendirme, rakamları kurallardan
  farklı bekleyen öneriyi göstermeye devam ediyordu) → kırmızı testle düzeltildi; ortak
  `sameNumbers` yardımcı fonksiyonu hem kabulde hem değerlendirmede kullanılıyor. Önemli 2
  (saati ileri alınmış cihazın kendi yedeği yeni cihazda reddedilir) → davranış korunuyor,
  kullanıcı kararı olarak aşağıda. Küçük 3 (sağlayıcı yeniden çalışırsa ikinci depo açılabilir)
  → tek paylaşılan açma sözü ile düzeltildi. Küçük 5 (mevcut kayıtlar okunamazsa önizleme
  düşüyordu) → kırmızı testle düzeltildi, "şimdi" sütunu "okunamadı" gösterir; web kurtarma
  akışına hata ekranından sağlam yedeği geri yükleme eklendi. Küçük 4 ve 6 kalan bulgularda. Bu turun ilk düzeltmeleri
  (iki yönlü doğrulama, geçici dosya) test-önce yazılmadı; iki kullanıcı vakası için
  kırmızı sonradan eski doğrulayıcıya karşı doğrulandı. `m2-migration` v3→v4 hata testi ve
  artış değişikliği testi karakterizasyon testidir (ilk çalıştırmada geçti).

### Çalıştırılan komutlar ve gerçek sonuçlar — BU ortam (bulut, Linux, Node 22.23.4 / npm 10.9.9, `apps/mobile`)
- `npx tsc --noEmit` → hata yok. `npx expo lint` → çıkış 0.
- `npx vitest run` → 17 dosya, 360 test geçti (SQLite node:sqlite + IndexedDB fake-indexeddb).
- `npx expo export --platform web` → `dist/` üretildi.
- `npm run test:web` (Playwright/Chromium, saat sabit) → altı akış PASS, 105 denetim:
  persistence 9, training 17, M2 19, M3 28, layout 22 (320 ve 390 px), recovery 10.
  (Önceki kayıttaki "M3 29 denetim" yanlıştı; gerçek sayı 28.)
- `CI=1 npx --yes expo-doctor` → 18/20. 2 denetim ağ nedeniyle ÇALIŞMADI (`exp.host`
  çözülemedi: config şeması, React Native Directory). GEÇTİ SAYILMAZ.
- `CI=1 npx expo install --check` → "HTTP Proxy Network Error: Forbidden", çıkış 1.
  ÇALIŞMADI, geçti sayılmaz. Yerel karşılaştırma (package.json ↔
  `node_modules/expo/bundledNativeModules.json`, 30 paket, 0 uyumsuz) resmî denetimin yerine geçmez.
- `npx expo export --platform ios` (geçici dizine) → 3,4 MB Hermes paketi üretildi. Bu bir
  derleme, imza veya cihaz testi DEĞİLDİR.

### Bağımsız ortam sonucu — kullanıcının çalıştırdığı (ayrı tutuluyor)
- Commit `0380dd2a9c98c97f988bcd31089c1a3a99607d0a`, temiz klon; Node 24.22.1 / npm 11.9.0.
- `npm ci` OK; `npm test` 16 dosya / 328 test PASS; typecheck ve lint PASS; web export PASS.
- `CI=1 npx --yes expo-doctor` → 20/20 PASS (o ortamda).
- `CI=1 npx expo install --check` → "HTTP Proxy timed out", çıkış 1 (geçti sayılmaz).
- `npm run test:web` başlamadı (Chromium yok; `npx playwright install chromium` indirmesi
  geçerli ZIP değildi). Bağımsız tarayıcı akışı ÇALIŞTIRILMADI.
- Bu sonuç benim ortamımdaki 18/20 sonucunu değiştirmez; farklı commit (0380dd2, bu turun
  QA düzeltmelerinden önce) ve farklı sürümlerdir.

### Kabul ölçütleri eşlemesi (ACCEPTANCE.md) — M0–M3 günlük kullanım
Kanıt türü: T = vitest (iki depo), W = web Playwright akışı, — = yok. Hiçbiri iPhone kanıtı değildir.
| # | Ölçüt | Durum |
|---|---|---|
| İlk dilim | profil → bugün → kontrol → ana görev → XP → yeniden açılış | T + W; uçak modu iPhone'da yok |
| 1 | çift dokunma/tekrar/çift içe aktarma tek ödül | T + W |
| 2 | aynı gün plan değişikliği / antrenman↔toparlanma ikinci ödül yok | T |
| 3 | alışkanlık değiştirerek ödül çiftlemesi yok | T |
| 4 | saat dilimi, geri saat, ön plan, kaçan gün, DST | T (DST başlangıç ve bitişi); ön plan dönüşü iPhone'da yok |
| 5 | çarpan reçeteyi/bugünkü XP'yi değiştirmez | T |
| 6 | ek set XP vermez, planlı dinlenme eşit ödül | T |
| 7 | kaçan/hasta gün borç/ceza yok | T |
| 8 | rütbe ağrı/hastalık korumasını geçmez | T (hastalık/eklem ağrısı kuralları + eğitim modülleri oyun koduna bağlı değil) |
| 9 | eksik RIR, eksik set, ekipman/yük türü değişimi artışı durdurur | T (dambıl başına dahil) |
| 10 | %5 sınırını aşan en küçük artış yükü korur | T |
| 11 | sıfır yük, NaN, aralık, en yüksek seviye | T |
| 12 | LLM önerileri | M4 (LLM yok); deterministik öneri doğrulaması ve bayatlık T |
| 13 | kabul/ret/yeniden başlatma denetim geçmişi | T |
| 14 | dışa/içe aktarma, geçersiz/gelecek dosya, migration hatası | T + W; migration hatası T (v2→v3 kurtarma; v3→v4 karakterizasyon) |
| 15 | HealthKit bilinmeyen değerler | M4/kapsam dışı (HealthKit yok) |
| 16 | eşitleme mezar taşı, iki cihaz | M4 (eşitleme yok); yalnız açık geri yükleme T |
| 17 | eski seans / uzun ara artış vermez, yeniden temel | T |
| 18 | haftalık değerlendirme tek ödül | T; iki cihaz M4 |
| 19 | hastalık yapılandırılmış antrenmanı durdurur; eklem ağrısı uyarısı | T (hastalık); eklem ağrısı: uyarı + yük artışı durur, hareket bazlı otomatik duraklatma YOK (açık) |
UX: profil/izin/hesap olmadan başlama W; boş geçmiş/hata/tekrar dene W (recovery); antrenman
yarıda bırakma/devam W; uzun Türkçe etiketler W (yalnız web, büyük yazı tipi iPhone'da yok);
Reduced Motion: uygulamada süs animasyonu yok, iPhone'da sınanmadı; ses/titreşim yok;
hatırlatıcı reddi ve çiftsizlik T (sahte zamanlayıcı); TTS durdurma T, Türkçe ses iPhone'da yok.

### M5 iPhone beta — gerçekten hesap/cihaz gerektirenler
Bağımsız yapılabilenler bitti (preview profili, SETUP ayrımı, doğrulama, kurtarma yolu, sürücü).
Kalanların hepsi hesap veya cihaz ister; hiçbiri uydurulmadı:
1. Expo hesabı + `eas login` + `eas init` (proje kimliği `app.json`'a yazılır).
2. Kullanıcının kendi paket kimliği (`ios.bundleIdentifier`, ör. ters alan adı).
3. Ücretli Apple Developer Program üyeliği (dahili dağıtım ve cihaz imzası için).
4. iPhone'un kaydı (`eas device:create`), ardından EAS'in yönettiği sertifika ve profil.
5. `eas build -p ios --profile preview` → cihaza kurulum → `docs/SETUP.md` gerçek cihaz kontrol
   listesi: migration 4 (M0–M2 verisiyle), tek bağlantılı sürücü, arka plan/ön plan ve sayaç,
   bildirim izni/teslimi/silme, Türkçe ses ve sessiz mod, paylaşım ve Dosyalar'dan içe aktarma,
   belge seçici önbellek dizini, büyük yazı tipi ve VoiceOver, uçak modu.

### Kalan bulgular (düzeltilmedi)
- Gözden geçirme 2 (kullanıcı kararı): cihaz saati bir süre ileri alınmışken yazılmış bir yedek,
  saat düzeltildikten sonra (ör. yeni telefonda) o zamana kadar geri yüklenemez. Şu anki kural
  reddetmek; alternatif, uyarıyla kabul edip ödülleri o ana kadar dondurmak.
- Gözden geçirme 4: bitmiş sayaç, bitişten sonraki ilk 5 sn'lik kayıt aralığında uygulama
  öldürülür ve sonra saat geri alınırsa "belirsiz" görünebilir (süre yine uzamaz).
- Gözden geçirme 6 (iPhone'da farklı olabilecekler, sınanmadı): geliştirme modunda expo-sqlite
  DevTools aynı bağlantıyı kullanabilir; ROLLBACK da başarısız olursa sonraki işlemler yeniden
  başlatmaya kadar başarısız olur; hiç bitmeyen bir işlem tüm veritabanı erişimini bekletir.
- QA 6: kabul edilmiş öneri ↔ plan çapraz denetimi 2026-11-11 düzeltildi (yukarıda); sıfır setli ödüllü bitmiş
  seans kabul ediliyor; bilinmeyen `exerciseId`'li öneri kabul ediliyor; geri okuma yalnız sayı
  ve XP'yi karşılaştırıyor; dışa aktarma uyarısı 20 MB sınırını söylemiyor; tarihî kayıtlar
  güncel kataloglarla doğrulanıyor (altın dosya testi önerildi).
- QA 5 kalıntısı: gözlenmeyen aralıkta küçük saat geri alma fark edilmez (DECISIONS.md).
- Gizlilik C3 (cihaz/iCloud yedekleri) ve C4 (hata metninde dosya yolu).
- Eklem ağrısında hareket bazlı otomatik duraklatma yok (yalnız uyarı ve artış durdurma).
- Yedek dosyası şifrelenmez (arayüzde yazıyor).

## Önceki bağımsız kontrol kaydı (tarihsel)

## 2026-11-10 / Kurtarma düzeltmesinin ayrı incelemesi

- Uzak ref'ler yeniden doğrulandı: Claude devam dalı `4ec91f4`, kurtarma PR dalı
  `aa272ae`; daha yeni Claude dalı yok. `aa272ae` ile önceki yerel `26aece7`
  aynı dosya ağacıdır (`git diff --quiet` temiz).
- Düzeltmeyi yazmayan ayrı inceleme ajanı `4ec91f4..26aece7` farkını,
  kabul ölçütlerini, servis/UI, regresyon testleri ve CI izinlerini okudu.
  Müdahale gerektiren bulgu bildirmedi. Bu dar kurtarma düzeltmesinin ayrı kod
  incelemesi tamamlandı; genel native kabul veya M5 onayı değildir.
- İnceleyenin gerçekten çalıştırdığı kontroller: yedek/kurtarma odaklı
  33/33 test, typecheck ve lint geçti. Tarayıcı akışları tekrar çalıştırılmadı;
  önceki commit'e ait altı akış kanıtı korunur. Native test yapılmadı.
- Bağlı tarayıcı yine `Unknown tool browser.js` verdi. Claude'a mesaj
  gönderilmedi; çalışan iş ve Superpowers oturum kullanımı doğrulanmadı.
  Aynı erişim engeli için kullanıcıdan yeniden işlem istenmedi.
- PR çalışma dalında korunur; main'e birleştirme, dağıtım, hesap/imza veya
  ücretli hizmet işlemi yok. Claude dalına aktarım ve gerçek cihaz kayıtları bekliyor.

Son doğrulama (2026-11-10): `bbe43f7` için GitHub Actions temiz ortamında
357 test, typecheck, lint, web export ve **altı Chromium kabul akışı GEÇTİ**.
Kaynak: https://github.com/ekzbek0/Hunterr-fitness/actions/runs/42793877759
M5 gerçek cihaz kanıtı hâlâ yok; aşağıdaki eski web engeli tarihsel kayıttır.

## 2026-11-10 / CI kanıtı doğrulaması ve M5 test kaydı

- GitHub dal listesi ve gerçek uzak ref'ler yeniden okundu: Claude devam dalı hâlâ
  `claude/project-thread-odi8ww` (`4ec91f4`); daha yeni Claude dalı bulunmadı.
  Kurtarma düzeltmesi `codex/backup-recovery-preview` dalında, PR #1 taslak ve açık.
- Actions run `42793877759`, job `129753911574`: çalıştırılan commit tam olarak
  `bbe43f7e91e9fa4aee8f840913b0ca10093b144b`. İş adımları ve ham günlükler bağımsız
  okundu; Claude'un raporu kanıt alınmadı. Temiz `npm ci`, 18 dosya/357 test,
  typecheck, lint, web export başarılı. Altı PASS satırı: persistence, training,
  M2, M3, layout, recovery. Son akış bozuk mevcut tablo → bilinmeyen toplamlar
  uyarısı → açık geri yükleme → yeniden açılışta 10 XP adımlarını gerçekten çalıştırdı.
- Aynı uygulama ağacı bu kontrolde yerelde yeniden sınandı: `npm test` (357/357),
  `npm run typecheck`, `npm run lint`, `npm run export:web` başarılı.
- Kaynakta ağ gönderimi/analiz/kullanıcı verisi log çağrısı taraması eşleşme vermedi;
  bu OS/ağ trafiği veya gerçek cihaz gizlilik kanıtı değildir.
- `docs/IPHONE_BETA_CHECKLIST.md` 22 gerçek cihaz akışı ve kanıt alanlarıyla hazırlandı;
  tümü BEKLİYOR. `preview` internal/Release/developmentClient=false doğrulandı.
  Build, hesap/imza seçimi ve native test yapılmadı. M5 tamamlandı sayılmaz.
- Bağlı tarayıcı aracı yine erişilemedi (`Unknown tool browser.js`); Claude'a mesaj
  gönderilmedi, çalışan işi ve Superpowers oturum erişimi doğrulanmadı.
- Sonraki somut iş: Claude erişince PR farkını bağımsız inceleyip çalışma dalına aktar;
  ardından kullanıcının Expo/Apple kimlik ve imzalama seçimiyle gerçek cihaz testlerini
  başlat. Main'e birleştirme, yayın, satın alma yok.

Son bağımsız kontrol ve dar kapsamlı kurtarma düzeltmesi: aşağıdaki 2026-11-10 inceleme
bölümü. Claude dalının `4ec91f4` sürümü incelendi; düzeltme ayrı
`codex/backup-recovery-preview` dalında korunuyor. Claude dalına aktarılmadı.

M0–M3 web üzerinde çalışıyor ve test edildi (M3: dinlenme sayacı saat düzeltmesi, Gelişim
sekmesi, yedekleme/geri yükleme/silme, sesli okuma, yerel hatırlatıcılar, EAS hazırlığı).
Native (iPhone) davranışı — SQLite migration 4, bildirimler, sesli okuma, paylaşım/dosya
seçici dahil — gerçek cihazda SINANMADI.

## 2026-11-10 / Bağımsız kontrol ve okunamayan kayıttan yedekle kurtarma

### Kaynak ve inceleme kapsamı
- GitHub dal listesi ve Git geçmişi kontrol edildi: Claude'un en ileri devam dalı
  `claude/project-thread-odi8ww`, incelenen commit `4ec91f4e4a0ac74b0668c91f8c9d838c8e7dbeab`.
  main'e birleştirme, yayın, satın alma, hesap veya imzalama işlemi yapılmadı.
- İnceleyen Codex, incelenen Claude kodunun yazarı değildir. Kod, kabul ölçütleri ve
  testler doğrudan okundu/çalıştırıldı; Claude raporu test kanıtı olarak kullanılmadı.
- Dört zorunlu slot, görev/XP ve hafta/XP ilişkileri, antrenman bağlantıları, geçici dosya
  çekirdeği, silme, SQLite işlem kuyruğu ve kurtarma arayüzü incelendi. Uygulama kaynaklarında
  ağ gönderimi, analiz servisi, istemci sırrı veya kullanıcı verisi loglama çağrısı bulunmadı;
  bu kaynak incelemesidir, ağ trafiği veya işletim sistemi incelemesi değildir.
- Native geçici dosya testleri saf çekirdek/sahte dosya sistemindedir. Expo belge seçicisi,
  paylaşım menüsü ve gerçek önbellek dizini bu kontrolde de cihazda doğrulanmadı.

### Bulgu ve düzeltme
- Mevcut kayıtlar okunamayınca Ayarlar açılabiliyordu, ancak `previewImport` mevcut
  deponun tamamını okuyup özetlemek zorundaydı. SQLite'ta bozuk `profile.habit_keys` JSON'u,
  IndexedDB'de bozuk `ledger` tablosu sağlam yedeğin önizlemesini de engelliyordu.
- `tests/backup-recovery.test.ts` iki depoda önce BAŞARISIZ çalıştırıldı (JSON okuma ve
  özetleme hataları). Düzeltmeden sonra iki test de geçti. Gelen dosya önce tam doğrulanır;
  mevcut özet okunamıyorsa `current: null` olur. Arayüz mevcut sayılar/XP için "bilinmiyor"
  ve tüm mevcut verilerin değiştirileceği uyarısını gösterir; 0 uydurmaz.
- Önizleme mevcut kayıtları onarmaz/silmez. Geçersiz gelen dosya reddedilir; açık onaydan
  sonraki geri yükleme aynı tam doğrulama ve tek işlemde değiştirme yolunu kullanır.
  Testler bozuk depoya dokunulmadığını ve sağlam yedeğin 10 XP ile geri geldiğini doğrular.
- Bu düzeltmenin yazarı Codex'tir; ayrıca başka bir kişi/ajan tarafından incelenmedi.
  Claude ile bağlantı kurulunca bu dar değişiklik ve tarayıcı regresyonu incelenmelidir.

### Gerçek kontroller (`apps/mobile`)
- İncelenen `4ec91f4`: `npm test` → 17 dosya / 355 test geçti;
  `npx tsc --noEmit`, `npm run lint`, `npm run export:web` geçti.
- `npx expo-doctor` → **20/20**; `npx expo install --check` → **Dependencies are up to date**.
  Bu iki sonuç bağımsız ortamda alındı; önceki ağ hatalarının geçmiş kayıtları değiştirilmedi.
- Düzeltme: `npx vitest run tests/backup-recovery.test.ts tests/m3-backup.test.ts`
  → 33 test geçti. `npm run typecheck`, `npm run lint`, `npm run export:web` geçti.
- Düzeltmeden sonraki tam testin ilk çalışmasında, web derlemesi de sürerken kapsamlı
  antrenman kombinasyonu testi 5 sn sınırına takıldı (356 geçti, 1 zaman aşımı).
  Derleme/lint bittikten sonra aynı `npm test`, eşikler değiştirilmeden → **18 dosya / 357 test geçti**.
- Web akışları GEÇTİ SAYILMADI: kurulu `/usr/bin/chromium` ile geçici test başlatıcısı
  kullanılarak `npm run test:web` denendi; Chromium uygulamaya ulaşmadan
  `socket() failed: Operation not permitted` ile kapandı. Yetki gevşetilmedi.
- `e2e/web-recovery.mjs` sağlam yedek → bozuk mevcut tablo → bilinmeyen mevcut toplamlar
  → açık onay → geri yükleme → yenilemede 10 XP akışıyla genişletildi.
  `node --check e2e/web-recovery.mjs` geçti; bu yeni tarayıcı akışı ÇALIŞTIRILAMADI.
- `git diff --check` temiz. Paketler ve EAS/native yapılandırması değiştirilmedi.

### İletişim ve sonraki somut işler
- Bağlı Browser aracı kullanılamadı; alternatif tarayıcı Claude giriş ekranına yönlendi.
  Claude'a bu kontrolde mesaj GÖNDERİLMEDİ, çalışan işin durumu bilinmiyor.
  Superpowers'ın mevcut kod oturumunda erişimi/kullanımı yeniden doğrulanmadı.
- Claude'a iletilecek yeni görev: `codex/backup-recovery-preview` farkını incele; kabul
  edilirse kendi dalına aktar ve altı `test:web` akışını çalıştır (özellikle genişletilen
  `web-recovery.mjs`). Çalışan bir işi kesme ve önceki görevi yeniden gönderme.
- `preview` profili statik olarak doğrulandı: internal + developmentClient=false + iOS
  Release. Gerçek derleme/kurulum yok. Expo proje/hesap kimliği, kullanıcının paket kimliği
  ve Apple imzası/cihaz kaydı hâlâ kullanıcı kararı gerektiriyor; değer uydurulmadı.
- M5 TAMAM DEĞİL: SQLite göçü, arka plan/sonlandırma/saat, bildirim izin/teslim/iptal,
  Türkçe ses/Durdur, Dosyalar/paylaşım ve uçak modunda soğuk açılış gerçek iPhone'da
  sınanmalı. Web ve node:sqlite sonuçları bunların yerine geçmez. M4 eklenmedi.

## 2026-11-10 / Sayaç düzeltmesi + M3

Dal: `claude/project-thread-odi8ww`. main'e birleştirilmedi. Yayın, mağaza gönderimi, ücretli
hizmet yok.

### Oturum ve ajanlar (gerçekte olan)
- İşin başında Agent listesinde avci-* türü yoktu; rolleri tanım dosyalarını okutarak genel
  amaçlı iki alt ajanla uyguladım, her dosyanın tek yazarı vardı:
  - avci-mobile rolü: `src/domain/progress/**`, `src/services/progress-service.ts`,
    `src/app/gelisim.tsx`, `src/ui/progress/**`, `_layout.tsx` (yalnız sekme),
    `tests/m3-progress.test.ts`. Tamamladı.
  - avci-data rolü: `src/domain/backup/**`, `src/services/backup-service.ts`,
    `src/platform/backup-file.ts` yazdı; kullanım sınırı nedeniyle YARIDA KESİLDİ.
    `backup-file.web.ts`, `src/ui/backup-panel.tsx` ve `tests/m3-backup.test.ts` ana oturumca yazıldı.
  - Geri kalan her şey (sayaç, depo/göç, hatırlatıcılar, sesli okuma, Ayarlar, EAS, e2e, belgeler)
    ana oturum. Oturum yeniden başladıktan sonra avci-* türleri yüklendi ama kullanılmadı.
- Ayrı bir bağımsız inceleme (avci-qa/avci-privacy) bu dilimde ÇALIŞTIRILMADI.

### Sayaç düzeltmesi
90 sn'lik sayaçta 60 sn geçince 30 sn kalıyor; saat 30 sn geri alınınca eskiden 60 sn
gösteriyordu. Artık `restView` (eski `restRemainingSeconds` kaldırıldı) saklanan en yüksek
saat okumasına göre geri adımı fark eder ve sayaç kalıcı "belirsiz" durumuna geçer: süre
uzamaz, kalan süre uydurulmaz, yeniden açılışta aynı görünür, kullanıcı yeniden başlatır.
Ayrıntı ve kalan risk: DECISIONS.md.

### M3 davranışı
- **Gelişim sekmesi**: hareket başına tarihli grafik; seri anahtarı hareket + birim (kg/lb) +
  yük türü (toplam/dambıl başına/…), dönüşüm ve birleştirme yok; değer = en yüksek çalışma
  seti yükü (lastik/yüksüz seride en çok tekrar), tablo karşılığı var, 1RM tahmini yok.
  Isınma setleri çalışma serisine girmez, ayrı sayılır. Geçmiş: biten antrenmanlar, açılır set
  listesi (yarıda bırakılanlar gösterilmez). Süreklilik: son 28 gün, antrenman ve planlı
  toparlanma eşit ağırlıkta olumlu; boş günler nötr, borç/ceza dili yok. Ölçümler: isteğe bağlı
  tarihli vücut ağırlığı (kg/lb) ve çevre (cm/inç); silme mezar taşıyla; fotoğraf yok, görünüş
  puanı/BMI yargısı yok.
- **Yedekleme**: `avci-backup` sürüm 1 zarfı (sha256 sağlama, şema bilgisi) tüm M0–M3
  kayıtlarını içerir. İçe aktarmada yazmadan önce tam doğrulama (biçim, sürüm, sağlama, boyut,
  her kayıt, değer aralıkları, benzersiz kimlikler, XP defter anahtarı ve tutarı, ilişkiler);
  etki önizlemesi (şimdi → sonra sayılar ve XP) ve açık onay. Geri yükleme birleştirme değil
  tam değiştirmedir, tek işlemde yazılır ve işlem içinde geri okunarak doğrulanır; bu yüzden
  aynı dosyayı tekrar yüklemek XP'yi çoğaltmaz. Bozuk/desteklenmeyen dosya hiçbir şeyi
  değiştirmez. Dosya bağdaştırıcıları ayrı: web (indirme + dosya girişi), native (expo-file-system
  + paylaşım menüsü + belge seçici). Profil yokken de geri yükleme yapılabilir.
- **Tüm yerel verileri sil**: iki adımlı onay; önce hatırlatıcılar iptal edilir (iptal
  başarısızsa hiçbir şey silinmez), sonra tüm tablolar tek işlemde boşaltılır; gizli kopya ve
  otomatik geri yükleme yok.
- **Sesli okuma**: Bugün'de "Görevleri sesli oku", antrenmanda "Nasıl yapılır" altında "Sesli
  oku"; "Durdur" hemen keser; Ayarlar'dan kapatılır; mikrofon yok; Türkçe ses yoksa metin kalır
  ve nedeni yazılır.
- **Hatırlatıcılar**: Ayarlar'da en fazla 3 saat; plana göre içerik; her değişiklikte çiftsiz
  uzlaştırma; izin reddinde uygulama çalışır ve durum dürüstçe yazılır; web "desteklenmiyor" der.
- **Kalıcılık**: SQLite migration 4 (yalnız ekleyici: `workout_session.rest_last_seen_at`,
  `rest_uncertain`, `measurement`, `app_setting`), IndexedDB belge v3→v4. M0–M2 kayıtları korunur.
- **iPhone hazırlığı**: `expo-dev-client`, `eas.json` (development / development-simulator /
  preview), `expo-notifications` eklentisi yalnız yerel bildirim. Hesap, proje kimliği, paket
  kimliği ve imza YOK; kalan adımlar `docs/SETUP.md` içinde.

### Çalıştırılan komutlar ve gerçek sonuçlar (apps/mobile içinde)
- `npx tsc --noEmit` → hata yok. `npx expo lint` → hata/uyarı yok.
- `npx vitest run` → 15 dosya, 314 test geçti. M3: `m3-backup` 14 (gidiş-dönüş, depolar arası
  gidiş-dönüş, 13 tür bozuk/desteklenmeyen dosyada veri değişmiyor, yazma hatasında geri alma,
  tekrar içe aktarmada XP 110 kalıyor, tüm verileri silme ve iptal sırası), `m3-reminders` 15
  (sahte zamanlayıcıyla: çift yok, saat/taşıma/gün değişimi, izin reddi, desteklenmeyen ortam),
  `m3-progress` 19, `m3-speech` 3, sayaç regresyonu `m2-domain`/`m2-service` (iki depo).
- `npx expo export --platform web` → `dist/` üretildi.
- `npm run test:web` (Playwright/Chromium 390×844, saat sabit): `web-m3.mjs` PASS (29 denetim:
  sayaç 90 sn → 60 sn sonra 30 sn → saat 30 sn geri → süre uzamıyor, yeniden açılışta aynı;
  Türkçe ses yokken metin; web'de bildirim "desteklenmiyor"; Gelişim grafiği/geçmiş/süreklilik/
  ölçüm; yedek indirme; bozuk ve ileri sürüm dosya reddi (85 XP değişmedi); önizleme 85 → 70;
  geri yükleme; ikinci içe aktarma 70 XP; tümünü sil + tarayıcı yeniden açılışta boş; boş
  kurulumda geri yükleme). Önceki üç akışın sonucu aşağıdaki satırda.
- Aynı `dist` üzerinde `web-persistence.mjs`, `web-training.mjs`, `web-m2.mjs` → üçü de PASS (45 denetim).
- `npx expo-doctor` → 18/20; 2 denetim ağ nedeniyle ÇALIŞMADI (`exp.host` çözülemedi: config
  şeması ve React Native Directory). GEÇTİ SAYILMAZ. "Could not fetch bundled native modules"
  uyarısı nedeniyle paket sürümü uyumu da çevrimiçi doğrulanmadı; sürümler `npx expo install`
  ile SDK 58 için çözülmüştü.
- `npx expo prebuild --platform ios --no-install` yalnız geçici bir kopyada, uydurma bir
  deneme paket kimliğiyle çalıştırıldı (repoya yazılmadı): iOS projesi üretildi, push yetkisi
  eklenmedi. Bu bir derleme veya cihaz testi DEĞİLDİR.

### Doğrulanmamış / açık noktalar
- iPhone'da hiçbir şey sınanmadı: migration 4, sayaç (arka plan/saat değişimi), bildirim izni
  ve teslimi, hatırlatıcı güncellemesi, Türkçe ses, paylaşım menüsü/Dosyalar'dan içe aktarma,
  silmenin bekleyen bildirimleri kaldırması. Hatırlatıcı testleri sahte zamanlayıcıyladır.
- Sesli okumanın gerçekten konuştuğu hiçbir ortamda doğrulanmadı (başsız Chromium'da Türkçe ses yok).
- Yedek dosyası şifrelenmez (arayüzde yazıyor). Bağımsız gizlilik/QA incelemesi yapılmadı.
- Beş sekme 390 px'te sığıyor; 320 px veya büyük yazı tipinde dar olabilir (denetlenmedi).
- `T.label` büyük harf dönüşümü web'de "TARİH" yerine "TARIH" gösteriyor (kozmetik).

## 2026-11-09 / M1 düzeltmeleri + M2 / haftalık değerlendirme ve ilerleme

Dal: `claude/project-thread-odi8ww` (`claude/project-thread-aoxh7c` üzerine). main'e birleştirilmedi.

### Oturum ve ajanlar
- Oturum yine main'den başladı; `.claude/agents` altındaki 7 avci-* tanımı repoda var ama
  Agent listesinde avci-* türü YOKTU (yüklenmedi). Rolleri, tanım dosyalarını okutarak genel
  amaçlı alt ajanlarla uyguladım; her yolun tek yazarı vardı:
  - avci-game rolü (yazar): yalnız `src/domain/game/cosmetics.ts`, `src/ui/avatar.tsx`,
    `src/app/karakter.tsx`, `tests/cosmetics.test.ts`.
  - avci-qa + avci-training rolü: salt okuma bağımsız inceleme (aşağıda).
  - Geri kalan tüm yollar ana oturum (tek yazar).

### M1 düzeltmeleri
1. **Hareket sırası**: `diffPrograms` artık yalnız sıra değişikliğini `exercise-order`
   (önce/sonra sıra) olarak döndürür; ekleme/çıkarma tek başına sıra değişikliği sayılmaz.
   Düzenleyicide ↑/↓ düğmeleri; önizlemede "hareket sırası A → B ⇒ B → A"; onay yeni
   `plan_version` yazar; yeniden açılışta korunur. Devam eden/geçmiş antrenman başlarken
   kopyalanan reçete anlık görüntüsünü kullanır, sırası değişmez (testli).
2. **Takvim çakışması**: `acceptProgram` aynı işlem içinde yeni programı bu haftanın
   `schedule_move` kayıtları ve seanslarıyla birleştirip etkin haftayı kurar
   (`findScheduleConflicts`, bugün ve sonrası). Bir günde >1 seans varsa
   `schedule-conflict` + çakışma listesiyle reddeder; hiçbir şey yazılmaz, hiçbir seans
   taşınmaz/silinmez. Yeni `previewProgram` aynı denetimi önizlemede yapar; UI "Takvim
   çakışması" kartını gösterir ve onay düğmesini kapatır. Yeniden üretilen program da aynı
   denetimden geçer.

### M2 davranışı
- **Haftalık döngü** (`weekly_cycle`): görev gününün Pazartesi başlangıçlı haftası; ilk
  açılışta UUID, sıra, sınırlar, saat dilimi ve görev gününün çarpanı yakalanır. Sonraki
  haftanın ilk görev günü önceki döngüyü bir kez kapatır; daha eski haftaya ait bir gün
  (saat/saat dilimi geri) kapanmış döngüyü yeniden açmaz.
- **Haftalık değerlendirme**: Antrenman → "Haftalık değerlendirmeyi aç": hafta özeti
  (planlı/tamamlanan/kaçırılan, çalışma seti, kontrol, toparlanma günü), öneriler, artış
  ayarları. "Tamamla" `weekly_review` + `xp_ledger(scope=week, scopeId=döngü, slot=weekly-review)`
  kaydını tek işlemde yazar: taban 40 × döngünün sabit çarpanı, döngü başına bir kez
  (tekrar deneme, başka gün, yeniden açılış, eşzamanlı çağrı, sonraki haftadan tekrar = mevcut ödül).
  Saat anomalisinde ödül dondurulur. Günlük 100 XP sınırının dışında.
- **İlerleme önerileri** (`src/domain/training/progression.ts`, saf ve deterministik):
  bugünkü kontrol yok/ağrı/hastalık/"bilmiyorum"/uyku<6/yorgunluk≥4/hassasiyet 3 → artış yok;
  son iki seans: son seans >14 gün önce veya aradaki boşluk >14 gün → "yeniden başla" (plan
  değişmez); iki seansın da reçetesi güncel planla aynı, planlanan tüm çalışma setleri,
  her sette üst tekrar sınırı ve RIR≥2 (boş RIR = kanıt yok), seans günlerinde kontrol var
  ve ağrı/hastalık yok, aynı birim (kg/lb dönüşümü yok), aynı yük kaydı türü (toplam /
  dambıl başına / ek yük), tüm setlerde aynı yük. Ek yüksüz vücut ağırlığı ve lastik
  (`band`, artık ayrı yük türü; lastik setinde yük reddedilir) için artış hesaplanmaz.
  Artış yalnız kullanıcının ekipman+birim için doğruladığı en küçük adım; adım yükün
  %5'inden büyükse yük korunur. Her öneride gerekçe + önce/sonra (dambılda "dambıl başına
  X (toplam 2X)"); kabul için "teknik ve hareket açıklığı aynıydı" onayı gerekir.
  Kabul: öneri aynı işlemde güncel plan sürümü ve verilerle yeniden hesaplanır; kanıt
  anahtarı veya plan sürümü farklıysa `stale` olur ve uygulanmaz. Geçerliyse ilgili
  reçetelere `targetLoad` yazan yeni `plan_version` (`proposal_id` ile) oluşur. Ret kaydedilir,
  plan değişmez, aynı kanıt yeniden önerilmez. Engelli hareketler gerekçeleriyle listelenir.
  UI: "Bu eşikler doğrulanmış bir tıbbi algoritma değildir" notu.
- **Dinlenme sayacı**: seansa yalnız başlangıç zaman damgası + süre (60/90/120/180 sn)
  yazılır; kalan süre her saniye ve ön plana dönüşte saatten hesaplanır. Tarayıcı tamamen
  kapatılıp açılınca kaldığı yerden devam eder; saat geri alınırsa süre uzamaz. Bitince
  "Dinlenme bitti" (bildirim yok).
- **Karakter**: seviyeye göre gelişen özgün amblem (halka, arma parçası, taç; 9 kademe) ve
  8 rozet (2/5/10/20/35/50/75/100). Yalnız kozmetik; `cosmetics.ts` yalnız `economy`'yi
  içe aktarır (testle denetleniyor), antrenman yükünü etkilemez.
- **Kalıcılık**: SQLite migration 3 (yalnız ekleyici: `plan_version.proposal_id`,
  `workout_session.rest_*`, `weekly_cycle`, `weekly_review`, `progression_proposal`
  (UNIQUE döngü+hareket+kanıt), `equipment_increment`). IndexedDB belge v2→v3.

### Bağımsız inceleme (avci-qa + avci-training rolleri, salt okuma) ve düzeltmeler
XP çoğaltma veya migration veri kaybı bulunmadı (eşzamanlı değerlendirme ×2 → tek ödül, iki depoda).
Bulunan 6 sorun düzeltildi ve regresyon testleri eklendi:
1. (Yüksek) Düzenleyicide hareket değiştirince kabul edilmiş hedef yük yeni harekete
   geçiyordu (ör. 62,5 kg toplam → dambıl başına). Artık takas/eklemede hedef sıfırlanır ve
   servis, yalnız öneri kabulünün hedef yazmasına izin verir (aynı hareketin mevcut hedefi
   korunabilir veya kaldırılabilir; yeni/taşınmış hedef `target-load` ile reddedilir).
2. (Orta) Farklı bölünmeli yeni program bu haftanın tamamlanmış/devam eden/taşınmış seansını
   sessizce takvimden düşürebiliyordu. Çakışma denetimi artık mevcut planın haftasını da
   karşılaştırır: bugün ve sonrasındaki böyle bir seans kaybolacak veya günü değişecekse
   `would-displace` çakışması; tamamlanmış seans bulunduğu günü dolu tutar. Program önerisi
   ekranı da çakışmayı kabulden önce gösterir. (Bu, iki M1 testinin eski "sessizce kabul"
   beklentisini değiştirdi: aynı gün reddedilir, ertesi gün kabul edilir.)
3. (Orta) Reddedilen öneri sonraki hafta veya ilgisiz bir program düzenlemesinden sonra geri
   geliyordu. Ret/kabul artık kanıt anahtarına (plan sürümünden bağımsız) göre kalıcıdır.
4. (Orta) Kontrolden önce değerlendirmeyi açmak bekleyen öneriyi "geçersiz" yapıp kopyasını
   üretiyordu. Yalnız bugünkü hazır olma durumu engelliyorsa öneri bekler, kabul düğmesi
   kapalıdır ve servis `readiness-blocked` döndürür (öneri bayatlamaz).
5. (Düşük) Lastik hareketi bekleme satırında "0 kg" görünebiliyordu; `updateSet` lastik setine
   yük yazılmasına izin veriyordu. İkisi de düzeltildi.
6. (Düşük) "Hafta değişti" metni gerçekte olmayan bir yeniden yüklemeyi vaat ediyordu; düzeltildi.
Ek test: hafta içinde saat dilimi değişince aynı döngü ve tek ödül.

### Değişen yollar
`apps/mobile/src/{domain/training/{program,catalog,schedule,progression,rest}.ts,
domain/game/{weekly-cycle,cosmetics}.ts,data/**,services/avci-service.ts,app/{antrenman,karakter}.tsx,
ui/{components,labels,avatar}.tsx|ts,ui/training/*}`, `apps/mobile/tests/{m2-domain,m2-service,
m2-migration,cosmetics,migration}.test.ts`, `apps/mobile/e2e/web-m2.mjs`, `apps/mobile/package.json`,
`docs/PROGRESS.md`, `docs/DECISIONS.md`.

### Çalıştırılan komutlar ve gerçek sonuçlar (apps/mobile)
- `npx tsc --noEmit` → hata yok. `npx expo lint` → hata/uyarı yok.
- `npx vitest run` → 11 dosya, 260 test geçti (M1: 167 → 260; inceleme düzeltmeleri dahil). M1 düzeltmeleri ve M2 servis
  senaryoları iki gerçek depoda (node:sqlite ve fake-indexeddb): sıra değişikliği
  önizleme/kabul/yeniden açılış + devam eden seansın sırası; Salı→Perşembe taşıma sonrası
  çakışan düzenleme ve yeniden üretilen program reddi (plan sayısı, taşıma, hafta aynen);
  haftalık XP tekilliği; döngü çarpanı; saat geri alma; öneri kabul/ret/bayat; artış
  sınırı; check-in yokken artış yok; lastik yükü; dinlenme sayacının yeniden açılışta korunması.
  Migration: M1 v2 SQLite verisi v3'e (tüm satırlar korunur; v3 hatasında v2 aynen kalır)
  ve IndexedDB belge v2→v3.
- `npm run export:web` → `dist/` üretildi.
- `npm run test:web` → üç akış PASS: `web-persistence.mjs` (M0), `web-training.mjs` (M1) ve
  yeni `web-m2.mjs` (Chromium 390×844, saat her gün 09:00 İstanbul'a sabit): sıra
  değişikliği önizleme/kabul/yenileme → antrenman + 1:30 dinlenme → 40 sn ileri sar →
  tarayıcıyı tamamen kapatıp aç → sayaç zaman damgasından devam (0:33) → bitir →
  haftalık değerlendirme +40 XP (toplam 110), yenilemede korunur → Salı: Çekiş A'yı
  Perşembe'ye taşı → İtiş B'yi Perşembe'ye al → çakışma kartı, onay kapalı, sürüm değişmedi
  → Cuma ikinci bench seansı → Cumartesi: artış doğrulanmadan öneri yok → 2,5 kg doğrula →
  öneri (önce 60 kg / sonra 62,5 kg) → teknik onayı olmadan kabul kapalı → kabul →
  yenilemede "Kabul edildi" ve program sürümü 3 → Karakter'de amblem ve rozetler; sayfa hatası yok.
  Ekran görüntüleri proje dosyalarında `avci-m2/`.
- `npx expo-doctor` → 18/20; **2 kontrol ağ nedeniyle başarısız** ("Expo config schema":
  `getaddrinfo ENOTFOUND exp.host`; "React Native Directory": sunucu yanıtı yok).
  GEÇTİ SAYILMAZ.

### Doğrulanmamış / açık noktalar
- iPhone: migration 3, dinlenme sayacının gerçek arka plan/kilit ekranı sonrası davranışı,
  sayısal klavye, VoiceOver ile amblem/rozet okuması — SINANMADI (web kanıtı cihaz kanıtı değildir).
- Dinlenme bitişinde yerel bildirim/titreşim yok (bildirim izni M3 kapsamı).
- "Hafif hafta" (performans düşüşü + yüksek yorgunluk) önerisi ve hareket bazında ağrı
  bölgesi henüz yok. Değerlendirme yalnız içinde bulunulan hafta için yapılabilir
  (kapanmış hafta yeniden açılmaz).

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
1. Kullanıcı kararı: Expo hesabı, paket kimliği, Apple Developer üyeliği ve cihaz kaydı
   (yukarıdaki M5 listesi, `docs/SETUP.md`). Sonra `preview` derlemesi ve gerçek cihaz listesi.
2. Ağ olan bir makinede `npx expo install --check` (iki ortamda da çalışmadı).
3. Kalan QA 6 bulguları ve eklem ağrısında hareket bazlı duraklatma.

## Completed milestones
- M0: web üzerinde tamam ve test edildi. Native kısmı gerçek cihazda doğrulanmadı.
- M1: web üzerinde tamam ve test edildi (2026-11-09). Native kısmı gerçek cihazda doğrulanmadı.
- M2: web üzerinde tamam ve test edildi (2026-11-09). Native kısmı gerçek cihazda doğrulanmadı.
- M3: web üzerinde tamam ve test edildi (2026-11-10). Native kısmı gerçek cihazda doğrulanmadı.

## Update template
For each slice: date / milestone / implemented behavior / changed paths /
commands with actual results / unresolved blockers / next concrete task.
Never store user secrets, personal health records or photos in this file.
