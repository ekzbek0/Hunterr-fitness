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

Record implementation choices here with reason and validation, including
task-day travel policy, persistence adapter, versions, and sync conflict policy.
