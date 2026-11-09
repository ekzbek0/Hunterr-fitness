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
