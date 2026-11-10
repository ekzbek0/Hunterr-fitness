# Decisions

- 2026-11-08: iPhone-first Expo/React Native/TypeScript; single app initially.
- 2026-11-08: native SQLite + separate persistent web repository adapter.
- 2026-11-08: game rank and physiological progression are separate domains.
- 2026-11-08: program adaptation is deterministic; LLM optional explanatory layer.
- 2026-11-08: local core precedes accounts, photo storage, HealthKit and API AI.
- 2026-11-08: original fantasy visuals; no franchise asset package.
- 2026-11-08: seven ordinary project subagents; no experimental teams by default.
- 2026-11-08: prepare and code first; accounts/payments/publication are later steps.

- 2026-11-09: Expo SDK 58 (npm `latest` 58.0.23), Node 22 LTS; tek uygulama `apps/mobile`.
- 2026-11-09: Görev günü seyahat politikası: açık gün, hem yakalanan saat dilimi hem
  cihazın güncel saat dilimi tarihini geçtiğinde kapanır. Doğuya seyahat günü erken
  bitirmez; batıya seyahat günü en fazla saat farkı kadar uzatır; aynı tarihli iki gün
  ve kapalı günün yeniden açılması imkânsız. Kaçırılan günler doldurulmaz.
  Doğrulama: tests/task-day.test.ts, tests/service.test.ts.
- 2026-11-09: Saat 5 dakikadan fazla geri alınırsa (gün içi en yüksek görülen saate göre)
  yeni ödüller dondurulur; veriler korunur ve saat yetişince ödül tekrar açılır.
- 2026-11-09: XP yuvarlama: çarpan yarım birim tamsayı olarak saklanır (1..4);
  verilen XP = floor((taban*yarım+1)/2) (yarımda yukarı). Verilen miktar defterde saklanır.
- 2026-11-09: Web kalıcılığı: IndexedDB'de tek sürümlü belge, revizyon kontrollü atomik
  commit (sekmeler arası çakışmada yeniden dene). M0 veri hacmi için yeterli; veri büyürse
  nesne deposu başına tablolar veya doğrulanmış web SQLite'a geçiş değerlendirilecek.
- 2026-11-09: Native kalıcılık: expo-sqlite, WAL, withExclusiveTransactionAsync,
  sürüm tablolu sıralı migration'lar. Testlerde aynı SQL, node:sqlite sürücüsüyle çalışır.
- 2026-11-09: Test aracı Vitest (saf TS + depo testleri); web akışı Playwright betiği.
  RN bileşen test aracı UI ağırlaşınca eklenecek.
- 2026-11-09: Check-in düzeltmesi kaydı günceller, ödülü tekrar vermez; tamamlanmış ana
  görevin modu değiştirilmez (ikinci ödül veya ödül iptali yok).
- 2026-11-09: Hastalıkta ana görev: kontrol servis katmanında ve tamamlama ile aynı işlemde.
  Sıra: tamamlanmış slot → mevcut ödül (iptal/çift yok); değilse `training` + illness=yes →
  `rejected/illness`. Toparlanma seçenekleri aynı ödülü verir. Doğrulama: tests/service.test.ts.
- 2026-11-09: Playwright tam sürümle (1.63.0) devDependency; tarayıcı ikilisi ayrı adım
  (`npm run e2e:install-browser`). Web testleri saati ve saat dilimini sabitler.
- 2026-11-09: Antrenman ödülü: seans, başlatıldığı görev gününün `core` slotunu tamamlar
  (`workoutSessionId` bağlanır). Ertesi gün bitirilen seans kaydedilir ama ödül vermez
  (gün yeniden açılmaz, iki gün tek seansla ödüllenmez). Bitirmek ≥1 çalışma seti ister.
