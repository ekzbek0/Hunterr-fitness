# AVCI — kişisel spor RPG'si ve Claude Code çalışma planı

Hazırlanma ve kaynak kontrol tarihi: 8 Kasım 2026.
Geçici ürün adı: AVCI. Son isim daha sonra değişebilir.

## Ne yapıyoruz?

Solo Leveling'deki görev–gelişim hissinden esinlenen, kendi görselleri ve
karakteri olan Türkçe bir iPhone spor uygulaması. Her gün kısa kontrol yaparsın;
uygulama antrenmanını, dinlenmeni ve günlük alışkanlık görevlerini gösterir.
Kaydettiğin görevler XP verir; seviyen, rütben ve avatarın gelişir. Antrenman
önerileri ise gerçek performans ve toparlanma kayıtlarına göre değişir.

Bu dosya ve başlatıcı, geliştirme için hazırlanmış çalışma paketidir.
Uygulama henüz yazılmadı; ajanlar kullanıcının bilgisayarına kurulmuş sayılmaz.
Başlatıcı çalıştırıldığında proje dosyaları oluşur. `--setup` resmi Expo
eklentisini kurmayı dener; `--start` hazırlanmış ana komutla Claude Code'u açar.

## Uygulamanın döngüsü

1. **Sabah / ilk açılış:** uyku, enerji, kas hassasiyeti, ağrı ve mevcut zaman.
2. **Bugünün görevleri:** planlı antrenman veya toparlanma; seçilmiş beslenme,
   hareket ve yaşam alışkanlıkları. Antrenman günü kullanıcı tarafından taşınabilir.
3. **Antrenman:** hareket, set, tekrar, ağırlık ve isteğe bağlı RIR kaydı;
   dinlenme sayacı, teknik ipucu, ekipmana uygun alternatif.
4. **Ödül:** XP, E→D→C→B→A→S rütbesi, özgün avatar ve hikâye içerikleri.
5. **Haftalık değerlendirme:** devamlılık, yük/tekrar eğilimi, ölçümler,
   toparlanma. Değişiklik önce gerekçesiyle gösterilir, kabul edersen uygulanır.

`x1` varsayılan XP çarpanı. İsteğe bağlı x0,5/x1/x1,5/x2 yalnız oyundaki
ödülü değiştirir. İki kat XP, iki kat set veya iki kat kardiyo değildir.

## Kişiselleştirme

Önceki konuşmalardaki boy/kilo, antrenman geçmişi, haftada 5 gün ve
PPLPP tercihi sadece doğrulanacak taslaktır. Güncel kilo, günler, ekipman,
sakatsız yapılabilen hareketler, çalışma saatleri ve hedefler ilk açılışta sorulur.
Üst göğüs, yan omuz ve sırt genişliği öncelikleri seçilebilir.

PPLPP'de bacak haftada bir kez çalışabilir. Uygulama bunu tüm kaslar haftada
iki kez çalışıyor diye göstermeyecek; istenirse ikinci bacak teması içeren
bir dağılım önerecek. Fotoğraf şart olmayacak. Ölçümler ve karşılaştırmalı
fotoğraflar ayrı günlükte tutulacak; görünüşe değer veya güzellik puanı verilmeyecek.

## Ekranlar ve özellikler

| Alan | İlk kullanılabilir sürüm | Sonraki genişletme |
|---|---|---|
| Bugün | check-in, ana/yan görev, XP, dinlenme günü | hikâye etkinlikleri |
| Antrenman | set/tekrar/yük, sayaç, not, alternatif | ayrıntılı dönem planlaması |
| Karakter | seviye, rütbe, kozmetik ekipman | özgün animasyon ve ses paketleri |
| Gelişim | devamlılık, hareket eğrileri, ölçüm günlüğü | isteğe bağlı özel fotoğraf günlüğü |
| Koç | kayıtları açıklayan metin ve sesli okuma | sunucu üzerinden AI sohbet/haftalık özet |
| Ayarlar | görev/XP ayarı, günler, dışa aktar/geri yükle | Supabase senkronu, HealthKit |

Temel egzersiz öğretimleri başlangıçtan erişilebilir. Seviye ödülleri yeni
motivasyon sahnesi, hikâye, avatar veya arayüz olabilir. Daha tehlikeli hareketi
kilit açma ödülü yapmayacağız. Video içerikleri lisanslı veya özgün olacak.

## Teknik karar

**Ana yol:** Mevcut Windows + Ubuntu/WSL2 ortamında Claude Code; Expo + React
Native + TypeScript + Expo Router. Önce yerel veriyle çalışan uygulama, sonra
isteğe bağlı bulut eşitleme. İlk önizleme tarayıcıda; iPhone binary'si EAS'te.

