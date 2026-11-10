/**
 * M3 speech: pure builders for the Turkish text that is read aloud on the
 * user's request. Symbols that a voice would mispronounce are spelled out.
 * The same text is always visible on screen; speech is only an extra.
 */
const REPLACEMENTS: [RegExp, string][] = [
  [/(\d)\s*×\s*(\d)/g, '$1 kere $2'],
  [/\s*×\s*/g, ', '],
  [/(\d)\s*[–-]\s*(\d)/g, '$1 ile $2'],
  [/\bRIR\b/g, 'yedekte kalan tekrar'],
  [/\bXP\b/g, 'deneyim puanı'],
  [/\s*·\s*/g, ', '],
  [/°/g, ' derece'],
  [/\s+/g, ' '],
];

export function speechText(parts: readonly (string | null | undefined | false)[]): string {
  let s = parts
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .map((p) => p.trim().replace(/[.:;!?]+$/, ''))
    .join('. ');
  for (const [re, to] of REPLACEMENTS) s = s.replace(re, to);
  return s.length > 0 ? `${s.trim()}.` : '';
}

export interface QuestLine {
  title: string;
  done: boolean;
}

/** Today's quests: what is still open first, then what is done. No pressure wording. */
export function questsSpeech(quests: readonly QuestLine[], plannedWorkout: string | null): string {
  const open = quests.filter((q) => !q.done).map((q) => q.title);
  const done = quests.filter((q) => q.done).map((q) => q.title);
  return speechText([
    'Bugünün görevleri',
    plannedWorkout ? `Planlı antrenman: ${plannedWorkout}` : null,
    open.length ? `Açık görevler: ${open.join(', ')}` : 'Bugünün bütün görevleri tamam',
    done.length ? `Tamamlananlar: ${done.join(', ')}` : null,
  ]);
}

/** One exercise of the workout: name, plan and how-to. */
export function exerciseSpeech(name: string, plan: string, howTo: string): string {
  return speechText([name, `Plan: ${plan}`, howTo]);
}
