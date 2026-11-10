/**
 * Read-aloud (M3). Output only: no microphone, no listening. Uses the system
 * text-to-speech through expo-speech (AVSpeechSynthesizer on iOS, the browser's
 * speechSynthesis on web). Turkish is spoken only with a Turkish voice; if none
 * exists the app says so and the text stays on screen.
 */
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

export type SpeechSupport = 'turkish' | 'no-turkish-voice' | 'unavailable';

let cached: Promise<SpeechSupport> | null = null;
let voiceId: string | undefined;

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

export function turkishSpeechSupport(): Promise<SpeechSupport> {
  cached ??= (async () => {
    if (Platform.OS === 'web' && (typeof window === 'undefined' || !('speechSynthesis' in window))) return 'unavailable';
    try {
      const voices = await withTimeout(Speech.getAvailableVoicesAsync(), 2000, []);
      const tr = voices.find((v) => v.language?.toLowerCase().replace('_', '-').startsWith('tr'));
      if (!tr) return 'no-turkish-voice';
      voiceId = tr.identifier;
      return 'turkish';
    } catch {
      return 'unavailable';
    }
  })();
  const p = cached;
  // A missing voice list can be a timing issue (web loads voices late): re-check next time.
  void p.then((s) => {
    if (s !== 'turkish') cached = null;
  });
  return p;
}

export function speakTurkish(text: string, onEnd: () => void): void {
  Speech.speak(text, {
    language: 'tr-TR',
    voice: voiceId,
    rate: 0.95,
    onDone: onEnd,
    onStopped: onEnd,
    onError: onEnd,
  });
}

export async function stopSpeaking(): Promise<void> {
  try {
    await Speech.stop();
  } catch {
    // Nothing is speaking or speech is unavailable.
  }
}
