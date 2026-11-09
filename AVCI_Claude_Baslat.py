#!/usr/bin/env python3
"""AVCI: Claude Code icin incelenebilir, bagimliliksiz proje baslaticisi.

Python 3.10+. Varsayilan islem yalnizca yeni proje dosyalari olusturur.
--setup resmi Expo eklentisini kurar; --start Claude Code oturumunu baslatir.
Bu dosya spor uygulamasinin kendisi veya iPhone kurulum dosyasi degildir.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tempfile
import textwrap


FILES: dict[str, str] = {}


def add(path: str, content: str) -> None:
    FILES[path] = textwrap.dedent(content).strip() + "\n"


add("CLAUDE.md", r"""
# AVCI project instructions

Build a Turkish, iPhone-first, offline-capable fitness RPG. Read
`docs/PROJE_PLANI.md`, `docs/PRODUCT.md`, `docs/TRAINING_RULES.md`,
`docs/DATA_MODEL.md`, `docs/ACCEPTANCE.md`, then `docs/PROGRESS.md`.

## Implementation
- Expo + React Native + TypeScript + Expo Router. Create the app in `apps/mobile`;
  preserve this repository's instructions. Verify the current stable Expo SDK
  and supported Node LTS from official docs; pin the resulting lockfile.
- Keep the first implementation a single Expo app. Put deterministic pure
  functions in `apps/mobile/src/domain`; no premature packages/monorepo tooling.
- Native SQLite behind repository interfaces; a persistent web adapter for the
  web preview. No unconditional native-only imports in web code.
- First slice works without accounts, API keys, LLM, photos or HealthKit.
  Mock data must be clearly labelled and kept separate from actual records.
- Use migrations, transactional writes, stable IDs and a unique XP ledger.
- User UI and status updates are Turkish; technical identifiers may be English.
- Use original art, titles and sound; preserve the motivating fantasy-system
  atmosphere without copying franchise characters, logos, music or screens.

## Product invariants
- XP/rank never determines physiological load. The XP multiplier affects XP only.
- Planned recovery has the same daily-core reward as a planned workout.
- No punishment workouts, exercise debt, body-attractiveness scores or XP for
  extra unplanned volume. No photo-based exact body-fat or muscle-mass claims.
- Previous profile facts are unconfirmed drafts until the user verifies them.
- Training changes need reason, preview, user acceptance and an audit record.
- AI can explain and propose structured changes; it cannot directly mutate a
  training prescription. Validate every proposal through deterministic rules.
- Safety tutorials are available from day one, never gated behind XP.
- User health data/photos stay out of development fixtures, logs and prompts.
  AI/cloud photo sharing is separately opt-in. No AI key in client bundles.

## Work method
- Main Claude session coordinates. Use project agents for bounded tasks.
  At most three concurrent workers; one writer per path. Reviewers return findings.
- Start with working vertical slices, not a dashboard mockup or a giant rewrite.
- Read `docs/TEAM.md` for ownership and task handoffs. Agent teams are optional
  and disabled by default; ordinary subagents suffice.
- After each meaningful slice run relevant typecheck, lint, domain tests and
  a web export; native-specific behavior needs real iPhone evidence later.
- Keep `docs/PROGRESS.md` and `docs/DECISIONS.md` current. Never mark an unrun
  native check as passed. Report actual commands and failures briefly.
- Do not stop after proposing a plan. Build the next authorized milestone.
  Preserve work when blocked and continue independent local features.
- Routine reversible coding and local installs are authorized. No production
  deployment, paid service purchase or store submission is authorized here.
- Preserve unrelated files; do not weaken permissions or use bypass flags.

## Official Expo tools
If the official Expo plugin is installed, load its overview and relevant
skills when needed. It also registers Expo MCP: do not add a duplicate server.
In cloud sessions, repo agents/skills work but local plugins do not carry over.
Missing MCP access must not block the offline implementation: consult official
docs and proceed. See `docs/SETUP.md` and `docs/SOURCES.md`.
""")

add("AGENTS.md", """
# AVCI

Read `CLAUDE.md` for all project invariants and `docs/PROGRESS.md` for the
current checkpoint. This is a Claude Code handoff kit, not a finished app.
Project workers and reusable workflows are under `.claude/`.
Do not overwrite these files while scaffolding Expo in `apps/mobile`.
""")

add("docs/PROJE_PLANI.md", r"""
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
""")

add("docs/PRODUCT.md", r"""
# Product contract

## Experience
Turkish first, personal single-user, iPhone first. Visual direction: dark navy,
restrained electric blue/violet, legible text, original hunter-avatar fantasy,
clear daily progress and optional restrained haptics. No franchise assets.
Use semantic colors; recovery is a successful state. Dynamic Type, VoiceOver,
44pt interaction targets and Reduce Motion. No flickering or constant particles.

Navigation: Bugün / Antrenman / Karakter / Gelişim / Ayarlar.
Coach explanations can be a contextual sheet; do not add chat as a dependency
for task completion. Show only information useful to the person exercising.

## Onboarding
Confirm current goal, current routine, available days/time, equipment and
exercise limitations. Biometrics and photos optional. Existing conversation
facts are suggestions, never current measurements. Defaults are editable.
Ask about pain separately from normal delayed muscle soreness. Provide a
manual route when permissions are declined. Never ask for drug/stack details
as a requirement for using this app.

## Workouts
Plan a scheduled session; show exercise names, prescription, how-to text,
alternatives preserving movement pattern/equipment. Track actual load unit,
sets, reps, rest and optional RIR; distinguish per-dumbbell from total load.
Warm-up entries never count as hard working sets. Interrupted sessions resume.
Editing prior sets updates history, not retroactive fabricated rewards.
Changing an exercise/equipment creates a different progression series.
Technical clips may be link-outs or licensed assets; show a readable how-to
when missing. Never invent a working video URL.

## Daily loop
Persistent daily snapshot with schedule timezone and multiplier snapshot.
Check-in -> appropriate daily-core slot -> optional chosen habit slots.
Daily-core can resolve to training, planned recovery or illness/pain recovery.
Allow defer/reschedule without tomorrow's exercise debt. No negative XP.
Additional sets/exercise outside the plan earn no additional XP.
Task completion can be self-reported: do not claim objective body verification.

## Game economy: initial tunable design, not physiology
- Check-in 10 XP; daily core 60 XP (workout/recovery equal).
- Two optional habit slots 15 XP each. Base daily maximum = 100 XP.
- Weekly review = 40 XP once per persisted weekly cycle, outside daily cap.
- XP multiplier selection: 0.5, 1, 1.5, 2; default 1. Changes apply to the
  next generated task day, never rewrite completed rewards. Round each slot
  using documented half-up integer rounding. Store granted amount permanently.
