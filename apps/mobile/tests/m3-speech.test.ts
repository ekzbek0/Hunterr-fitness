/** M3 read-aloud text builders (pure). The speech engine itself is a device feature and is not exercised here. */
import { describe, expect, it } from 'vitest';

import { exerciseSpeech, questsSpeech, speechText } from '@/domain/speech/text';

describe('speech text', () => {
  it('spells out symbols a Turkish voice would misread', () => {
    expect(speechText(['3 set × 8–12 tekrar · RIR 2', 'Dirsekler 45°'])).toBe(
      '3 set, 8 ile 12 tekrar, yedekte kalan tekrar 2. Dirsekler 45 derece.',
    );
    expect(speechText(['12 × 60 kg'])).toBe('12 kere 60 kg.');
    expect(speechText([null, '', false, '  '])).toBe('');
  });
  it('reads open quests first and never adds pressure wording', () => {
    const s = questsSpeech(
      [
        { title: 'Günlük kontrol', done: true },
        { title: 'Ana görev', done: false },
        { title: '10 dakika yürüyüş', done: false },
      ],
      'İtiş A',
    );
    expect(s).toBe(
      'Bugünün görevleri. Planlı antrenman: İtiş A. Açık görevler: Ana görev, 10 dakika yürüyüş. Tamamlananlar: Günlük kontrol.',
    );
    expect(s).not.toMatch(/borç|ceza|kaçırdın/i);
    expect(questsSpeech([{ title: 'Ana görev', done: true }], null)).toBe(
      'Bugünün görevleri. Bugünün bütün görevleri tamam. Tamamlananlar: Ana görev.',
    );
  });
  it('builds an exercise description from name, plan and how-to', () => {
    expect(exerciseSpeech('Halter bench press', '3 set × 8–12 tekrar', 'Barı kontrollü indir.')).toBe(
      'Halter bench press. Plan: 3 set, 8 ile 12 tekrar. Barı kontrollü indir.',
    );
  });
});
