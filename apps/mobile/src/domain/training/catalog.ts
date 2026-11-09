/**
 * Original exercise catalog (content version 1). Each entry is one
 * progression series: changing the exercise or its equipment is a different
 * series. How-to text is short original guidance; no video URLs are invented.
 */
import type { Equipment, Limitation } from './profile';

export const CATALOG_VERSION = 1;

export type Pattern =
  | 'horizontal-push'
  | 'vertical-push'
  | 'horizontal-pull'
  | 'vertical-pull'
  | 'squat'
  | 'hinge'
  | 'single-leg'
  | 'triceps'
  | 'biceps'
  | 'lateral-raise'
  | 'calves'
  | 'core';

/** total: whole implement; per-dumbbell: one hand's dumbbell; bodyweight: added load only. */
export type LoadConvention = 'total' | 'per-dumbbell' | 'bodyweight';

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  /** All items are required. */
  equipment: Equipment[];
  loadConvention: LoadConvention;
  /** Declared limitations that exclude this exercise. */
  restrictedBy: Limitation[];
  howTo: string;
}

export const EXERCISES: readonly Exercise[] = [
  { id: 'bb-bench-press', name: 'Halter bench press', pattern: 'horizontal-push', equipment: ['barbell', 'bench'], loadConvention: 'total', restrictedBy: ['wrist-loading'],
    howTo: 'Kürek kemiklerini sıkıştır, ayakları yere bas. Barı göğsün alt kısmına kontrollü indir, dirsekler gövdeyle yaklaşık 45°.' },
  { id: 'db-bench-press', name: 'Dambıl bench press', pattern: 'horizontal-push', equipment: ['dumbbell', 'bench'], loadConvention: 'per-dumbbell', restrictedBy: [],
    howTo: 'Dambılları göğüs hizasından yukarı it; omuzlar sehpada sabit, hareket ağrısız aralıkta kalsın.' },
  { id: 'machine-chest-press', name: 'Makinede göğüs press', pattern: 'horizontal-push', equipment: ['machine'], loadConvention: 'total', restrictedBy: [],
    howTo: 'Koltuk yüksekliğini tutamaçlar göğüs ortasına gelecek şekilde ayarla; itişte dirsekleri kilitlemeden uzat.' },
  { id: 'push-up', name: 'Şınav', pattern: 'horizontal-push', equipment: ['bodyweight'], loadConvention: 'bodyweight', restrictedBy: ['wrist-loading'],
    howTo: 'Gövde düz bir çizgi; göğsü yere yaklaştırıp it. Zor gelirse elleri yüksek bir yüzeye koy.' },
  { id: 'db-shoulder-press', name: 'Dambıl omuz press', pattern: 'vertical-push', equipment: ['dumbbell'], loadConvention: 'per-dumbbell', restrictedBy: ['overhead'],
    howTo: 'Karın sıkı, belini aşırı kavislendirme. Dambılları kulak hizasından baş üstüne it.' },
  { id: 'bb-overhead-press', name: 'Ayakta halter omuz press', pattern: 'vertical-push', equipment: ['barbell'], loadConvention: 'total', restrictedBy: ['overhead', 'spinal-loading'],
    howTo: 'Kalça ve karın sıkı; barı yüzüne yakın düz bir çizgide baş üstüne it.' },
  { id: 'bb-row', name: 'Halter row', pattern: 'horizontal-pull', equipment: ['barbell'], loadConvention: 'total', restrictedBy: ['spinal-loading'],
    howTo: 'Kalçadan öne eğil, sırt nötr. Barı karnına doğru çek, kürek kemiklerini birleştir.' },
  { id: 'db-one-arm-row', name: 'Tek kol dambıl row', pattern: 'horizontal-pull', equipment: ['dumbbell', 'bench'], loadConvention: 'per-dumbbell', restrictedBy: [],
    howTo: 'Bir el ve diz sehpada. Dambılı kalçana doğru çek; gövdeni döndürme.' },
  { id: 'cable-row', name: 'Kablolu oturarak row', pattern: 'horizontal-pull', equipment: ['cable'], loadConvention: 'total', restrictedBy: [],
    howTo: 'Göğüs dik, tutamağı karnına çek; geri bırakırken omuzları öne savurma.' },
  { id: 'band-row', name: 'Lastikle row', pattern: 'horizontal-pull', equipment: ['bands'], loadConvention: 'bodyweight', restrictedBy: [],
    howTo: 'Lastiği sabit bir noktaya bağla; dirsekleri geriye çekerek kürek kemiklerini birleştir.' },
  { id: 'pull-up', name: 'Barfiks', pattern: 'vertical-pull', equipment: ['pullup-bar'], loadConvention: 'bodyweight', restrictedBy: [],
    howTo: 'Omuzları aşağı çekerek başla; göğsü bara yaklaştır. Gerekirse lastik desteği kullan.' },
  { id: 'lat-pulldown', name: 'Lat pulldown', pattern: 'vertical-pull', equipment: ['cable'], loadConvention: 'total', restrictedBy: [],
    howTo: 'Barı köprücük kemiğine doğru çek; gövdeyi geriye savurma.' },
  { id: 'bb-back-squat', name: 'Halter squat', pattern: 'squat', equipment: ['barbell'], loadConvention: 'total', restrictedBy: ['spinal-loading', 'deep-knee-flexion'],
    howTo: 'Bar üst sırtta, ayaklar omuz genişliğinde. Kalçayı geri ve aşağı indir, dizler ayak uçlarıyla aynı yönde.' },
  { id: 'goblet-squat', name: 'Goblet squat', pattern: 'squat', equipment: ['dumbbell'], loadConvention: 'total', restrictedBy: ['deep-knee-flexion'],
    howTo: 'Tek dambılı göğüs önünde tut; gövde dik, ağrısız derinliğe kadar çömel.' },
  { id: 'leg-press', name: 'Leg press', pattern: 'squat', equipment: ['machine'], loadConvention: 'total', restrictedBy: [],
    howTo: 'Bel sırtlıkta kalsın; platformu topuklarla it, dizleri kilitleme. Derinliği ağrısız aralıkta tut.' },
  { id: 'box-squat-bw', name: 'Sandalyeye otur-kalk', pattern: 'squat', equipment: ['bodyweight'], loadConvention: 'bodyweight', restrictedBy: [],
    howTo: 'Bir sandalyeye kontrollü otur ve topuklarla iterek kalk. Yüksekliği konforlu seç.' },
  { id: 'bb-rdl', name: 'Halter Romanian deadlift', pattern: 'hinge', equipment: ['barbell'], loadConvention: 'total', restrictedBy: ['spinal-loading'],
    howTo: 'Dizler hafif bükük, kalçayı geriye it; bar bacaklara yakın, sırt nötr.' },
  { id: 'db-rdl', name: 'Dambıl Romanian deadlift', pattern: 'hinge', equipment: ['dumbbell'], loadConvention: 'per-dumbbell', restrictedBy: [],
    howTo: 'Dambıllar bacak önünde; kalçadan menteşe yap, arka bacakta gerilme hissedince geri dön.' },
  { id: 'glute-bridge', name: 'Kalça köprüsü', pattern: 'hinge', equipment: ['bodyweight'], loadConvention: 'bodyweight', restrictedBy: [],
    howTo: 'Sırtüstü, dizler bükülü. Topuklarla iterek kalçayı kaldır, üstte kalçayı sık.' },
  { id: 'db-split-squat', name: 'Dambıl split squat', pattern: 'single-leg', equipment: ['dumbbell'], loadConvention: 'per-dumbbell', restrictedBy: ['deep-knee-flexion'],
    howTo: 'Bir ayak önde bir ayak geride; arka dizi yere doğru indir, gövde dik.' },
  { id: 'step-up-bw', name: 'Basamağa çıkış', pattern: 'single-leg', equipment: ['bodyweight'], loadConvention: 'bodyweight', restrictedBy: [],
    howTo: 'Alçak bir basamağa öndeki ayakla it ve çık; kontrollü in.' },
  { id: 'cable-pushdown', name: 'Kablolu triceps pushdown', pattern: 'triceps', equipment: ['cable'], loadConvention: 'total', restrictedBy: [],
    howTo: 'Dirsekler gövdenin yanında sabit; tutamağı aşağı itip kontrollü bırak.' },
  { id: 'db-overhead-extension', name: 'Dambıl baş üstü triceps', pattern: 'triceps', equipment: ['dumbbell'], loadConvention: 'total', restrictedBy: ['overhead'],
    howTo: 'Tek dambılı iki elle baş üstünde tut; dirsekleri sabit tutarak başın arkasına indir.' },
  { id: 'bench-dip', name: 'Sehpada dips', pattern: 'triceps', equipment: ['bench'], loadConvention: 'bodyweight', restrictedBy: ['wrist-loading'],
    howTo: 'Eller sehpada, kalça sehpaya yakın; dirsekleri geriye bükerek in, omuz ağrısı olursa aralığı kısalt.' },
  { id: 'db-curl', name: 'Dambıl biceps curl', pattern: 'biceps', equipment: ['dumbbell'], loadConvention: 'per-dumbbell', restrictedBy: [],
    howTo: 'Dirsekler gövde yanında; dambılları savurmadan kaldır ve yavaş indir.' },
  { id: 'band-curl', name: 'Lastikle biceps curl', pattern: 'biceps', equipment: ['bands'], loadConvention: 'bodyweight', restrictedBy: [],
    howTo: 'Lastiğin ortasına bas; dirsekleri sabit tutarak çek.' },
  { id: 'db-lateral-raise', name: 'Dambıl yana açış', pattern: 'lateral-raise', equipment: ['dumbbell'], loadConvention: 'per-dumbbell', restrictedBy: [],
    howTo: 'Dirsekler hafif bükük; dambılları omuz hizasına kadar yana kaldır.' },
  { id: 'calf-raise', name: 'Ayakta baldır kaldırma', pattern: 'calves', equipment: ['bodyweight'], loadConvention: 'bodyweight', restrictedBy: [],
    howTo: 'Parmak uçlarında yüksel, üstte kısa dur ve yavaşça in.' },
  { id: 'dead-bug', name: 'Dead bug', pattern: 'core', equipment: ['bodyweight'], loadConvention: 'bodyweight', restrictedBy: [],
    howTo: 'Sırtüstü, bel yere yakın. Karşı kol ve bacağı yavaşça uzatıp geri getir.' },
];

export function exerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

export function isAvailable(ex: Exercise, equipment: readonly Equipment[], limitations: readonly Limitation[]): boolean {
  return ex.equipment.every((e) => equipment.includes(e)) && !ex.restrictedBy.some((l) => limitations.includes(l));
}

/** Alternatives keep the movement pattern and respect equipment and limitations. */
export function alternativesFor(
  exerciseId: string,
  equipment: readonly Equipment[],
  limitations: readonly Limitation[],
): Exercise[] {
  const ex = exerciseById(exerciseId);
  if (!ex) return [];
  return EXERCISES.filter((e) => e.pattern === ex.pattern && e.id !== ex.id && isAvailable(e, equipment, limitations));
}