- 2026-11-09: Program sürümleri değişmez; düzenleme = yeni `plan_version` (parentId, sequence,
  reason=yapısal fark JSON'u, kullanıcı onayı anı). Kaydetme `baseVersionId` ile iyimser
  eşzamanlılık denetimi yapar; sessiz son-yazan-kazanır yok. Seans başlarken reçete
  anlık görüntüsü kopyalanır; sonraki düzenlemeler devam eden/geçmiş seansı değiştirmez.
- 2026-11-09: Üretilen program günü kimliği = şablon + tekrar (`push-1`, `pull-2`, `full-a-1`).
  Aynı bölünme yeniden üretilince kimlik korunur; farklı bölünme yeni kimlik alır, böylece
  ilgisiz bir gün "tamamlandı" durumunu devralmaz. Elle eklenen günler benzersiz kimlik alır.
- 2026-11-09: Bitmiş antrenmanın ödülü geçici bir nedenle (saat anomalisi, hastalık) reddedildiyse
  aynı görev gününde durum düzelince `finishWorkout` tekrarı ödülü bir kez verebilir.
- 2026-11-09: Takvim materyalize edilmez: hafta = program günleri + `schedule_move` kayıtları.
  Planlı seans kimliği `${pazartesi}:${programDayId}`; program günü kimliği düzenlemelerde
  korunur, böylece hafta içi program değişikliği tamamlanmış seansı "planlı"ya döndürmez.
  Hafta Pazartesi başlar (tr-TR). Taşıma yalnız aynı hafta, bugün/sonrası, boş gün.
- 2026-11-09: M1'de yük reçetesi yok; kullanıcı yaptığı yükü girer, son seans referans
  gösterilir. Hedef RIR 2 ve tekrar aralıkları ürün varsayımıdır (TRAINING_RULES).
  Yük artışı önerileri M2'de deterministik kurallarla ve onayla gelecek.
- 2026-11-09: Yük birimi set başına saklanır (kg/lb, dönüşüm yok); yük kuralı (toplam/dambıl
  başına/ek yük) hareketten gelir ve sete kopyalanır. Farklı hareket = farklı ilerleme serisi.
- 2026-11-09: Hareket kısıtları kapalı listedir (baş üstü, eksenel omurga yükü, derin diz
  bükme, bilek); teşhis değildir. Kısıtlı hareket üretilmez, doğrulamada reddedilir,
  profil değişince uyumsuz program ile antrenman başlatılamaz.
- 2026-11-09: Migration: SQLite v2 yalnız ekleyici (ALTER ADD COLUMN + yeni tablolar), tek
  işlemde sürüm artışıyla; hata olursa v1 aynen kalır (test edildi). IndexedDB belge v1→v2
  bellekte dönüştürülür ve ilk yazımda kalıcılaşır; gelecek sürüm depoya dokunmadan reddedilir.

- 2026-11-09: Hareket sırası programın parçasıdır: yalnız sıra değişikliği `exercise-order`
  farkıdır ve yeni sürüm yazar. Başlamış seans kendi reçete/sıra anlık görüntüsünü korur.
- 2026-11-09: Program düzenlemesi etkin haftaya göre doğrulanır (program + bu haftanın
  `schedule_move` kayıtları, bugün ve sonrası). Çakışma reddedilir ve gösterilir; seans
  kendiliğinden taşınmaz/silinmez, mevcut taşıma kaydı korunur. Geçmiş günler denetlenmez
  (başlatılamazlar). Ayrıca bugün/sonrasındaki tamamlanmış, devam eden veya taşınmış bir seans
  yeni planda kaybolacak ya da günü değişecekse değişiklik reddedilir (`would-displace`);
  tamamlanmış seans günü dolu tutar. Bu yüzden bölünme değişikliği o gün değil ertesi gün
  kabul edilebilir. Doğrulama: tests/m2-service.test.ts, tests/training-service.test.ts, e2e/web-m2.mjs.
- 2026-11-09: Hedef yük (`targetLoad`) yalnız kabul edilen ilerleme önerisiyle oluşur; elle
  düzenleme aynı hareketin mevcut hedefini koruyabilir veya kaldırabilir, oluşturamaz/taşıyamaz.
  Ret/kabul edilen kanıt hiçbir haftada yeniden önerilmez; yalnız bugünkü kontrol engelliyorsa
  öneri bekler (bayatlamaz), kabul kapalıdır.
- 2026-11-09: Haftalık döngü görev gününden türetilir (Pazartesi başlangıçlı yerel hafta),
  ilk açılışta kalıcı UUID + sınırlar + saat dilimi + görev gününün çarpanı yakalanır;
  sonraki haftanın ilk görev günü bir kez kapatır; kapalı döngü asla yeniden açılmaz.
  Değerlendirme yalnız güncel döngü için yapılır (ödül döngü başına bir kez, defter
  anahtarı week/döngü/weekly-review). Gerekçe: DATA_MODEL "never reopen a closed cycle".
- 2026-11-09: İlerleme eşikleri (14 gün güncellik ve ara, RIR≥2, üst tekrar sınırı iki seans,
  en fazla %5) yapılandırılabilir ürün varsayımlarıdır; tıbbi algoritma olarak sunulmaz.
  "Son iki karşılaştırılabilir seans" = hareketin çalışma seti olan son iki bitmiş seansı;
  bunlar birbirine ve güncel reçeteye uymuyorsa daha eski seanslara geri gidilmez (artış yok).
  Seans gününde kontrol kaydı yoksa artış yok. Teknik eşdeğerliği kabul anında kullanıcı onaylar.
- 2026-11-09: Yük artışı yalnız kullanıcının doğruladığı ekipman+birim adımıyla
  (`equipment_increment`: halter, dambıl (tek dambıl adımı), makine, kablo, ek ağırlık);
  kg↔lb dönüşümü yapılmaz. Lastik ayrı yük türü (`band`): kg olarak kaydedilmez, ilerletilmez.
- 2026-11-09: Öneri bir denetim kaydıdır (`progression_proposal`: plan sürümü, kanıt anahtarı,
  önce/sonra, artış, durum pending/accepted/declined/stale). Kabulde aynı işlemde yeniden
  hesaplanır; sonuç farklıysa `stale`. Kabul `targetLoad` içeren yeni `plan_version`
  (`proposal_id`) yazar; `source` CHECK kısıtını değiştirmemek için `user-edit` kalır
  (kullanıcı onaylı değişiklik), köken `proposal_id` ile izlenir. Reddedilen kanıt yeniden önerilmez.
- 2026-11-09: Dinlenme sayacı: yalnız başlangıç zaman damgası + süre saklanır; kalan süre
  saatten hesaplanır (arka plan/yeniden açılış güvenli; saat geri alınırsa süre uzamaz).
- 2026-11-09: Avatar/rozetler saf `cosmetics.ts` ile seviyeden türetilir; ek bağımlılık yok
  (React Native View'larla çizilir), animasyon yok, antrenman alanını içe aktarmaz.
- 2026-11-09: Migration 3 / belge v3 yalnız ekleyicidir; M0/M1 satırları aynen kalır, hata
  olursa v2 korunur (tests/m2-migration.test.ts).

- 2026-11-09 (M3 öncesi düzeltme): Dinlenme sayacı saat politikası. Saklanan: başlangıç,
  süre, `rest_last_seen_at` (sayaç çalışırken görülen en yüksek saat okuması; ekranda her 5 sn
  ve arka plana geçişte, ayrıca Antrenman yüklenirken yazılır) ve `rest_uncertain`. Saat,
  başlangıçtan veya bu en yüksek okumadan 2 sn'den fazla geride görülürse geçen süre
  bilinemez: sayaç kalıcı olarak "belirsiz" olur, kalan süre gösterilmez (asla uzamaz), yeniden
  açılışta da aynı görünür; kullanıcı yeniden başlatır veya kapatır. Tolerans içindeki geri
  okuma en yüksek okuma sayılır (süre yine uzamaz). Kalan risk (2026-11-10 QA
  incelemesiyle DÜZELTİLDİ, önceki "en fazla ~7 sn" ifadesi yanlıştı): geri adım yalnız saat,
  görülen en yüksek okumanın gerisine düşerse fark edilir. Uygulama gözlem yapmadığı bir
  aralıkta (arka planda/kapalıyken) saat geri alınır ve geri alma miktarı o aralıktan küçükse
  yeni okuma hâlâ en yüksek okumanın ilerisindedir: fark edilmez ve sayaç geri alma miktarı
  kadar geç biter. Hata geri alma miktarıyla sınırlıdır, sabit bir saniye sayısıyla değil.
  Süreç içi monoton saat bunu kapatmaz (yeniden başlatmada sıfırlanır, iOS'ta askıdayken
  davranışı doğrulanmadı), o yüzden eklenmedi. Ayrıca: bitmiş olarak görülmüş sayaç, sonradan
  saat geri alınsa da "bitti" kalır ("belirsiz"e dönmez). Doğrulama: tests/m2-domain.test.ts,
  tests/m2-service.test.ts (iki depo, yeniden başlatma), e2e/web-m3.mjs.
- 2026-11-09: Yerel hatırlatıcılar tamamen cihazda (expo-notifications, yalnız yerel; push
  yetkisi `enableRemoteNotifications: false`, sunucu/hesap yok). Saf `planReminders` önümüzdeki
  7 gün × seçilen saatler (en fazla 3) için deterministik kimlik `avci-<tarih>-<SSDD>-<özet>`
  üretir; özet tetik anı + metni kapsar. Uzlaştırma `avci-` önekli fazlalıkları iptal eder,
  eksikleri planlar, diğer bildirimlere dokunmaz; her yeniden yüklemede (açılış, ön plan, her
  değişiklik) çalışır ve sıralıdır, böylece saat/program/taşıma/gün değişiminde çift kayıt
  oluşmaz. Günün ana görevi tamamlandıysa o günün hatırlatıcısı kalkar. İzin yalnız
  kullanıcı açtığında ve izin "belirsiz"ken bir kez istenir; reddedilirse seçim saklanır,
  hiçbir şey planlanmaz, uygulama normal çalışır ve iOS Ayarlar yolu gösterilir. Web'de
  zamanlayıcı "desteklenmiyor" döner ve arayüz bunu açıkça yazar. DST boşluğundaki saat atlanır.
- 2026-11-09: Sesli okuma yalnız kullanıcı düğmeye bastığında (Bugün görevleri, hareketin
  "Nasıl yapılır" metni), "Durdur" hemen keser, aynı anda tek okuma. Mikrofon/dinleme yok.
  Ayarlar'da kapatılabilir (kapalıyken düğmeler gizlenir). Yalnız Türkçe ses varsa okunur;
  yoksa veya motor yoksa metin ekranda kalır ve nedeni yazılır (yanlış dilde okuma yapılmaz).
- 2026-11-09: iPhone hazırlığı: `expo-dev-client` + `eas.json` (`development` cihaz,
  `development-simulator`, `preview`; hepsi internal). `owner`, `extra.eas.projectId` ve
  `ios.bundleIdentifier` bilinçli olarak YOK: hesap ve paket kimliği kullanıcının kararıdır,
  uydurulmaz. `submit` profili yok (mağaza gönderimi yetkili değil).

- 2026-11-10: Yedek = tam değiştirme, birleştirme değil. Gerekçe: tek cihazlı yerel üründe
  birleştirme XP defterinde ve plan sürüm zincirinde belirsizlik yaratır; değiştirme tekrar içe
  aktarmayı idempotent yapar (XP çoğalmaz). Önizleme bunu açıkça yazar ve onay ister. Zarf:
  `avci-backup` v1 + kanonik JSON üzerinden sha256 (saf TS, bağımlılık yok); daha yeni sürüm
  reddedilir. Sağlama bütünlük içindir, güvenlik değil: bu yüzden sağlaması düzeltilmiş dosya da
  kayıt/ilişki/XP tutarı doğrulamasından geçmek zorundadır. Dosya şifrelenmez.
- 2026-11-10: Tümünü silme sırası: önce hatırlatıcı iptali, sonra veri. İptal başarısızsa silme
  yapılmaz (silinmiş veri için bildirim gelmesi, yarım silmeden daha kötü). Otomatik yedek/geri
  yükleme yok. (Ölçüm silme o gün mezar taşıydı; aşağıdaki bütünlük turu kararıyla kalıcı silme oldu.)
- 2026-11-10: Gelişim: seri anahtarı hareket|birim|yük türü; aynı günün seansları tek nokta;
  yarıda bırakılan seanslar geçmişte/grafikte yok; ısınma ayrı sayılır; 1RM/BMI/görünüş puanı yok.
  Süreklilikte biten antrenman günü "antrenman", aksi halde ana görev çözümü belirler; planlı
  toparlanma antrenmanla aynı olumlu ağırlıkta gösterilir. Gelişim salt okurdur, görev günü açmaz.
- 2026-11-10: M3 kayıtları migration 4 / belge v4 ile yalnız ekleyici olarak geldi; ayarlar tek
  JSON satırı (`app_setting`), varsayılan: sesli okuma düğmeleri açık, hatırlatıcılar kapalı.

- 2026-11-10 (bütünlük turu): Yedek doğrulaması iki yönlüdür ve hiçbir şeyi onarmaz. Her görev
  gününde tam olarak dört görev olmalı (`checkin`, `core`, `habit-1`, `habit-2`; tür ve taban XP
  sabit: 10/60/15/15); bilinmeyen görev anahtarı reddedilir. Tamamlanmış her görevin tam bir XP
  kaydı, her XP kaydının tamamlanmış bir görevi vardır; açık görev için XP reddedilir. Kontrol
  görevi ⇔ kontrol kaydı; haftalık değerlendirme ⇔ hafta XP kaydı. Ana göreve bağlı antrenman
  aynı görev gününe ait, bitmiş ve çözümü "antrenman" olmalı; bir antrenman en çok bir göreve
  bağlanır; antrenmanın program günü kimliği, gününün haftasından türetilenle aynı olmalı.
  Gerekçe: bu dosyalar kabul edilince görevler kayboluyor ya da ödül kalıcı olarak alınamaz
  oluyordu. Taban XP'nin sabit olması bilinçli: v1 yedekleri bu ekonomiyle yazılır; ekonomi
  değişirse yedek sürümü artar. Doğrulama: tests/m3-backup.test.ts (iki depo).
- 2026-11-10: Sıra kuralı. Uygulama "en yüksek sıra numarası = en son gün/hafta" varsayar. Bu
  yüzden yedekte görev günü tarihleri ve hafta başlangıçları sıra numarasıyla birlikte kesin
  artmalı, hiçbir hafta kayıtlı son görev gününden sonra başlamamalı. Aksi dosya uygulamayı
  açılamaz hâle getiriyordu (aynı tarihi yeniden açmaya çalışıp benzersizlik hatası) ya da
  haftayı sonsuza dek sabitliyordu.
- 2026-11-10: Gelecekten yedek reddedilir (`domain/backup/clock.ts`). Yedekteki son görev
  gününün `lastSeenAt` değeri cihaz saatinden 5 dk'dan (görev günü toleransı) ilerideyse ya da
  tarihi, o günün kendi saat diliminde "şimdi"nin tarihinden sonraysa önizleme ve içe aktarma
  reddeder. Gerekçe: ilki ödülleri dondurur, ikincisi "bugün"ü o tarihe kadar sabitler.
  Saat dilimi günün kendi kaydından alınır, böylece daha doğuda alınmış yedek yolculuk
  sonrasında haksız yere reddedilmez. Saat düzeltilince aynı dosya yüklenir; dosya değiştirilmez.
- 2026-11-10: Öneri kabulünde bayatlık denetimi genişledi: saklanan önerinin önceki/yeni
  reçetesi ve ekipman artışı, o anda kurallarla yeniden hesaplananla aynı değilse öneri
  "bayat" işaretlenir ve uygulanmaz. Gerekçe: aynı kanıt anahtarını taşıyan ama hedefi elle
  değiştirilmiş (yedekten gelen) öneri eskiden uygulanıyordu. Saklanan öneri içeriği asla
  yük kaynağı değildir; kaynak her zaman belirleyici kuraldır.
- 2026-11-10: Ölçüm silme artık kalıcı silmedir (mezar taşı yok) ve silinmiş ölçüm yedeğe
  girmez. Gerekçe: gizlilik incelemesi; kullanıcı "sildim" dediği sağlık verisinin cihazda ve
  dışa aktarılan dosyada kalmasını beklemez. M4 notu: eşitleme geldiğinde "silinen kaydın geri
  dirilmemesi" (ACCEPTANCE 16) için içerik taşımayan, yalnız kimlik + silinme zamanı tutan bir
  mezar taşı gerekecek; bu, eşitleme tasarımının parçası olarak eklenecek.
- 2026-11-10: "Tümünü sil" sonrası depo temizliği: SQLite'ta `secure_delete = ON`,
  `wal_checkpoint(TRUNCATE)` ve `VACUUM`; sonuç `storagePurged` olarak arayüze taşınır,
  doğrulanamazsa "kalıntı kalmadı" denmez. IndexedDB'de tarayıcı kalıntısı doğrulanamaz
  (`false`). Arayüz ayrıca dışa aktarılmış dosyaların ve cihaz/iCloud yedeklerinin bu silmenin
  kapsamı dışında olduğunu yazar. Teslim edilmiş bildirimler de temizlenir.
- 2026-11-10: Geçici yedek dosyaları. Yalnız uygulamanın kendi önbellek dizinindeki kopyalar
  silinir; kullanıcının kaydettiği yedeğe dokunulmaz. Paylaşım iptal/hata, okuma hatası ve
  boyut reddi yollarının hepsi temizlik yapar; temizlik başarısız ya da doğrulanamazsa
  arayüz bunu söyler. Açılışta ve "tümünü sil"de artakalan `avci-yedek-*.json` kopyaları
  süpürülür. Belge seçicinin önbellek dizini adı gerçek cihazda doğrulanmadı.
- 2026-11-10: SQLite sürücüsü tek bağlantı + sıralı kuyruk + `BEGIN IMMEDIATE`
  (`data/sqlite/serial-driver.ts`); uygulama (expo-sqlite) ve testler (node:sqlite) aynı
  sarmalayıcıyı kullanır. `withExclusiveTransactionAsync` bırakıldı: her işlem için ikinci bir
  bağlantı açıyor, o bağlantı `foreign_keys`/`secure_delete` ayarlarını taşımıyor ve düz `BEGIN`
  ile başlıyordu (QA, kaynak okuyarak). Gerçek iPhone'da ÇALIŞTIRILMADI.
- 2026-11-10: Kayıtlar okunamadığında çıkış yolu. Depo, ilk okumadan önce yayımlanır; okuma
  hatasında Ayarlar açık kalır ve yedek alma, geri yükleme, tümünü silme kullanılabilir.
  Hiçbir kayıt kendiliğinden onarılmaz veya silinmez. Doğrulama: e2e/web-recovery.mjs (yalnız web).
- 2026-11-10: `preview` EAS profili günlük kullanım derlemesidir: `distribution: internal`,
  `developmentClient: false`, iOS `Release`; uygulama kodu derlemenin içindedir ve geliştirme
  sunucusu gerekmez. `development` profili ayrı kalır (dev client, Metro gerekir).

Record implementation choices here with reason and validation, including
task-day travel policy, persistence adapter, versions, and sync conflict policy.

- 2026-11-10 (bağımsız kurtarma incelemesi): Sağlam yedeğin önizlemesi, mevcut bozuk
  kayıtların okunabilmesine bağlı değildir. Gelen dosya tüm biçim/bütünlük/saat denetimlerinden
  geçer; mevcut özet okunamıyorsa `current: null` ile "bilinmiyor" gösterilir ve okunamayanlar
  dahil tüm kayıtların değişeceği açıkça yazılır. Otomatik onarım, sessiz sıfırlama veya
  tahmini XP yoktur. Açık geri yükleme onayı ve işlem içi doğrulama korunur. Gerekçe:
  `4ec91f4` sürümünde bozuk SQLite JSON'u veya IndexedDB tablosu sağlam yedeği de önizlemeye
  ulaştırmıyordu. `tests/backup-recovery.test.ts` her iki depoda önce başarısız, sonra geçti;
  genişletilmiş `e2e/web-recovery.mjs` henüz tarayıcıda çalıştırılamadı. Düzeltme ayrı
  `codex/backup-recovery-preview` dalında; gerçek iPhone kanıtı değildir.

- 2026-11-10 (web kabul ortamı): Yerel Chromium süreç izni nedeniyle başlayamadığından,
  `.github/workflows/mobile-web-checks.yml` aynı kilit dosyasıyla temiz kurulum, tür/lint,
  iki depo testleri, web export ve altı gerçek Chromium akışını sırayla çalıştırır.
  Yalnız çalışma dallarındaki uygulama/workflow değişikliklerinde tetiklenir. İzinler
  `contents: read`, checkout kimlik bilgileri kalıcı tutulmaz; secrets, dağıtım, imzalama
  veya yayımlama adımı yoktur. Resmî action'lar tam commit SHA ile sabittir.
  Public repo için standart `ubuntu-24.04` runner kullanılır; repo private olursa iş atlanır.
  Dayanak: [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).
  Gerçek sonuçlar ve test edilen commit PROGRESS.md'de kaydedilir; bu web kanıtıdır,
  native kabul kanıtı değildir.
