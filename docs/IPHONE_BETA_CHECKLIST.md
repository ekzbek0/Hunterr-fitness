# M5 — gerçek iPhone kabul kaydı

Durum: **BAŞLANMADI**. Bu belge bir test planıdır; hiçbir satır cihazda geçti anlamına gelmez.
Web, node:sqlite, sahte zamanlayıcı ve dosya sistemi sonuçları bu tabloyu doldurmaz.
Derleme ve imzalama adımları: [SETUP.md](SETUP.md#iphone-builds-what-is-prepared-and-what-needs-your-account).

## Ön koşullar ve kanıt

- Kullanıcının seçtiği Expo projesi, paket kimliği, Apple imzası ve kayıtlı test cihazı.
  Hesap/kimlik/imza uydurulmaz; ücretli hizmet veya mağaza gönderimi başlatılmaz.
- Günlük kullanım profili `preview`: internal / Release / developmentClient=false.
- Yalnız sentetik test kayıtları kullan. Gerçek sağlık kaydı, fotoğraf, hesap şifresi,
  erişim belirteci, Apple sertifikası veya cihaz UDID'sini GitHub'a ya da geliştirme mesajına koyma.
- Her çalıştırmada test edilen commit, EAS build bağlantısı, uygulama sürümü, iOS sürümü,
  cihaz modeli ve tarih kaydedilir. Ekran kaydı gerekiyorsa yalnız sentetik içerik görünür.
- Sonuç sözlüğü: **BEKLİYOR / GEÇTİ / KALDI / ENGELLİ**. GEÇTİ için adımlar, gözlenen sonuç
  ve kanıt bağlantısı gerekir. ENGELLİ veya çalıştırılmayan satır GEÇTİ sayılmaz.

| Kanıt alanı | Değer |
| --- | --- |
| Commit / EAS build | Bekliyor |
| Uygulama ve iOS sürümü | Bekliyor |
| Cihaz modeli / tarih | Bekliyor |
| Testi yapan | Bekliyor |

## Akışlar

Her satır ayrı kaydedilir. Kalıcı silme ve saat değişikliği yalnız ayrılmış test ortamında
kullanıcının cihaz üzerinde yapacağı işlemlerdir. Günlük kişisel kayıtlarla denenmez.

| Kimlik | İşlem | Beklenen gözlem | Sonuç |
| --- | --- | --- | --- |
| I01 | `preview` kur; Metro kapalı ve uçak modundayken soğuk aç | Geliştirme sunucusu istemeden yerel başlangıç ekranı açılır | BEKLİYOR |
| I02 | Kilo/fotoğraf/hesap/bildirim izni olmadan sentetik profil oluştur; kontrol ve ana görevi tamamla | Temel kullanım açılır; kontrol 10 + ana görev 60 XP, fazladan ödül yok | BEKLİYOR |
| I03 | Uygulamayı tamamen kapat/aç; aynı göreve yeniden dokun | Kayıtlar ve 70 XP korunur; aynı ödül tekrar verilmez | BEKLİYOR |
| I04 | Uygun eski sentetik SQLite sürümündeki kuruluma yeni build'i uygulamayı silmeden kur | Migration 4'e geçer; kimlik, plan, set, birim ve XP korunur; eski build yoksa ENGELLİ | BEKLİYOR |
| I05 | Set/tekrar/yük kaydet; arka plana al, kilitle, sonra tamamen kapat/aç | Kaydedilmiş setler aynı seansa döner; ısınma/çalışma ayrımı korunur | BEKLİYOR |
| I06 | 90 sn dinlenme başlat; arka planda bekle ve geri dön | Normal saatle geçen süre hesaba katılır; sayaç baştan başlamaz | BEKLİYOR |
| I07 | Çalışan sayacın görülen yüksek saatinin gerisine saat al; uygulamaya dön ve yeniden aç | Algılanan geri adımda kalıcı “belirsiz”; kalan süre uydurulmaz; yeniden başlatma kullanıcıdadır | BEKLİYOR |
| I08 | Sayaç bittiğini gösterdikten sonra saati geri al | Bitmiş sayaç yeniden çalışmaz; gözlemsiz aralıktaki algılama sınırı DECISIONS.md ile uyumlu açıklanır | BEKLİYOR |
| I09 | Bildirim iznini reddet; yeniden aç | Uygulama çalışır; durum dürüst gösterilir; her açılışta tekrar izin istenmez | BEKLİYOR |
| I10 | Cihaz ayarlarından izin ver; yakın bir saat seç ve uygulamayı arka plana al | Seçilen yerel bildirim bir kez teslim edilir; gerçek teslim zamanı kaydedilir | BEKLİYOR |
| I11 | Saat/program/taşıma değiştir; yeniden aç; ana görevi tamamla | Eski hatırlatıcılar uzlaştırılır; çift yok; tamamlanan gün için eski bildirim kalmaz | BEKLİYOR |
| I12 | Türkçe ses mevcutken elle sesli okuma başlat; Durdur'a bas | Türkçe konuşma gerçekten duyulur; Durdur keser; kendiliğinden okuma başlamaz | BEKLİYOR |
| I13 | Sessiz modda dene; Türkçe ses olmayan cihaz/kurulumda dene | Gerçek davranış kaydedilir; konuşma yoksa metin ve doğru neden korunur; ses yokluğu sınanamadıysa ilgili kısım ENGELLİ | BEKLİYOR |
| I14 | Sesli okumayı Ayarlar'dan kapat; yeniden aç | Seçim korunur; okuma düğmeleri/kendiliğinden konuşma yok | BEKLİYOR |
| I15 | Sentetik yedeği paylaşım menüsüyle Dosyalar'a kaydet; paylaşımı iptal ederek ve hata yoluyla tekrarla | Kullanıcının dışarı kaydettiği dosya korunur; uygulama önbellek kopyası temizlenir veya belirsizlik dürüst bildirilir | BEKLİYOR |
| I16 | Dosyalar'dan sağlam yedek seç; önizlemede vazgeç; sonra onayla | Vazgeçmek veriyi değiştirmez; onay tüm veriyi yedekle değiştirir; tekrar yükleme XP'yi çoğaltmaz | BEKLİYOR |
| I17 | Bozuk, desteklenmeyen ve büyük sentetik dosya seç; seçiciyi iptal et | Ret/iptal mevcut veriyi değiştirmez; uygulamaya ait geçici kopyalar temizlenir veya hata bildirilir | BEKLİYOR |
| I18 | Denetlenmiş test build'inde bozuk mevcut kayıttan sağlam yedekle kurtarma yap | Mevcut sayılar “bilinmiyor”; yedek doğrulanır; yalnız açık onayla geri gelir; test düzeneği yoksa ENGELLİ | BEKLİYOR |
| I19 | Sentetik ölçüm sil; yeniden aç ve dışa aktar | Silinen ölçüm listede/yedekte yok; başka ölçüm değişmez | BEKLİYOR |
| I20 | Sentetik veriler ve hatırlatıcılar varken tümünü sil; yeniden aç | Veriler, planlı ve teslim edilmiş AVCI bildirimleri gider; otomatik geri yükleme yok; dış yedek/iCloud kapsamı doğru açıklanır | BEKLİYOR |
| I21 | Silmeden sonra eski hatırlatıcı saati geçene kadar bekle; yeni sentetik profil aç | Silinen veriye ait bildirim gelmez; yeni profil 0 XP başlar | BEKLİYOR |
| I22 | VoiceOver, büyük yazı ve dar cihazda beş sekme/set girişi/geri yükleme onayını dene | Anlamlı etiketler, ulaşılabilir onay/iptal, taşmayan içerik; ekran görüntüsü tek başına VoiceOver kanıtı değildir | BEKLİYOR |

## Hata kaydı şablonu

- Kimlik / test edilen commit ve build:
- Ön koşullar ve sentetik test adımları:
- Beklenen / gözlenen:
- Yeniden açılış sonrası veri ve XP:
- Kişisel veri içermeyen kanıt:
- Sonuç / kalan engel:

M5 ancak gerçek imzalı cihaz sonuçları ve açık kalanların değerlendirmesiyle tamamlanır.
Bu kaydın hazırlanmış olması, imzalı build veya cihaz testi yapıldığı anlamına gelmez.