- Level threshold for level L>=1: totalXP >= 50*(L-1)*L. Thus L1=0,
  L2=100, L3=300, L4=600. Bound supported levels and use integer-safe arithmetic.
- Ranks by level: E1, D5, C10, B20, A35, S50. Cosmetic prestige only.
- Avatar, title, original story vignette and optional original celebration clip
  unlocks. Exercise safety instructions and useful core functions never gated.
- Photo submission earns no exclusive XP. No reward for body weight itself,
  extreme weight loss, calorie restriction or ignoring pain.
- User can disable story, sound, animations and streak presentation.

## Progress and habits
Show strength/reps for comparable exercises, habit continuity, measurement
trends with dates and units. Weekly average weight only if user elects logging.
No precise body-fat estimate from images. AI visual feedback, if later built,
is separately opt-in and describes only limited observations with uncertainty.
Nutrition tasks start with regular meal planning/logging; exact calorie/fluid
targets require current information and user preference, not avatar rank.

## Scope
M0-M3 local core: onboarding, today, logging, XP, rules, avatar, progress,
local reminders, opt-in speech, export/import and deletion.
M4 optional: private photo journal, account sync, HealthKit, server AI.
No social leaderboard, payments, subscriptions, live 3D world, continuous
listening or AI form-video diagnosis in the first build.

## Acceptance UX
Every screen has loading/empty/error states, navigation back and editable
settings. The user can finish the core without notifications, microphone,
camera, account or HealthKit. No nonfunctional controls labelled as available.
""")

add("docs/TRAINING_RULES.md", r"""
# Adaptive training contract v0.1

## Evidence vs initial product settings
ACSM 2026 supports consistent personalized resistance training, sufficient
volume and training major muscle groups, without universal failure training
or unnecessarily complex techniques. It does NOT validate our readiness score,
our exact thresholds, our XP economy or an individual prescription.

The numbers below are conservative, configurable product hypotheses. Present
them as such in internal docs and explanations; do not attribute them to a
medical trial. Never auto-increase a prescription without acceptance.

## Input
For an exercise: stable exercise/equipment/load-convention ID, planned work
sets, rep range, actual work-set load/reps/RIR, session date, technique/ROM
comparability, relevant pain flags, recovery flags, available increment.
Daily check-in: sleep hours optional, energy 1..5, fatigue 1..5, soreness
0..3, new/increasing joint pain yes/no/unknown, illness yes/no/unknown,
urgent symptoms flags; unknown is a distinct state, never zero.

## Priority and deterministic decision
1. Urgent symptom (chest pain, fainting, unusual severe breathlessness): pause
   training and show urgent-care direction. Use localized emergency copy
   verified for the selected region; do not invent phone numbers.
2. Current systemic illness: pause structured training as a whole and offer
   recovery and appropriate healthcare direction. New/increasing localized
   joint pain: pause affected movements; do not replace them with another
   painful movement. Do not diagnose or treat illness as a hard-workout swap.
3. Missing pain/illness answers or incomplete progression data: do not approve
   load increase. Offer to complete check-in; preserve current prescription.
4. Sleep <6h OR fatigue >=4/5 OR marked soreness 3/3: freeze load increase;
   offer rest or a roughly 25% work-set reduction. Reduction is a proposal,
   bounded to >=1 set for retained exercises; rest is always available.
5. Otherwise follow existing accepted plan. Daily readiness is not permission
   to add random extra sets, increase frequency or prescribe maximal testing.

## Weekly double progression proposal
First apply a recency/training-gap gate: if the latest comparable session is
older than 14 days, or the gap between the two sessions exceeds 14 days,
preserve the plan and offer a conservative rebaseline rather than an increase.
This configurable 14-day gate is a product hypothesis, not a medical cutoff.
Only consider the latest TWO comparable complete sessions for the same
exercise series, with all planned work sets reaching the upper rep target,
RIR >=2 in every work set, no pain/illness/recovery blocker and confirmed
technique comparability. Missing RIR means insufficient evidence.
Propose only the smallest available equipment increment and at most +5% of
the existing load. If the smallest increment exceeds the cap, preserve load;
do not round up, add sets, or demand failure to earn progression.
No automatic 1RM tests. No load progression for zero-load bodyweight exercises
through division by zero: use a separately reviewed progression strategy later.
Two sessions with performance decline and high fatigue can trigger a lighter
week proposal, never an automatic increase. Compare equivalent sessions only.

## Change lifecycle
Inputs -> pure rule evaluation -> structured proposal + reason_codes -> schema
and bounds validation -> UI before/after preview -> user accepts/declines ->
versioned plan. Stable user-editable original always recoverable.
Generate proposals on weekly review or meaningful new data, not every render.
Plan changes never mint another daily-core reward.

## LLM boundary
AI receives a minimal opt-in summary, not a raw photo by default. It can explain
an existing rule outcome or produce a typed candidate. No direct DB write tool
to change prescriptions. Candidate has source/version/reasons and is validated
against equipment, pain/recovery and load/volume bounds before preview.
Malformed, unsupported or excessive candidates are rejected with a readable
fallback. Offline rule logic remains fully available.

## Program frequency
Allow import of the user's preferred 5-day PPLPP. State actual weekly muscle
exposure accurately, including one leg session if that is the schedule. Offer
a reviewed alternative if two exposures are desired. No forced daily anime
challenge such as 100 pushups/situps/squats + 10km regardless of baseline.

## Clinical limits
This is a personal training organizer, not a diagnosis or rehabilitation system.
Safety copy is short and contextual, not a repeated blocking disclaimer.
Medication, SARM, steroid and peptide protocols are outside this app's v1 scope.
""")

add("docs/DATA_MODEL.md", r"""
# Data and persistence contract

## Domain separation
`src/domain/training` computes proposals; `src/domain/game` computes rewards;
`src/data` persists; UI uses application services. Domain functions are pure,
clock/random/network are injected. Training functions never import XP/rank.

