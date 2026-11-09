import type { Equipment, Experience, Goal, Limitation } from '@/domain/training/profile';
import type { ProgramChange, ProgramErrorCode } from '@/domain/training/program';
import { exerciseById, type IncrementKey, type LoadConvention } from '@/domain/training/catalog';
import type { HoldReason, RebaselineReason } from '@/domain/training/progression';
import type { TrainingRejectReason } from '@/services/avci-service';
import type { Rank } from '@/domain/game/economy';
import type { CoreResolution } from '@/domain/game/quests';
import type { ReasonCode } from '@/domain/training/readiness';
import type { ScheduleConflict } from '@/domain/training/schedule';

/** Original cosmetic titles; prestige only, never gates features. */
export const RANK_TITLES: Record<Rank, string> = {
  E: 'Çırak Avcı',
  D: 'İz Sürücü',
  C: 'Kararlı Avcı',
  B: 'Gece Nöbetçisi',
  A: 'Fırtına Avcısı',
  S: 'Efsanevi Avcı',
};

export const RESOLUTION_LABELS: Record<CoreResolution, string> = {
  training: 'Antrenman tamamlandı',
  recovery: 'Planlı toparlanma tamamlandı',
  'illness-recovery': 'Hastalık/ağrı nedeniyle toparlanma',
};

export const REASON_LABELS: Record<ReasonCode, string> = {
  illness: 'Hastalık belirttin: yapılandırılmış antrenman bugün duraklatıldı.',
  'joint-pain': 'Yeni/artan eklem ağrısı: ağrıyan hareketleri bugün yapma.',
  'safety-unknown': 'Ağrı/hastalık sorusu “bilmiyorum”: yük artışı önerilmez.',
  'short-sleep': '6 saatten az uyku: dinlenme veya hafifletilmiş antrenman seçilebilir.',
  'high-fatigue': 'Yorgunluk yüksek: dinlenme veya hafifletilmiş antrenman seçilebilir.',
  'marked-soreness': 'Belirgin kas hassasiyeti: dinlenme seçilebilir.',
};

export function formatDate(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export const SLOT_LABELS: Record<string, string> = {
  checkin: 'Günlük kontrol',
  core: 'Ana görev',
  'habit-1': 'Alışkanlık 1',
  'habit-2': 'Alışkanlık 2',
  'weekly-review': 'Haftalık değerlendirme',
};

// ---- M1 training labels ----
export const GOAL_LABELS: Record<Goal, string> = {
  muscle: 'Kas geliştirme',
  strength: 'Kuvvet',
  'general-fitness': 'Genel form',
  'fat-loss-support': 'Yağ kaybını destekleme',
};
export const EXPERIENCE_LABELS: Record<Experience, string> = {
  beginner: 'Yeni başlıyorum',
  intermediate: 'Orta (6+ ay düzenli)',
  advanced: 'İleri (2+ yıl düzenli)',
};
export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Halter',
  dumbbell: 'Dambıl',
  bench: 'Sehpa',
  machine: 'Makineler',
  cable: 'Kablo istasyonu',
  'pullup-bar': 'Barfiks barı',
  bands: 'Direnç lastiği',
  bodyweight: 'Vücut ağırlığı',
};
export const LIMITATION_LABELS: Record<Limitation, string> = {
  overhead: 'Baş üstü itme yok',
  'spinal-loading': 'Omurgaya eksenel yük yok',
  'deep-knee-flexion': 'Derin diz bükme yok',
  'wrist-loading': 'Bilek yüklenmesi yok',
};
export const WEEKDAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;
export const WEEKDAY_LONG = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'] as const;

export const LOAD_CONVENTION_LABELS: Record<LoadConvention, string> = {
  total: 'toplam yük',
  'per-dumbbell': 'dambıl başına',
  bodyweight: 'ek yük (vücut ağırlığına ek)',
  band: 'lastik direnci (kg/lb değil)',
};

export const PROGRAM_ERROR_LABELS: Record<ProgramErrorCode, string> = {
  'day-count': 'Program 1–6 antrenman günü içermeli.',
  'duplicate-weekday': 'İki antrenman aynı haftanın gününe denk geliyor.',
  'duplicate-day-id': 'Program günleri benzersiz olmalı.',
  title: 'Gün adı boş olamaz (en fazla 40 karakter).',
  'exercise-count': 'Her gün 1–10 hareket içermeli.',
  'unknown-exercise': 'Bilinmeyen hareket var.',
  'unavailable-exercise': 'Bir hareket ekipmanına veya bildirdiğin kısıtlara uymuyor.',
  'duplicate-exercise': 'Aynı hareket bir günde iki kez olamaz.',
  sets: 'Set sayısı 1–8 olmalı.',
  reps: 'Tekrar aralığı 1–30 olmalı ve alt sınır üst sınırı geçmemeli.',
  rir: 'Hedef RIR 0–5 olmalı.',
  'target-load': 'Hedef yük geçersiz (lastik hareketlerinde yük hedefi olmaz).',
};

