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

Record implementation choices here with reason and validation, including
task-day travel policy, persistence adapter, versions, and sync conflict policy.