## Tables (implement migrations, not these descriptions as SQL)
| Entity | Essential fields/invariants |
|---|---|
| profile | id UUID, timezone IANA, preferences, confirmedAt, schemaVersion |
| exercise | id, movement, equipment, loadConvention, howTo, contentVersion |
| plan_version | id, parentId, source, acceptedAt, reason, immutable prescription |
| schedule_slot | stable id, date, sessionTemplateId, state |
| workout_session | UUID, slotId, planVersionId, start/end, syncVersion |
| set_log | UUID, sessionId, exerciseSeriesId, kind warmup/work, reps/load/unit/RIR |
| daily_checkin | taskDayId, optional sleep/energy/fatigue/soreness, safety flags |
| task_day | UUID, sequence, capturedTimezone, localDate, start/end, multiplier |
| quest_slot | taskDayId+stable slotKey UNIQUE, status, kind, version |
| xp_ledger | profileId+scopeKind+scopeId+slotKey UNIQUE, baseXP, multiplier, awardedXP, completedAt |
| weekly_review | stable weeklyCycleId UNIQUE, proposal IDs, accepted/declined |
| measurement | UUID, type, value, unit, measuredAt, tombstone |
| media | UUID, owner, private local/cloud path, consent, tombstone |
| outbox | UUID operation id, entity id, baseVersion, action, retry metadata |
| app_meta | schemaVersion, contentVersion, migrations, lastTaskDay |

## Exactly-once reward
Daily completion + ledger insert are one transaction. Daily reward scope is
`day` with scopeId=taskDayId. Weekly scope is `week` with scopeId=weeklyCycleId
and slotKey=weekly-review. Weekly review completion + its 40-base-XP ledger
insert are one transaction; completing/retrying/importing on another day in
the same cycle cannot reward again. Capture the multiplier when the weekly
cycle first opens; changes never rewrite that cycle's reward. Persist weekly
cycle identity/boundaries/timezone and never reopen a closed cycle after clock
or timezone changes. No row can refer ambiguously to both reward scopes.
A stable daily-core slot
survives workout replacement, rescheduling or recovery mode. Other habit
slot identities also persist through same-day plan edits. A UNIQUE conflict
returns existing reward; never use rendered component IDs as reward identity.
Changing a completed habit preference takes effect next day; no swap farming.
Repeating an import/sync never reapplies XP. Totals derive from the ledger;
any displayed cache must be transactionally consistent and reconstructable.
Completed reward is not revoked when editing a workout. Reopening the same
task does not issue another reward. Explain this in the personal-use UI.

## Day and timezone
Use a taskDay UUID/monotonic sequence with its captured timezone/boundaries.
At foreground/open, resume its unclosed snapshot or close once and create
the next day. A timezone change applies to future snapshots; it must not
reopen a closed day, create simultaneous days or extend a day by rolling back
the device clock. Clock anomalies freeze new rewards until reconciled, with
history retained. Offline history is permitted; do not promise tamper-proof
competition. Specify and test chosen travel policy in docs/DECISIONS.md.
The day's multiplier is captured once; settings changes apply next task day.
Background execution at midnight is not required for correct day generation.

## Offline and web
Native SQLite is behind a repository interface. The web preview uses an
IndexedDB adapter or verified web SQLite configuration; do not silently use
nonpersistent memory or unconditional native imports. Store interrupted set
entry state safely. Apply migrations transactionally and preserve backup.
Tokens in SecureStore; SQLite isn't automatically app-layer encrypted.

## Export/import/delete
Versioned export with clear scope, ISO timestamps, units, checksums and no
authentication tokens. Validate full import into staging before commit;
duplicates idempotent; future unsupported versions fail without modifying DB.
Validate IDs, ranges and relationships. Malformed/oversized import cannot
wipe good data. Native sharing/file handling tested separately from web.
Delete all local records/media/notifications, clear caches and pending jobs;
if sync enabled, write deletion tombstones/server deletion and reconcile
before declaring remote deletion complete. Deleted data must not resurrect
through old backup or sync without an explicit user restore choice.

## Later cloud
Supabase ownership RLS on every user table; service-role keys never in client.
Private media bucket and signed URLs. Prefer server reconciliation for UNIQUE
taskDay/slot reward keys. Two offline devices must converge on one task day
and one reward per logical slot; offline optimistic rewards may be corrected
after sync with a transparent explanation. Do not promise globally exactly-once
awards from local UUIDs alone. Reject/merge conflicting schedule revisions;
separate raw event IDs from the canonical logical reward identity.
Workout edits use explicit version conflict handling; no silent last-writer
wins for prescriptions. Confirm the conflict policy before implementing M4.
No health payloads in analytics, logs, exception reports or development repos.
""")

add("docs/ACCEPTANCE.md", r"""
# Acceptance and verification

The starter kit itself is not app-test evidence. Record actual results here
or in PROGRESS.md only after implementing and running the app.

## First vertical slice
Create profile -> generate today -> record check-in -> complete daily core ->
see XP/level -> reload/restart -> identical history and total. Airplane-mode
native flow is tested when an iPhone build exists. Web flow needs persistence
through reload, not just React state.

## Critical domain cases
1. Same task tapped twice, retried or imported twice grants one reward.
2. Same-day plan revision or workout->recovery swap grants no second reward.
3. Completed habit swapped for another habit cannot farm another reward.
4. Timezone change, date rollback, foreground resume and missed days cannot
   create simultaneous/reopened rewarded days. Test a DST transition as well.
5. Changing x1->x2 never changes prescription and does not rewrite today's XP.
6. Extra sets do not grant more XP; planned rest earns the same core reward.
7. Missed/illness days create no negative XP, punishment or exercise debt.
8. High rank never overrides pain/illness/poor-recovery protection.
9. Missing RIR, incomplete sets, noncomparable exercise or changed equipment
   prevents load increase. Include per-dumbbell vs combined-load cases.
10. Smallest equipment increment above 5% cap preserves current load.
11. Load zero, negative/NaN input, invalid ranges and max-level arithmetic safe.
12. LLM malformed/excessive/unsupported proposals cannot change prescription.
13. Accept/decline/restart preserves original and proposed plan audit history.
14. Export/import round trip preserves IDs/units; invalid/future export leaves
    current database untouched. Migration failure can recover.
15. Unknown HealthKit readings are unknown, never fabricated 0 steps.
16. Deletion tombstones prevent sync resurrection; backups are restored only
    through an explicit restore action. Two offline devices converge correctly.
17. Sessions older than the configured recency limit or a long training gap
    cannot trigger an increase from historical performance; rebaseline offered.
18. Weekly review retried on another day, imported twice or synced from two
    devices yields one canonical reward per persisted weekly cycle.
19. Systemic illness pauses structured training; localized joint pain pauses
    affected movements and never prompts a painful replacement.

## UX cases
- A new user can start without weight/photos/account/notification permissions.
- Today, rest day, workout in progress, empty history, errors and retry work.
- Workout can be interrupted and resumed; rest timer handles app backgrounding.
- Turkish long labels fit; screen reader and large text remain usable.
- Reduced Motion disables nonessential animation. Sound/haptics are optional.
- Local reminder denial is nonfatal; reminders don't duplicate on reschedule.
- TTS can stop immediately. Missing Turkish voice or silent-mode behavior is
  handled truthfully and tested on device, not assumed from web playback.

