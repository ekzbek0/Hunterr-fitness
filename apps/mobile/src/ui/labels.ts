import type { Equipment, Experience, Goal, Limitation } from '@/domain/training/profile';
import type { ProgramChange, ProgramErrorCode } from '@/domain/training/program';
import { exerciseById, type LoadConvention } from '@/domain/training/catalog';
import type { TrainingRejectReason } from '@/services/avci-service';
import type { Rank } from '@/domain/game/economy';
import type { CoreResolution } from '@/domain/game/quests';
import type { ReasonCode } from '@/domain/training/readiness';

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
    case 'prescription':
      return `${c.title} · ${exerciseName(c.exerciseId)}: ${c.from.sets}×${c.from.repMin}–${c.from.repMax} (${rirText(c.from.targetRir)}) → ${c.to.sets}×${c.to.repMin}–${c.to.repMax} (${rirText(c.to.targetRir)})`;
  }
}

export function prescriptionText(p: { sets: number; repMin: number; repMax: number; targetRir: number | null }): string {
  const reps = p.repMin === p.repMax ? `${p.repMin}` : `${p.repMin}–${p.repMax}`;
  return `${p.sets} set × ${reps} tekrar${p.targetRir === null ? '' : ` · hedef RIR ${p.targetRir}`}`;
}
