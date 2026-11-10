import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvciProvider } from '@/ui/avci-context';
import { C, MIN_TOUCH, S } from '@/ui/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AvciProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <Tabs>
            <TabSlot style={{ flex: 1 }} />
            <TabList asChild>
              <BottomBar>
                <TabTrigger name="bugun" href="/" asChild>
                  <TabButton>Bugün</TabButton>
                </TabTrigger>
                <TabTrigger name="antrenman" href="/antrenman" asChild>
                  <TabButton>Antrenman</TabButton>
                </TabTrigger>
                <TabTrigger name="gelisim" href="/gelisim" asChild>
                  <TabButton>Gelişim</TabButton>
                </TabTrigger>
                <TabTrigger name="karakter" href="/karakter" asChild>
                  <TabButton>Karakter</TabButton>
                </TabTrigger>
                <TabTrigger name="ayarlar" href="/ayarlar" asChild>
                  <TabButton>Ayarlar</TabButton>
                </TabTrigger>
              </BottomBar>
            </TabList>
          </Tabs>
        </View>
      </AvciProvider>
    </SafeAreaProvider>
  );
}

function BottomBar({ children, ...props }: { children?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View {...props} style={[styles.bar, { paddingBottom: Math.max(insets.bottom, S.sm) }]} accessibilityRole="tablist">
      {children}
    </View>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...(props as PressableProps)} accessibilityRole="tab" accessibilityState={{ selected: !!isFocused }} style={styles.tab}>
      <View style={[styles.pill, isFocused && styles.pillActive]}>
        <Text style={[styles.tabText, isFocused && styles.tabTextActive]}>{children}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: S.sm,
    paddingHorizontal: S.sm,
  },
  tab: { flex: 1, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingVertical: S.sm, paddingHorizontal: S.md, borderRadius: 20 },
  pillActive: { backgroundColor: C.surfaceRaised },
  tabText: { color: C.textMuted, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: C.text },
});