## Checks after each relevant slice
Run the app's implemented typecheck/lint/domain test commands and web export.
Select tests for real invariants; avoid snapshots that only mirror styling.
Use a browser flow for web. Use compatible RN component tooling for native UI.
Before beta, run actual iPhone checks for SQLite migrations, foreground resume,
notifications, TTS, file backup, low connectivity and permissions.
No claimed native pass based on web screenshot alone.

## Milestone completion
M0: persistent task->XP slice. M1: profile/schedule/workout logging.
M2: accepted training proposals + tested game progression.
M3: daily local core with charts, backup, speech/reminder capability boundaries.
M4: optional network features have ownership/deletion/conflict/privacy tests.
M5: actual signed-device result and remaining distribution steps documented.
""")

add("docs/TEAM.md", r"""
# Agent coordination

Main session owns integration, dependency changes, shared contracts and commits.
Ordinary Claude Code subagents run bounded tasks with their own context.
Do not enable experimental teams just to match a headcount. No nested delegation
is required. Keep at most three workers concurrent and one writer per path.

| Agent | Intended ownership |
|---|---|
| avci-architect | review contracts and milestone order; findings only |
| avci-mobile | apps/mobile/app, src/ui and feature screens |
| avci-training | src/domain/training and its tests |
| avci-data | src/data and import/export/sync tests |
| avci-game | src/domain/game and its tests |
| avci-privacy | read-only privacy and trust-boundary review |
| avci-qa | test execution and release readiness findings |

Assign explicit paths; actual structure can evolve through a documented decision.
Define shared types sequentially before parallel implementation. UI and data
workers agree on repositories before either edits overlapping interfaces.

Task handoff includes goal, current facts, allowed paths, relevant spec,
acceptance cases and expected result format. Result includes changed paths,
actual checks/results, decisions and unresolved blockers. Reviewers get raw
artifacts and acceptance criteria, not a suggested conclusion.

Suggested work order:
1. Architect examines repository and identifies M0 contracts.
2. Coordinator sets up Expo and shared types.
3. Data and game workers implement independent M0 domains, then mobile joins.
4. QA executes the real slice; coordinator fixes integration failures.
5. Training, mobile and data work on bounded subsequent slices.
6. Privacy and QA independently review before network/media/distribution work.

Subagents need available tools: if a tool is absent, report it and let the main
session do that part; do not substitute fabricated successful results.
""")

add("docs/SETUP.md", r"""
# Setup and delivery

## Local recommended route
Use Ubuntu/WSL2 already available on the user's Windows machine, or native
Windows Claude Code. Python 3.10+, Git and a Node LTS supported by the chosen
stable Expo SDK are needed. This starter does not silently install OS tools.
Official Claude setup: https://code.claude.com/docs/en/setup

After Claude Code is installed and authenticated:
`python3 AVCI_Claude_Baslat.py --setup --start`
Windows Python launcher: `py -3 AVCI_Claude_Baslat.py --setup --start`

`--setup` invokes the official project-scoped install:
`claude plugin install expo@claude-plugins-official --scope project`
This installs Expo skills plus Expo MCP. Do not add another Expo MCP. Optional
account authentication is through `/mcp`. The starter config does not enable
missing plugins by default; the official installer manages its own config.

The main session should verify current Expo docs and initialize `apps/mobile`
with the official stable template, preserving root docs. Do not hardcode an
outdated SDK or install a random dependency set. Resolve once and commit lockfile.
Use `npx expo install` for SDK-compatible native package versions, plus the
current Expo Doctor. Record versions and commands in PROGRESS.md.

## Cloud route
Commit generated project files, including `.claude/`, to a user-owned GitHub
repo and select it in Claude Code web. Project agents/skills carry over; local
plugins and user settings do not. Enabled plugin entries in a repo do not
install them in a cloud session. Self-contained project instructions and
official docs are sufficient for local-core implementation.
If a cloud Expo MCP is needed, follow the current official setup and configure
network/OAuth. Example ONLY, not an automatically activated duplicate:
`examples/expo-cloud.mcp.json`. Never put a token in this file.

## iOS route
Web preview first. Then EAS development build using the user's Expo account
and Apple signing; no local Mac needed for the EAS cloud build. Linux has no
local Xcode simulator; optional experimental EAS remote simulator requires
verified access/cost and does not replace real-device tests.
App Store Expo Go currently stops at SDK54; do not rely on it for newer SDKs.
Apple Developer is USD99/year, local price at enrollment. TestFlight build
expiry is 90 days. Development/ad hoc provisioning also needs maintenance.
Long-term store distribution needs Apple's current review/privacy requirements.

## Updates and background
EAS Update requires runtime compatibility. New native dependencies, SDK,
permissions/capabilities need a new binary. Configure dev/preview/production
channels only after project/account identity is known; do not invent IDs.
iOS background execution is scheduled by the OS, not a perpetual agent loop.
Use local reminders and deterministic task-day generation on foreground.
Never automatically publish/store-submit/purchase services as part of this kit.
""")

add("docs/PROGRESS.md", """
# Current progress

## Status
Preparation only. Product contracts, project agent definitions, workflow
definitions and the external bootstrap script are prepared. No application
source, dependency installation, Expo account, signed iPhone build or app-test
result exists yet. Do not mark starter validation as application validation.

## Next
1. Inspect environment and record actual tool versions.
2. Read all root contracts, then create the Expo app in apps/mobile.
3. Implement M0: persistent check-in -> daily task -> XP -> restart.

## Completed milestones
None of M0–M5 completed.

## Current checks
No app checks run yet.

## Update template
For each slice: date / milestone / implemented behavior / changed paths /
commands with actual results / unresolved blockers / next concrete task.
Never store user secrets, personal health records or photos in this file.
""")

add("docs/DECISIONS.md", """
# Decisions

- 2026-11-08: iPhone-first Expo/React Native/TypeScript; single app initially.
- 2026-11-08: native SQLite + separate persistent web repository adapter.
- 2026-11-08: game rank and physiological progression are separate domains.
- 2026-11-08: program adaptation is deterministic; LLM optional explanatory layer.
- 2026-11-08: local core precedes accounts, photo storage, HealthKit and API AI.
- 2026-11-08: original fantasy visuals; no franchise asset package.
- 2026-11-08: seven ordinary project subagents; no experimental teams by default.
- 2026-11-08: prepare and code first; accounts/payments/publication are later steps.

Record implementation choices here with reason and validation, including
task-day travel policy, persistence adapter, versions, and sync conflict policy.
""")

add("docs/SOURCES.md", r"""
# Primary sources

Checked 2026-11-08. Versions/prices/availability can change; recheck at execution.
These sources support platform/evidence claims, not our custom XP/rule numbers.

