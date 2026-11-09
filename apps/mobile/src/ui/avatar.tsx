/**
 * Original AVCI hunter emblem drawn with plain Views (no images, no animation).
 * Purely cosmetic: derived from level via domain/game/cosmetics.
 */
import { StyleSheet, Text, View } from 'react-native';

import type { AvatarAppearance, Badge, PaletteKey } from '@/domain/game/cosmetics';
import { T } from '@/ui/components';
import { C, S } from '@/ui/theme';

const PALETTE: Record<PaletteKey, string> = {
  slate: C.border,
  steel: C.textMuted,
  azure: C.accent,
  violet: C.violet,
  starlight: C.text,
};

const SIZE = 148;
const CENTER = SIZE / 2;
const CORE = 56;
const CREST = 10;

export function AvatarEmblem({ avatar, rankTitle }: { avatar: AvatarAppearance; rankTitle: string }) {
  const ring = PALETTE[avatar.palette.ring];
  const accent = PALETTE[avatar.palette.accent];
  const core = PALETTE[avatar.palette.core];
  const outerRadius = CORE / 2 + 12 + (avatar.rings - 1) * 10;
  const crestRadius = outerRadius + 8;

  const label =
    `Avcı amblemi: seviye ${avatar.level}, rütbe ${avatar.rank} (${rankTitle}), ` +
    `${avatar.title}, ${avatar.rings} halka, ${avatar.crestPieces} arma parçası`;

  return (
    <View
      testID="avatar-emblem"
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={styles.frame}>
      {Array.from({ length: avatar.rings }, (_, i) => {
        const r = CORE / 2 + 12 + i * 10;
        return (
          <View
            key={`ring-${i}`}
            style={[
              styles.abs,
              {
                width: r * 2,
                height: r * 2,
                left: CENTER - r,
                top: CENTER - r,
                borderRadius: r,
                borderWidth: i === avatar.rings - 1 ? 2 : 1,
                borderColor: i % 2 === 0 ? ring : accent,
                opacity: 0.55 + 0.45 * ((i + 1) / avatar.rings),
              },
            ]}
          />
        );
      })}
      {Array.from({ length: avatar.crestPieces }, (_, i) => {
        // Evenly spaced crest shards offset by half a step, so the top slot stays free for the crown.
        const angle = (Math.PI * 2 * (i + 0.5)) / Math.max(avatar.crestPieces, 1) - Math.PI / 2;
        const x = CENTER + Math.cos(angle) * crestRadius - CREST / 2;
        const y = CENTER + Math.sin(angle) * crestRadius - CREST / 2;
        return (
          <View
            key={`crest-${i}`}
            style={[
              styles.abs,
              { left: x, top: y, width: CREST, height: CREST, backgroundColor: accent, transform: [{ rotate: '45deg' }] },
            ]}
          />
        );
      })}
      {avatar.crown && (
        <View
          style={[
            styles.abs,
            {
              left: CENTER - 9,
              top: CENTER - crestRadius - 9,
              width: 18,
              height: 18,
              borderWidth: 2,
              borderColor: PALETTE.starlight,
              backgroundColor: C.violet,
              transform: [{ rotate: '45deg' }],
            },
          ]}
        />
      )}
      <View
        style={[
          styles.abs,
          styles.core,
          { borderColor: ring, backgroundColor: C.surfaceRaised, shadowColor: core },
        ]}
      />
      <View style={[styles.abs, styles.coreInner, { borderColor: core }]} />
      <Text style={styles.rank} importantForAccessibility="no">
        {avatar.rank}
      </Text>
    </View>
  );
}

export function BadgeList({ badges }: { badges: Badge[] }) {
  return (
    <View style={{ gap: S.sm }} accessibilityRole="list">
      {badges.map((b) => {
        const state = b.unlocked ? 'Açıldı' : 'Kilitli';
        return (
          <View
            key={b.id}
            testID="badge-row"
            accessible
            accessibilityLabel={`${b.name} rozeti, seviye ${b.unlockLevel}: ${state}`}
            accessibilityState={{ disabled: !b.unlocked }}
            style={styles.badgeRow}>
            <View
              style={[
                styles.badgeMark,
                { backgroundColor: b.unlocked ? C.violet : 'transparent', borderColor: b.unlocked ? C.accent : C.border },
              ]}
            />
            <Text style={[T.body, { flex: 1 }]}>
              {b.name}
              <Text style={T.muted}> · Seviye {b.unlockLevel}</Text>
            </Text>
            <Text style={[T.muted, { color: b.unlocked ? C.success : C.textMuted, fontWeight: '600' }]}>{state}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
  core: {
    width: CORE,
    height: CORE,
    left: CENTER - CORE / 2,
    top: CENTER - CORE / 2,
    borderWidth: 3,
    borderRadius: 10,
    transform: [{ rotate: '45deg' }],
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  coreInner: {
    width: CORE - 18,
    height: CORE - 18,
    left: CENTER - (CORE - 18) / 2,
    top: CENTER - (CORE - 18) / 2,
    borderWidth: 1,
    borderRadius: 6,
    transform: [{ rotate: '45deg' }],
  },
  rank: { color: C.text, fontSize: 30, fontWeight: '800' },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingVertical: S.xs,
  },
  badgeMark: { width: 14, height: 14, borderWidth: 2, transform: [{ rotate: '45deg' }] },
});