| Katman | Seçim ve gerekçe |
|---|---|
| Arayüz | Expo/React Native; iPhone odaklı, web önizlemeli |
| Spor ve oyun mantığı | birbirinden ayrılmış, test edilen TypeScript fonksiyonları |
| Veri | iOS'ta SQLite; web için ayrı kalıcı adaptör |
| Bulut, daha sonra | Supabase Auth/Postgres + RLS + özel fotoğraf deposu |
| Ses | önce expo-speech ile isteğe bağlı metin okuma |
| AI, daha sonra | sunucu anahtarı, sınırlı ve doğrulanan JSON önerileri |
| Doğrulama | tür/lint, anlamlı kural testleri, web akışı, gerçek iPhone testi |

Uygulama açılmak için AI aboneliği, API anahtarı veya internet istemeyecek.
Mobil AI tüketimi ile kod yazdırırken kullanılan Claude hesabı ayrı konulardır.

## Geliştirme ekibi

Ana Claude oturumu koordinatördür. Pakette **7 ajan tanımı ve 8 proje iş akışı**
bulunur. Bunlar ayrı ücretli çalışanlar veya telefonda sürekli çalışan servisler
değil; Claude Code'un ihtiyaç olduğunda kullandığı uzman görev tanımlarıdır.

| Ajan | Sorumluluk |
|---|---|
| avci-architect | ekran/veri sözleşmeleri, kapsam ve bağımlılıklar |
| avci-mobile | mobil ekranlar, antrenman deneyimi, erişilebilirlik |
| avci-training | antrenman kuralları ve kişiselleştirme |
| avci-data | kalıcı veri, migration, yedek, senkron |
| avci-game | görev, XP, rütbe ve ödüller |
| avci-privacy | fotoğraf/sağlık verisi ve izin incelemesi |
| avci-qa | kritik testler, sürüm ve cihaz kontrolü |

Sekiz iş akışı: `/start-avci`, `/build-slice`, `/training-rules`, `/offline-sync`,
`/ui-polish`, `/content-catalog`, `/verify-release`, `/resume-avci`.
İşler bağımsızsa en fazla üç ajan paralel çalışır; aynı dosyaya iki ajan yazmaz.

Resmî Expo eklentisi Expo yönergelerini ve MCP erişimini birlikte sağlar.
Yüzlerce genel araç/eklenti kurmak hedef değil. Önce bu ürünün ihtiyacına uygun
küçük yapı kullanılacak; ek bir araç ancak somut eksikliği çözerse eklenecek.
ECC deposu incelendi; başlangıç için tüm paketinin kurulması gerekli görülmedi.

## Aşamalar ve bitiş ölçütleri

| Aşama | Yapılacak iş | Tamamlandı denebilmesi için |
|---|---|---|
| M0 | Expo iskeleti + günlük görev/XP | görev tamamla → yeniden aç → kayıt ve XP korunuyor |
| M1 | profil + antrenman günlüğü | gerçek set/tekrar kaydı ve gün değiştirme çalışıyor |
| M2 | spor kuralları + karakter | öneri gerekçeli/onaylı; XP tekrar verilmiyor; toparlanma korunuyor |
| M3 | sesli okuma + bildirim + gelişim + yedek | çekirdek günlük kullanım çevrimdışı çalışıyor; export/import sınanmış |
| M4 | isteğe bağlı bulut/AI/fotoğraf/HealthKit | izin reddinde çekirdek çalışıyor; özel veriye erişim testleri geçiyor |
| M5 | iPhone beta ve sürüm hazırlığı | gerçek cihaz günlük akışı, veri kaybı/izin/ağ kesilmesi testleri tamam |

Önce M0–M3 tamamlanır. M4 ayrı genişletmedir; hesap veya ücretli hizmet
gerekiyorsa M0–M3'ü engellemez. M5 için hesap/imzalama adımları geldiğinde
hazır derleme ve kalan gereksinim kullanıcıya açıkça gösterilir.
Tek komut işi başlatır; tek oturumda kusursuz ürün garantisi değildir.
`docs/PROGRESS.md` sayesinde yeni oturumda kaldığı yerden devam eder.

## iPhone'a nasıl gelecek?

1. Safari'de çalışan web önizlemesiyle akış denenir. HealthKit gibi native
   özellikler bu önizlemede çalışıyor gibi gösterilmez.
2. Expo development build, EAS bulut derlemesiyle hazırlanır. Windows'ta yerel
   Xcode gerekmez; fiziksel cihaz ve Apple imzalama adımları gerekir.
3. TestFlight beta hazırlanır. Her build'in test süresi **90 gün**dür; bu,
   sonsuza kadar kullanılacak sabit kurulum biçimi değildir.
4. Uzun vadeli kullanım için uygun App Store dağıtımı değerlendirilir.
   Ad hoc/dev sürümlerinin de imzalama/provisioning süreleri vardır.

Apple Developer Program güncel resmî bedeli **99 USD/yıl**; yerel tutar kayıt
sırasında değişebilir. Expo/Claude/AI servislerinin plan ve limitleri ayrıca
kontrol edilir; ücretsiz sınırsız kullanım sözü verilmez.