| Topic | Official source |
|---|---|
| Claude installation | https://code.claude.com/docs/en/setup |
| Project subagents | https://code.claude.com/docs/en/sub-agents |
| Project skills | https://code.claude.com/docs/en/skills |
| Settings/permissions | https://code.claude.com/docs/en/settings |
| Permissions | https://code.claude.com/docs/en/permissions |
| Cloud environment carry-over | https://code.claude.com/docs/en/cloud-environments |
| Agent teams limitations | https://code.claude.com/docs/en/agent-teams |
| Official Expo Claude integration | https://docs.expo.dev/agents/claude/ |
| Official Expo skills/plugin/MCP | https://docs.expo.dev/skills/ |
| Expo Go current iPhone limits | https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/ |
| Development builds | https://docs.expo.dev/develop/development-builds/introduction/ |
| EAS build | https://docs.expo.dev/build/setup/ |
| EAS Update compatibility | https://docs.expo.dev/eas-update/runtime-versions/ |
| iOS background scheduling | https://docs.expo.dev/versions/latest/sdk/background-task/ |
| Local notifications | https://docs.expo.dev/versions/latest/sdk/notifications/ |
| Speech | https://docs.expo.dev/versions/latest/sdk/speech/ |
| SQLite and optional SQLCipher | https://docs.expo.dev/versions/latest/sdk/sqlite/ |
| Apple membership | https://developer.apple.com/programs/enroll/ |
| TestFlight 90-day builds | https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/ |
| HealthKit authorization | https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data |
| HealthKit privacy | https://developer.apple.com/documentation/healthkit/protecting-user-privacy |
| Supabase Expo setup | https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native |
| Supabase RLS | https://supabase.com/docs/guides/database/postgres/row-level-security |
| Private storage | https://supabase.com/docs/guides/storage/security/access-control |
| ACSM 2026 guidance | https://acsm.org/resistance-training-guidelines-update-2026/ |
| 2026 position stand | https://pubmed.ncbi.nlm.nih.gov/41843416/ |
| Exercise warning signs | https://www.veteranshealthlibrary.va.gov/encyclopedia/3,82083 |
| ECC reviewed as optional alternative | https://github.com/affaan-m/ECC |

Conservative product hypotheses: two-session progression rule, 5% cap,
14-day recency/gap gate, readiness thresholds and 25% set reduction. These require user feedback and
validation; they are not a validated medical readiness algorithm.
""")

add("prompts/01_BASLAT.md", r"""
Bu projeyi şimdi geliştir. Yalnız plan veya görsel maket sunma.

1. CLAUDE.md, docs/PROJE_PLANI.md, PRODUCT.md, TRAINING_RULES.md,
   DATA_MODEL.md, ACCEPTANCE.md, TEAM.md ve PROGRESS.md dosyalarını oku.
2. Ortamı ve mevcut dosyaları incele. Güncel kararlı Expo SDK'sını ve Node
   uyumluluğunu resmî dokümandan doğrula. Varsa Expo eklentisinin overview ve
   ilgili yönergelerini kullan. MCP/eklenti yoksa resmî belgeler ve proje
   yönergeleriyle yerel çekirdeğe devam et; başarı uydurma.
3. Ana oturum koordinatör olsun. Depodaki yedi ajanı uzmanlıklarına göre
   çağır; bağımsız işlerde en fazla üç çalışan, her dosyada tek yazan olsun.
   Okuma/inceleme ajanları somut bulgular dönsün. Deneysel teams açma.
4. Önce apps/mobile içinde Expo/React Native/TypeScript uygulamasını kur.
   Root yönergelerini koru. Tek uygulamayla başla, gereksiz paket mimarisi kurma.
5. İlk somut teslim M0: Türkçe check-in, günlük antrenman/toparlanma görevi,
   tamamla, tekil XP kaydı, seviye ve kapatıp açınca korunan geçmiş. Web
   önizlemesi gerçek kalıcı veri kullansın. İşi yalnız ekran resminde bırakma.
6. M1–M3'e sırayla ilerle: doğrulanan profil ve günler, gerçek antrenman kaydı,
   gerekçeli/onaylı uyarlama, özgün avatar/rütbe, gelişim, dışa aktar/geri yükle,
   izinli bildirim ve isteğe bağlı sesli okuma. Ağ/hizmet gerektiren özellikler
   yerel temel akışı durdurmasın. Hesap olmadan çalışan çekirdek önceliklidir.
7. XP yalnız oyun sistemidir; x1/x2 spor yükünü değiştirmez. Planlı dinlenmeyi
   eşit ödüllendir. Ceza antrenmanı veya yarına egzersiz borcu üretme. Eski
   boy/kilo bilgilerini doğrulanmış güncel veri diye kullanma. Fotoğraf şart koşma.
8. Her aşamada uygun tür/lint, kural testleri ve web export kontrolünü çalıştır;
   sorunları düzelt. iPhone'a özgü davranışı cihazda sınamadan geçti deme.
   Veri/XP/tarih/ağ kesintisi/izin reddi gibi gerçek hatalara odaklan.
9. Çalışan adımları docs/PROGRESS.md'ye, teknik kararları DECISIONS.md'ye yaz.
   Uzun işte devam noktası bırak; plan tekrarına veya boş iskelete dönme.
10. Uygulamayı yayımlama, ücretli hesap satın alma veya mağazaya gönderme.
    Hazır ve incelenebilir sürümü, gerçek test sonuçlarını ve hesap/imzalama
    gerektiren kalan adımları sun. Rutin kod kararları için sürekli soru sorma.