export const TRAINING_REJECT_LABELS: Record<TrainingRejectReason, string> = {
  'no-profile': 'Önce Bugün sekmesinden profil oluştur.',
  'day-changed': 'Antrenman önceki görev gününde başlamıştı; kaydı saklandı ama bugünün ödülü bu kayıtla verilmez.',
  'clock-frozen': 'Cihaz saati geri alınmış görünüyor; kayıt saklandı, saat düzelene kadar ödül verilmez.',
  'unknown-slot': 'Görev bulunamadı.',
  invalid: 'Girilen değerler geçersiz.',
  illness: 'Bugün hastalık bildirdin: yapılandırılmış antrenman duraklatıldı. Toparlanma aynı ödülü kazandırır.',
  'no-training-profile': 'Önce antrenman bilgilerini onayla.',
  'no-plan': 'Önce bir programı kabul et.',
  'plan-changed': 'Program bu arada değişti; güncel hali yüklendi, değişikliği tekrar dene.',
  'plan-invalid': 'Program güncel ekipman/kısıt bilgilerine uymuyor. Önce yeni programı onayla.',
  'not-today': 'Bu antrenman bugüne planlı değil. Önce bugüne taşı.',
  'already-done': 'Bu antrenman bu hafta zaten tamamlandı.',
  'unknown-session': 'Antrenman bulunamadı.',
  'not-in-progress': 'Bu antrenman artık devam etmiyor.',
  'exercise-not-in-session': 'Bu hareket bu antrenmanda yok.',
  'no-work-sets': 'Bitirmek için en az bir çalışma seti kaydet (ısınma setleri sayılmaz).',
  'not-movable': 'Tamamlanan veya devam eden antrenman taşınamaz.',
  'outside-week': 'Yalnızca bu haftanın günlerine taşınabilir.',
  'in-past': 'Geçmiş bir güne taşınamaz.',
  occupied: 'O günde başka bir antrenman var.',
  'week-changed': 'Hafta değişti; bu haftanın değerlendirmesi yüklendi.',
  'schedule-conflict': 'Bu değişiklik bu haftada aynı güne iki antrenman koyuyor. Hiçbir şey kaydedilmedi.',
  'unknown-proposal': 'Öneri bulunamadı.',
  'proposal-decided': 'Bu öneri için zaten karar verildi.',
  'proposal-stale':
    'Öneri yeniden doğrulandı ve artık geçerli değil (program veya kayıtlar değişti). Plan değişmedi; değerlendirmeyi yenile.',
  'technique-unconfirmed': 'Kabul etmeden önce tekniğin ve hareket açıklığının önceki seanslarla aynı olduğunu onayla.',
};

export function exerciseName(id: string): string {
  return exerciseById(id)?.name ?? id;
}

const rirText = (r: number | null) => (r === null ? 'RIR yok' : `RIR ${r}`);

export function describeChange(c: ProgramChange): string {
  switch (c.kind) {
    case 'day-added':
      return `Yeni gün: ${c.title}`;
    case 'day-removed':
      return `Gün kaldırıldı: ${c.title}`;
    case 'weekday':
      return `${c.title}: ${WEEKDAY_LONG[c.from]} → ${WEEKDAY_LONG[c.to]}`;
    case 'title':
      return `Gün adı: ${c.from} → ${c.to}`;
    case 'exercise-added':
      return `${c.title}: ${exerciseName(c.exerciseId)} eklendi`;
    case 'exercise-removed':
      return `${c.title}: ${exerciseName(c.exerciseId)} çıkarıldı`;
    case 'exercise-order':
      return `${c.title}: hareket sırası ${c.from.map(exerciseName).join(' → ')}  ⇒  ${c.to.map(exerciseName).join(' → ')}`;
    case 'prescription':
      return `${c.title} · ${exerciseName(c.exerciseId)}: ${c.from.sets}×${c.from.repMin}–${c.from.repMax} (${rirText(c.from.targetRir)}${targetText(c.from.targetLoad)}) → ${c.to.sets}×${c.to.repMin}–${c.to.repMax} (${rirText(c.to.targetRir)}${targetText(c.to.targetLoad)})`;
    default:
      return '';
  }
}

