import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAvci } from './avci-context';
import { C, MAX_WIDTH, MIN_TOUCH, S } from './theme';

export function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.inner}>
          <Text style={styles.h1} accessibilityRole="header">
            {title}
          </Text>
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Shared loading / error states for every screen that depends on storage. */
export function StorageGate({ children }: { children: ReactNode }) {
  const { status, error, retry } = useAvci();
  if (status === 'loading') {
    return (
      <View style={styles.center} accessibilityLabel="Kayıtlar yükleniyor">
        <ActivityIndicator color={C.accent} size="large" />
        <Text style={styles.muted}>Kayıtlar yükleniyor…</Text>
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.h2}>Kayıtlar açılamadı</Text>
        <Text style={styles.muted}>{error}</Text>
        <Button label="Tekrar dene" onPress={retry} />
      </View>
    );
  }
  return <>{children}</>;
}

export function Card({ children, style, accent }: { children: ReactNode; style?: ViewStyle; accent?: string }) {
  return <View style={[styles.card, accent ? { borderLeftColor: accent, borderLeftWidth: 4 } : null, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  hint,
  a11yLabel,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'recovery';
  disabled?: boolean;
  hint?: string;
  /** Screen-reader name when the visible label (e.g. an arrow) needs context. */
  a11yLabel?: string;
  testID?: string;
}) {
  const bg = variant === 'primary' ? C.accentStrong : variant === 'recovery' ? C.recovery : C.surfaceRaised;
  const fg = variant === 'recovery' ? C.bg : C.onAccent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      testID={testID}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        variant === 'secondary' && styles.buttonSecondary,
      ]}>
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && { color: C.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  numeric,
  width,
  testID,
  a11yLabel,
}: {
  label: string;
  /** Screen-reader label when the visible label needs more context. */
  a11yLabel?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  numeric?: boolean;
  width?: number;
  testID?: string;
}) {
  return (
    <View style={{ gap: 4, width }}>
      <Text style={T.label}>{label}</Text>
      <TextInput
        accessibilityLabel={a11yLabel ?? label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        inputMode={numeric ? 'decimal' : 'text'}
        style={styles.input}
        testID={testID}
      />
    </View>
  );
}

/** Multi-select chip (checkbox semantics) for equipment, days and limitations. */
export function ToggleChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && { color: C.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

export function XpBar({ fraction }: { fraction: number }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <View style={styles.barTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}>
      <View style={[styles.barFill, { width: `${pct}%` }]} />
    </View>
  );
}

export const T = StyleSheet.create({
  h2: { color: C.text, fontSize: 20, fontWeight: '700' },
  h3: { color: C.text, fontSize: 17, fontWeight: '600' },
  body: { color: C.text, fontSize: 16, lineHeight: 22 },
  muted: { color: C.textMuted, fontSize: 14, lineHeight: 20 },
  label: { color: C.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, alignItems: 'center' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 120 },
  inner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', padding: S.lg, gap: S.lg },
  h1: { color: C.text, fontSize: 30, fontWeight: '800', letterSpacing: 0.3 },
  h2: T.h2,
  muted: T.muted,
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: S.md, padding: S.xl },
  card: { backgroundColor: C.surface, borderRadius: 16, padding: S.lg, gap: S.md, borderWidth: 1, borderColor: C.border },
  button: { minHeight: MIN_TOUCH, borderRadius: 12, paddingHorizontal: S.lg, alignItems: 'center', justifyContent: 'center' },
  buttonSecondary: { borderWidth: 1, borderColor: C.border },
  buttonText: { fontSize: 16, fontWeight: '700' },
  chip: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: S.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceRaised,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: C.accentStrong, borderColor: C.accent },
  chipText: { color: C.text, fontSize: 15 },
  input: {
    minHeight: MIN_TOUCH,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceRaised,
    color: C.text,
    fontSize: 16,
    paddingHorizontal: S.md,
  },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: C.surfaceRaised, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.violet, borderRadius: 5 },
});