İlk cevabında en fazla birkaç cümlelik çalışma özeti ver ve dosyalar üzerinde
çalışmaya başla. Önemli belirsizliği açıkça yaz; bağımsız işlere devam et.
""")

add("prompts/02_DEVAM.md", """
CLAUDE.md, docs/PROGRESS.md ve docs/DECISIONS.md dosyalarını oku. Mevcut kodu
incele; önce tamamlandığı söylenen son akışın gerçek durumunu doğrula. Projeyi
yeniden kurma veya planı baştan yazma. Bir sonraki tamamlanmamış M0–M3 işine
devam et; uygun uzman ajanı kullan, testleri çalıştır ve devam dosyasını güncelle.
M0–M3 bittiyse imzalı iPhone beta hazırlığının yerel yapılabilen kısımlarını
tamamla; hesap gereksinimini somut olarak belirt. Yayımlama veya satın alma yapma.
""")

add("prompts/03_INCELE.md", """
AVCI'nin mevcut uygulamasını docs/ACCEPTANCE.md'ye göre bağımsız incele.
avci-training, avci-privacy ve avci-qa ajanlarına ayrı, dar görevler ver.
Özellikle çift XP, tarih/saat dilimi, plan revizyonu, dinlenme, eksik veriyle
yük artışı, internetsiz kayıt ve yedek geri yükleme durumlarına bak. Bulguları
önem derecesi, dosya referansı ve yeniden üretimle sun. Yetkili kapsamda yerel
hataları düzeltip ilgili testleri çalıştır. Denenmemiş iPhone özelliğine geçti
deme; görsel izlenim ile çalışan davranışı ayrı doğrula.
""")

AGENTS = {
    "avci-architect": (
        "Review AVCI architecture, milestone dependencies and shared contracts before implementation.",
        "Read, Glob, Grep",
        "Read docs/PRODUCT.md, DATA_MODEL.md, TEAM.md and the checkpoint. Return a minimal "
        "vertical-slice design, shared type/repository contracts, path ownership and concrete "
        "acceptance criteria. Prefer one Expo app over premature abstractions. Do not edit files."
    ),
    "avci-mobile": (
        "Implement Turkish iPhone-first Expo screens and workout UX in explicitly assigned paths.",
        "Read, Glob, Grep, Edit, Write, Bash",
        "Use PRODUCT.md and the assigned repository interfaces. Build real persistent flows, "
        "accessible loading/empty/error states, clear workout logging and original restrained "
        "fantasy visuals. Respect Dynamic Type and Reduce Motion. Touch only assigned UI paths; "
        "leave shared contracts and dependencies to coordinator. Report actual checks."
    ),
    "avci-training": (
        "Implement and review deterministic training adaptation, recovery handling and its tests.",
        "Read, Glob, Grep, Edit, Write, Bash",
        "Read TRAINING_RULES.md and the relevant acceptance cases. Implement pure training "
        "functions and meaningful tests only in assigned paths. Keep XP/rank outside training "
        "logic. Unknown inputs are not zeros. Separate evidence from product thresholds. All "
        "changes are proposals requiring acceptance. Never diagnose or generate drug protocols."
    ),
    "avci-data": (
        "Implement offline persistence, migrations, backups and later sync without duplicate rewards or data loss.",
        "Read, Glob, Grep, Edit, Write, Bash",
        "Read DATA_MODEL.md. Implement repository interfaces, native/web persistence adapters "
        "and transactional app services in assigned paths. Prove duplicate completion/import "
        "idempotency and failure recovery. No actual personal health data in fixtures. Design "
        "cloud ownership/conflict handling only when that milestone is active. Report checks."
    ),
    "avci-game": (
        "Implement AVCI daily quest slots, XP ledger rules, rank and cosmetic unlocks with tests.",
        "Read, Glob, Grep, Edit, Write, Bash",
        "Read PRODUCT.md, DATA_MODEL.md and ACCEPTANCE.md. Implement pure game functions "
        "in assigned paths. Daily-core identity survives plan edits and recovery. Multipliers "
        "affect XP only and are snapshot per task day. Never reward extra volume, weight loss "
        "or photos. Handle integer thresholds, rounding and duplicate completion meaningfully."
    ),
    "avci-privacy": (
        "Independently review health/photo data, permissions, AI trust boundaries and user deletion.",
        "Read, Glob, Grep",
        "Review raw implementation against DATA_MODEL.md and product privacy requirements. "
        "Find concrete leaks, client secrets, ownership/RLS gaps, public media, resurrection "
        "after deletion, or unconsented AI sharing. Check permission-denied fallbacks. Do not "
        "edit files or invent successful access tests. Return severity, evidence and remedies."
    ),
    "avci-qa": (
        "Run and assess meaningful AVCI acceptance checks and iPhone release readiness.",
        "Read, Glob, Grep, Bash",
        "Read ACCEPTANCE.md and current checkpoint. Run the available relevant checks; "
        "report exact command/outcome and reproducible failures. Distinguish web evidence "
        "from real iPhone evidence. Review duplicate XP, timezone, recovery, import and "
        "permission behavior. Do not change code or deploy; coordinator implements fixes."
    ),
}

for name, (description, tool_list, body) in AGENTS.items():
    add(f".claude/agents/{name}.md", "\n".join([
        "---", f"name: {name}", "description: " + json.dumps(description),
        f"tools: {tool_list}", "model: inherit", "permissionMode: default", "---", "",
        "Read CLAUDE.md first. Work only within the coordinator's explicit task scope.",
        body, "", "Return changed/reviewed paths, actual checks, findings and remaining blockers.",
    ]))

SKILLS = {
    "start-avci": (
        "Start the AVCI fitness app from its project contracts and implement the first persistent vertical slice.",
        "Read prompts/01_BASLAT.md and execute it. Inspect the existing repository before "
        "scaffolding. If code exists, resume from PROGRESS.md instead of recreating it."
    ),
    "build-slice": (
        "Implement and verify a bounded AVCI feature slice with persistence and suitable failure states.",
        "Implement $ARGUMENTS. Read the matching docs first. Define shared interfaces before "
        "assigning non-overlapping work to project agents. Build the full user path, run relevant "
        "checks, fix failures and update docs/PROGRESS.md with actual evidence."
    ),
    "training-rules": (
        "Implement or review AVCI training progression, recovery rules and proposal validation.",
        "Read docs/TRAINING_RULES.md and docs/ACCEPTANCE.md. Use avci-training for the "
        "bounded task $ARGUMENTS. Keep pure deterministic rules and tests separate from XP. "
        "Unknown values block unsupported increases. Preview/acceptance precedes plan writes."
    ),
    "offline-sync": (
        "Work on AVCI persistence, transactional XP, migrations, backups or account synchronization.",
        "Read docs/DATA_MODEL.md. For $ARGUMENTS, use avci-data and test real retry/import/" 
        "conflict failure modes. Local-only core precedes cloud sync. Schema validation and "
        "safe recovery must precede destructive import or migration. Do not leak health data."
    ),
    "ui-polish": (
        "Improve AVCI mobile usability, Turkish layout, original RPG visuals and accessibility.",
        "Inspect the working flow before polishing $ARGUMENTS. Use avci-mobile within assigned "
        "paths. Verify Turkish labels, large text, VoiceOver semantics, touch targets, Reduce "
        "Motion, rest-day success and loading/empty/error states. Preserve real behavior."
    ),
    "content-catalog": (
        "Create or update AVCI versioned exercise instructions, task content and cosmetic rewards.",
        "Read docs/PRODUCT.md and TRAINING_RULES.md. For $ARGUMENTS, use original or "
        "appropriately licensed assets with recorded provenance. Verify exercise instructions "
        "against reliable primary material; do not fabricate URLs. Keep all safety tutorials "
        "accessible without XP. Validate catalog schemas/version and rollback behavior."
    ),
    "verify-release": (
        "Audit AVCI checks, data privacy and actual iPhone delivery readiness without publishing.",
        "Read docs/ACCEPTANCE.md and SETUP.md. Use avci-qa and avci-privacy independently. "
        "Run relevant checks, report severity and evidence, fix authorized local defects. "
        "Separate preparation from real signed-device validation. Do not publish or purchase."
    ),
    "resume-avci": (
        "Resume AVCI work from the last real checkpoint without restarting or repeating the plan.",
        "Read prompts/02_DEVAM.md, CLAUDE.md, PROGRESS.md and DECISIONS.md. Inspect actual "
        "code and resume the next incomplete milestone. Save a concrete checkpoint with "
        "actual command results and next work. Do not overwrite unrelated changes."
    ),
}

for name, (description, body) in SKILLS.items():
    add(f".claude/skills/{name}/SKILL.md", "\n".join([
        "---", f"name: {name}", "description: " + json.dumps(description), "---", "", body,
    ]))

add(".claude/settings.json", json.dumps({
    "$schema": "https://json.schemastore.org/claude-code-settings.json",
    "permissions": {"allow": [
        "Bash(npm run lint)", "Bash(npm run typecheck)", "Bash(npm run test *)"
    ]}
}, indent=2))

add("examples/expo-cloud.mcp.json", json.dumps({
    "mcpServers": {"expo": {"type": "http", "url": "https://mcp.expo.dev/mcp"}}
}, indent=2))

add("config/profile-draft.example.json", json.dumps({
    "schemaVersion": 1,
    "status": "unconfirmed-draft-not-current-measurements",
    "locale": "tr-TR", "timezone": "Europe/Istanbul", "xpMultiplier": 1,
    "current": {"heightCm": None, "weightKg": None, "trainingDays": None},
    "previousConversationSuggestions": {
        "heightCm": None, "weightKg": None, "experienceYears": None,
        "daysPerWeek": 5, "split": "PPLPP", "sundayRest": True,
        "priorities": ["upper_chest", "lateral_delts", "back_width"]
    },
    "confirmationRequired": True, "photoRequired": False,
    "cloudSyncEnabled": False, "aiEnabled": False, "healthKitEnabled": False
}, ensure_ascii=False, indent=2))

add(".gitignore", r"""
node_modules/
.expo/
dist/
web-build/
coverage/
.env
.env.*
!.env.example
*.keystore
*.p12
*.mobileprovision
credentials.json
*.sqlite
*.sqlite-*
*.db
private-data/
exports/
photos/
.claude/settings.local.json
.DS_Store
__pycache__/
""")

add("BASLANGIC.md", """
# AVCI çalışma paketi

