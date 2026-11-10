import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { speakTurkish, stopSpeaking, turkishSpeechSupport, type SpeechSupport } from '@/platform/speech';
import { useAvci } from '@/ui/avci-context';
import { Button, T } from '@/ui/components';

/** Only one reading at a time across the app. */
let current: (() => void) | null = null;

/**
 * User-initiated read-aloud with an immediate stop. Hidden when the user has
 * turned speech off in Ayarlar. If no Turkish voice exists the app keeps
 * working as text and says so.
 */
export function SpeakButton({ text, label, testID }: { text: string; label: string; testID?: string }) {
  const { snapshot } = useAvci();
  const enabled = snapshot?.settings.speechEnabled ?? false;
  const [speaking, setSpeaking] = useState(false);
  const [support, setSupport] = useState<SpeechSupport | null>(null);
  const mounted = useRef(true);
  // One stable function per button, so the module-level `current` can be compared across renders.
  const stopSelf = useCallback(() => {
    if (mounted.current) setSpeaking(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (current === stopSelf) {
        current = null;
        void stopSpeaking();
      }
    };
  }, [stopSelf]);

  // Turning speech off in Ayarlar silences a running reading at once.
  useEffect(() => {
    if (!enabled && current === stopSelf) {
      current = null;
      void stopSpeaking();
    }
  }, [enabled, stopSelf]);

  if (!enabled) return null;

  const start = async () => {
    const s = await turkishSpeechSupport();
    setSupport(s);
    if (s !== 'turkish') return;
    if (current) {
      current();
      await stopSpeaking();
    }
    current = stopSelf;
    setSpeaking(true);
    speakTurkish(text, () => {
      if (current === stopSelf) current = null;
      stopSelf();
    });
  };
  const stop = async () => {
    if (current === stopSelf) current = null;
    setSpeaking(false);
    await stopSpeaking();
  };

  return (
    <View style={{ gap: 4 }}>
      {speaking ? (
        <Button label="Durdur" variant="secondary" onPress={() => void stop()} hint="Sesli okumayı hemen durdur" />
      ) : (
        <Button label={label} variant="secondary" onPress={() => void start()} hint="Metni Türkçe sesli okur" />
      )}
      {support && support !== 'turkish' && (
        <Text style={T.muted} testID={testID ? `${testID}-unavailable` : undefined} accessibilityLiveRegion="polite">
          {support === 'no-turkish-voice'
            ? 'Bu cihazda Türkçe ses bulunamadı; metin ekranda kalır. iPhone’da Ayarlar › Erişilebilirlik › Seslendirilen İçerik › Sesler bölümünden Türkçe ses indirebilirsin.'
            : 'Sesli okuma bu ortamda kullanılamıyor; metin ekranda kalır.'}
        </Text>
      )}
    </View>
  );
}
