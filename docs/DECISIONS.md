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
  okuma en yüksek okuma sayılır (süre yine uzamaz). Kalan risk: uygulama kapalıyken saat,
  son kayıttan sonraki ~5 sn + 2 sn tolerans içinde geri alınırsa fark edilemez; bu durumda
  bile gösterilen süre en fazla bu kadar uzun olabilir. Doğrulama: tests/m2-domain.test.ts,
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
  yükleme yok. Ölçüm silme mezar taşıdır; "tümünü sil" mezar taşlarını da kaldırır.
- 2026-11-10: Gelişim: seri anahtarı hareket|birim|yük türü; aynı günün seansları tek nokta;
  yarıda bırakılan seanslar geçmişte/grafikte yok; ısınma ayrı sayılır; 1RM/BMI/görünüş puanı yok.
  Süreklilikte biten antrenman günü "antrenman", aksi halde ana görev çözümü belirler; planlı
  toparlanma antrenmanla aynı olumlu ağırlıkta gösterilir. Gelişim salt okurdur, görev günü açmaz.
- 2026-11-10: M3 kayıtları migration 4 / belge v4 ile yalnız ekleyici olarak geldi; ayarlar tek
  JSON satırı (`app_setting`), varsayılan: sesli okuma düğmeleri açık, hatırlatıcılar kapalı.

Record implementation choices here with reason and validation, including
task-day travel policy, persistence adapter, versions, and sync conflict policy.