Başlangıç planı: docs/PROJE_PLANI.md.
Claude Code ana komutu: prompts/01_BASLAT.md veya /start-avci.
Kaldığı yerden devam: /resume-avci.
Uygulama burada henüz oluşturulmadı; apps/mobile içine geliştirilecek.
7 proje ajanı ve 8 proje iş akışı .claude/ içinde hazırdır.
Resmî Expo eklentisini yerel terminalde kurmak için:
`claude plugin install expo@claude-plugins-official --scope project`
Bulutta proje dosyalarını kullan; eklentilerin otomatik taşındığını varsayma.
""")


def validate_payload() -> None:
    """Static integrity of this handoff; not app or exercise validation."""
    assert len(AGENTS) == 7 and len(SKILLS) == 8
    assert "CLAUDE.md" in FILES and "prompts/01_BASLAT.md" in FILES
    for name, content in FILES.items():
        path = PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts or "\\" in name:
            raise ValueError(f"Gecersiz kaynak yolu: {name}")
        if name.endswith(".json"):
            json.loads(content)
        if name.startswith(".claude/agents/") or name.endswith("SKILL.md"):
            if not content.startswith("---\n") or "\n---\n" not in content[4:]:
                raise ValueError(f"Gecersiz on bilgi: {name}")
    if "bypassPermissions" in FILES[".claude/settings.json"]:
        raise ValueError("Izin atlama yapilandirmasi kabul edilmez")


def safe_destination(root: Path, relative: str) -> Path:
    path = PurePosixPath(relative)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError("Guvenli olmayan hedef yolu")
    current = root
    for part in path.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError(f"Sembolik bag hedefi reddedildi: {current}")
    if not current.resolve().is_relative_to(root):
        raise ValueError("Hedef proje klasorunun disina cikiyor")
    return current


def create_project(target: Path) -> tuple[int, int, int]:
    if target.is_symlink():
        raise ValueError("Proje hedefi sembolik bag olamaz")
    root = target.absolute()
    # Reject symbolic links in every pre-existing parent too.
    for parent in [root, *root.parents]:
        if parent.is_symlink():
            raise ValueError(f"Sembolik bag klasoru reddedildi: {parent}")
    root = root.resolve()
    if root.exists() and not root.is_dir():
        raise ValueError("Proje hedefi klasor degil")

    manifest = {
        "kind": "avci-claude-handoff", "version": 1, "preparedAt": "2026-11-08",
        "agents": len(AGENTS), "workflows": len(SKILLS),
        "sha256": {name: hashlib.sha256(value.encode()).hexdigest()
                   for name, value in sorted(FILES.items())}
    }
    # A matching immutable baseline identifies a project generated by this
    # exact starter. Its files may legitimately have changed during development
    # or the official plugin installation. Keep those edits on resume.
    manifest_path = safe_destination(root, "handoff-manifest.json")
    owned = False
    if manifest_path.is_file():
        try:
            owned = json.loads(manifest_path.read_text(encoding="utf-8")) == manifest
        except (ValueError, OSError):
            pass
    payload = {**FILES, "handoff-manifest.json": json.dumps(manifest, indent=2) + "\n"}
    conflicts: list[str] = []
    pending: list[tuple[Path, bytes]] = []
    unchanged = 0
    preserved = 0
    for relative, content in payload.items():
        dest = safe_destination(root, relative)
        # Detect a file occupying a future directory before writing anything.
        for parent in dest.parents:
            if parent == root.parent:
                break
            if parent.exists() and not parent.is_dir():
                conflicts.append(str(parent))
        data = content.encode("utf-8")
        if dest.exists():
            if not dest.is_file():
                conflicts.append(str(dest))
            elif dest.read_bytes() != data:
                if owned:
                    preserved += 1
                else:
                    conflicts.append(str(dest))
            else:
                unchanged += 1
        else:
            pending.append((dest, data))
    if conflicts:
        raise ValueError("Mevcut dosyalar korunuyor; farkli bir --target secin:\n" +
                         "\n".join(sorted(set(conflicts))))
    root.mkdir(parents=True, exist_ok=True)
    for dest, data in pending:
        dest.parent.mkdir(parents=True, exist_ok=True)
        # Exclusive creation prevents overwriting a file created since preflight.
        with dest.open("xb") as stream:
            stream.write(data)
    return len(pending), unchanged, preserved


def doctor() -> dict[str, str | None]:
    result = {name: shutil.which(name) for name in ("claude", "node", "npm", "git")}
    print("Python:", sys.version.split()[0])
    for name, found in result.items():
        print(f"{name}: {found or 'BULUNAMADI'}")
    print("Node surumunun secilen Expo SDK ile uyumu Claude tarafindan dogrulanmali.")
    return result


def run_cli(args: list[str], cwd: Path) -> int:
    # Explicit argv, never shell interpolation. Windows Claude may be a .cmd shim.
    # Launch through a verified executable when possible; subprocess resolves
    # standard CLI wrappers on supported local installations.
    return subprocess.run(args, cwd=cwd, check=False).returncode


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", type=Path, default=Path("avci-fitness"))
    parser.add_argument("--doctor", action="store_true", help="Araclari kontrol et ve cik")
    parser.add_argument("--setup", action="store_true", help="Resmi Expo eklentisini kur")
    parser.add_argument("--start", action="store_true", help="Ana komutla Claude Code'u ac")
    parser.add_argument("--self-test", action="store_true", help="Baslaticiyi gecici klasorde test et")
    options = parser.parse_args()
    if sys.version_info < (3, 10):
        print("Python 3.10 veya ustu gerekli.", file=sys.stderr)
        return 2
    validate_payload()
    if options.self_test:
        return self_test()
    if options.doctor:
        doctor()
        return 0
    created, unchanged, preserved = create_project(options.target)
    root = options.target.resolve()
    print(f"Hazir: {root} ({created} yeni, {unchanged} ayni, {preserved} duzenlenmis dosya korundu)")
    print("7 ajan, 8 is akisi ve ayrintili plan hazir. Bu henuz spor uygulamasi degil.")
    if options.setup or options.start:
        tools = doctor()
        if not tools["claude"]:
            print("Claude Code kurulumu/giris gerekli: https://code.claude.com/docs/en/setup")
            print("Kurulumdan sonra ayni komutu tekrar calistirabilirsiniz.")
            return 3
        if options.start and any(not tools[n] for n in ("node", "npm", "git")):
            print("Eksik Node/npm/Git araclarini kurup ayni komutu tekrar calistirin.")
            return 3
        if options.setup:
            status = run_cli([tools["claude"], "plugin", "install",
                              "expo@claude-plugins-official", "--scope", "project"], root)
            if status:
                print("Expo eklentisi kurulumu tamamlanamadi. Proje dosyalari korunuyor.")
                print("Yerel cekirdek icin `claude` acip prompts/01_BASLAT.md'yi kullanabilirsiniz.")
                return status
            print("Resmi Expo eklentisi kuruldu. Gerekiyorsa Claude'da /mcp ile giris yapin.")
        if options.start:
            print("Claude Code ana gorevle aciliyor; uygulama gelistirme simdi baslayacak.")
            # A short literal also works when Windows resolves Claude to a
            # .cmd shim; never pass multiline task prose to a batch shell.
            return run_cli([tools["claude"], "/start-avci"], root)
    print("Sonraki adim: bu klasorde `claude` acin ve /start-avci yazin.")
    print("Ayrintili plan: docs/PROJE_PLANI.md")
    return 0


def self_test() -> int:
    checks = 0
    with tempfile.TemporaryDirectory(prefix="avci-bootstrap-test-") as temp:
        root = Path(temp) / "fresh"
        count, unchanged, preserved = create_project(root)
        assert count == len(FILES) + 1 and unchanged == 0 and preserved == 0
        checks += 1
        for relative, expected in FILES.items():
            assert (root / relative).read_text(encoding="utf-8") == expected
        checks += 1
        count, unchanged, preserved = create_project(root)
        assert count == 0 and unchanged == len(FILES) + 1 and preserved == 0
        checks += 1
        (root / "CLAUDE.md").write_text("user edits", encoding="utf-8")
        _, _, preserved = create_project(root)
        assert preserved == 1 and (root / "CLAUDE.md").read_text() == "user edits"
        checks += 1
        settings = root / ".claude/settings.json"
        plugin_settings = json.loads(settings.read_text())
        plugin_settings["enabledPlugins"] = {"expo@claude-plugins-official": True}
        settings.write_text(json.dumps(plugin_settings), encoding="utf-8")
        _, _, preserved = create_project(root)
        assert preserved == 2 and json.loads(settings.read_text()) == plugin_settings
        checks += 1
        foreign = Path(temp) / "foreign"
        foreign.mkdir()
        (foreign / "CLAUDE.md").write_text("unrelated")
        try:
            create_project(foreign)
            raise AssertionError("Overwrote foreign file")
        except ValueError:
            assert (foreign / "CLAUDE.md").read_text() == "unrelated"
            assert not (foreign / "docs").exists()
        checks += 1
        conflict = Path(temp) / "conflict"
        conflict.mkdir()
        (conflict / "docs").write_text("occupied")
        try:
            create_project(conflict)
            raise AssertionError("Missed directory conflict")
        except ValueError:
            assert not (conflict / "CLAUDE.md").exists()
        checks += 1
        try:
            safe_destination(root, "../escape")
            raise AssertionError("Accepted traversal")
        except ValueError:
            pass
        checks += 1
        if hasattr(os, "symlink"):
            try:
                link = Path(temp) / "link"
                link.symlink_to(root, target_is_directory=True)
                try:
                    create_project(link)
                    raise AssertionError("Accepted symlink target")
                except ValueError:
                    pass
                checks += 1
                linked_parent = Path(temp) / "linked-parent"
                linked_parent.mkdir()
                (linked_parent / "docs").symlink_to(root / "docs", target_is_directory=True)
                try:
                    create_project(linked_parent)
                    raise AssertionError("Accepted inner symlink")
                except ValueError:
                    assert not (linked_parent / "CLAUDE.md").exists()
                checks += 1
            except OSError:
                print("Symlink checks unavailable on this host; other checks completed.")
        manifest = json.loads((root / "handoff-manifest.json").read_text())
        assert len(manifest["sha256"]) == len(FILES)
        checks += 1
    print(f"PASS: {checks} baslatici kontrolu. Uygulama/native testleri degildir.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as exc:
        print(f"Baslatilamadi: {exc}", file=sys.stderr)
        raise SystemExit(2)