export function describeConflict(c: ScheduleConflict): string {
  const names = c.sessions.map((x) => (x.moved ? `${x.title} (${formatDate(x.plannedDate)} gününden taşınmış)` : x.title));
  return `${formatDate(c.date)}: ${names.join(' ve ')} aynı güne düşüyor.`;
}

export const fmtLoad = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });

function targetText(t: { value: number; unit: string } | null | undefined): string {
  return t ? `, hedef ${fmtLoad(t.value)} ${t.unit}` : '';
}

export function prescriptionText(p: { sets: number; repMin: number; repMax: number; targetRir: number | null }): string {
  const reps = p.repMin === p.repMax ? `${p.repMin}` : `${p.repMin}–${p.repMax}`;
  return `${p.sets} set × ${reps} tekrar${p.targetRir === null ? '' : ` · hedef RIR ${p.targetRir}`}`;
}

// ---- M2 progression labels ----
export const HOLD_REASON_LABELS: Record<HoldReason, string> = {
  'unknown-exercise': 'Hareket katalogda yok.',
  'band-resistance': 'Lastik direnci kilogram değildir; yük artışı hesaplanmaz.',
  'checkin-missing': 'Bugünkü kontrol yapılmadı: eksik bilgiyle yük artışı önerilmez.',
  'pain-or-illness-today': 'Bugün ağrı veya hastalık bildirdin: yük artışı yok.',
  'safety-unknown-today': 'Ağrı/hastalık sorusu “bilmiyorum”: yük artışı önerilmez.',
  'recovery-freeze': 'Uyku, yorgunluk veya kas hassasiyeti nedeniyle yük artışı donduruldu.',
  'insufficient-sessions': 'Karşılaştırılabilir iki tamamlanmış seans yok.',
  'prescription-changed': 'Set/tekrar reçetesi son seanslardan sonra değişti; seanslar karşılaştırılamaz.',
  'incomplete-sets': 'Planlanan çalışma setlerinin hepsi yapılmadı.',
  'reps-below-top': 'Her çalışma setinde tekrar aralığının üst sınırına ulaşılmadı.',
  'missing-rir': 'Bazı çalışma setlerinde RIR girilmedi: kanıt yetersiz.',
  'low-rir': 'Bazı çalışma setlerinde RIR 2’nin altında.',
  'unit-changed': 'Seanslar arasında birim (kg/lb) değişti; dönüştürme yapılmaz.',
  'convention-changed': 'Yük kaydı türü (toplam/dambıl başına) farklı; karşılaştırılamaz.',
  'load-varies': 'Setlerde veya seanslar arasında yük farklı.',
  'session-checkin-missing': 'Seanslardan birinin gününde kontrol kaydı yok.',
  'session-pain-or-illness': 'Seanslardan birinin gününde ağrı veya hastalık bildirildi.',
  'session-safety-unknown': 'Seanslardan birinin gününde ağrı/hastalık “bilmiyorum”.',
  'bodyweight-zero-load': 'Ek yüksüz vücut ağırlığı hareketi: yük artışı hesaplanmaz.',
  'increment-unconfirmed': 'Bu ekipman ve birim için en küçük artışı henüz doğrulamadın.',
  'increment-over-cap': 'En küçük artış mevcut yükün %5’inden büyük; yük korunur, yuvarlanmaz.',
  'already-at-target': 'Plandaki hedef yük zaten bu düzeyde.',
};

export const REBASELINE_LABELS: Record<RebaselineReason, string> = {
  'stale-data': 'Son seans 14 günden eski.',
  'training-gap': 'İki seans arasında 14 günden uzun ara var.',
};

export const INCREMENT_KEY_LABELS: Record<IncrementKey, string> = {
  barbell: 'Halter (toplam)',
  dumbbell: 'Dambıl (bir dambıl adımı)',
  machine: 'Makine',
  cable: 'Kablo',
  'added-weight': 'Ek ağırlık (vücut ağırlığına)',
};

export function loadText(load: number, unit: string, convention: LoadConvention): string {
  if (convention === 'per-dumbbell') return `dambıl başına ${fmtLoad(load)} ${unit} (toplam ${fmtLoad(load * 2)} ${unit})`;
  if (convention === 'bodyweight') return `ek ${fmtLoad(load)} ${unit}`;
  return `${fmtLoad(load)} ${unit} (toplam)`;
}