Güncel Expo belgesine göre App Store'daki Expo Go SDK54'te kalmıştır; SDK55+
buradan alınamaz. Güncel SDK'yı ücretsiz Expo Go ile iPhone'a kesin kurarız
varsayımı yapılmayacak. Proje sırf bu nedenle eski SDK'ya sabitlenmeyecek.

## “Kendi kendini güncelleme” ne demek?

- **Günlük uyarlama:** kayıtlarına göre görev/öneri üretmek; telefonda çalışabilir.
- **İçerik güncellemesi:** sürümlü hareket/görev/kozmetik kataloğu ve geri alma.
- **Kod güncellemesi:** test edilen ve yayımlanan yeni sürüm. EAS Update sadece
  uyumlu native runtime'a JS/asset güncellemesi gönderir; yeni native özellik,
  SDK veya izin için yeni binary gerekir.

iOS arka planda kesintisiz AI ajanı çalıştırmaz. Günlük görevler açılışta ve
ön plana dönüşte tarih/saat dilimine göre doğrulanır; hatırlatıcılar izinli
yerel bildirimlerle planlanır. Tam gece yarısı kod çalışması garanti edilmez.

## Başlatma

### Önerilen: bilgisayarda Ubuntu / WSL

Python 3.10+, Git, güncel Expo'yla uyumlu Node LTS ve giriş yapılmış Claude
Code gerekir. Python başlatıcı bu araçları varmış gibi kabul edip uydurmaz.
Kurulu araçları kontrol etmek için `--doctor` kullanılabilir.

İndirilen `AVCI_Claude_Baslat.py` dosyasının olduğu klasörde:

```bash
python3 AVCI_Claude_Baslat.py --setup --start
```

Windows PowerShell ve Windows'a kurulu Claude Code kullanılıyorsa:

```powershell
py -3 AVCI_Claude_Baslat.py --setup --start
```

Bu komut `avci-fitness` klasörünü üretir, resmî Expo eklentisini **proje
kapsamında** kurar ve Claude'u ana komutla açar. Kendi oluşturduğu projeyi
tanır; tekrar çalıştırıldığında düzenlenmiş dosyaları korur. Farklı bir projedeki
çakışan dosyaların üzerine yazmaz. Claude Code kurulu değilse önce resmî kurulum bağlantısını
aç; kurulup giriş yapıldıktan sonra aynı komutu tekrar çalıştır.

Sadece dosyaları oluşturmak için `--setup --start` olmadan çalıştır.
Oturum açıldıktan sonra ihtiyaç varsa `/mcp` ile Expo hesabını bağla.
Bu bağlantı yokken de yerel çekirdek geliştirilebilir.

### Claude Code web / cloud

1. Başlatıcıyı bir terminalde çalıştırarak dosyaları üret.
2. Üretilen proje dosyalarını kendine ait bir GitHub deposuna ekle. `.claude/`
   klasörünün de depoya girdiğini doğrula; dosyaları sadece sohbet eki yapma.
3. Claude Code web'de bu depoyu seç. Projenin ajan ve yönerge dosyaları yüklenir.
4. `prompts/01_BASLAT.md` içeriğini gönder.

Bulut oturumları yerel eklentileri otomatik taşımaz. Proje içi yönergeler
kendi başına yeterlidir; gerekiyorsa Expo MCP kimlik doğrulaması ve ağ erişimi
ayrıca yapılandırılır. Linux'ta yerel iOS Simulator yoktur. EAS'in deneysel
uzak simülatörü varsa erişim/ücret doğrulanarak kullanılabilir; gerçek iPhone
testinin yerini tutmaz.

## Claude'a verilecek kısa ana komut

```text
Bu depodaki CLAUDE.md, docs/PROJE_PLANI.md ve docs/PROGRESS.md dosyalarını oku.
AVCI'yi Türkçe, iPhone odaklı ve çevrimdışı çalışan spor RPG'si olarak geliştir.
Projedeki 7 uzman ajanı ve 8 iş akışını ihtiyaç oldukça kullan. Önce M0'daki
kalıcı günlük görev→XP akışını çalıştır; sonra M1–M3'e ilerle. Sadece plan veya
görsel maket sunma. Yükü XP'den ayır, toparlanma gününü ödüllendir, aynı göreve
iki kez XP verme. Her aşamayı ilgili testlerle doğrula ve PROGRESS.md'ye gerçek
durumu yaz. Doğrulanmamış iPhone işlemlerine tamamlandı deme. Hesap gerektiren
genişletmeler yerel çekirdeği durdurmasın. prompts/01_BASLAT.md ayrıntılarını uygula.
```

Bu paket uygulama kodunu Claude'a yazdırmak için somut bir başlangıç sağlar.
Mevcut hesabına veya bilgisayarına bu sohbetten kurulum yapılmış değildir.
Kaynaklar ve kontrol tarihleri `docs/SOURCES.md` içindedir.
