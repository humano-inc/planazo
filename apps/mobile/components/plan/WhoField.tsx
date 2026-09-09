import { View, StyleSheet, Pressable } from 'react-native';
import type { PlanAudience } from '@planazo/shared';
import { audienceChipLabel } from '../../lib/planAudience';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { ThemedText, PeopleGlyph, colorForName } from '../ui';
import { colors, radii, spacing } from '../../theme/tokens';

type GroupChoice = { id: string; name: string; color: string | null };

type Props = {
  /** The friend audiences on offer (PLA-140), ahead of the groups. */
  audiences: readonly PlanAudience[];
  groups: GroupChoice[];
  audience: PlanAudience;
  groupId: string | null;
  /** A group id, or one of the friend audiences: one row of chips, one pick. */
  onPick: (pick: string) => void;
  /** The join rule for a friend audience; a group needs none. */
  helper: string | null;
};

/**
 * "Who's it for": one row of chips mixing the two friend audiences and the
 * user's groups. Picking the destination is the first thing the create sheet
 * asks, so the chips are full touch targets rather than compact tags.
 */
export function WhoField({ audiences, groups, audience, groupId, onPick, helper }: Props) {
  return (
    <View style={styles.section}>
      <ThemedText variant="sectionLabel">Who's it for</ThemedText>
      <View style={styles.chipWrap}>
        {audiences.map((a) => {
          const active = a === audience;
          return (
            <Pressable
              key={a}
              onPress={() => onPick(a)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              testID={`audience-${a}`}
              style={[styles.chip, active && styles.chipActive]}
            >
              <View style={[styles.dot, styles.peopleDot]}>
                <PeopleGlyph size={9} />
              </View>
              <ThemedText
                variant="bodyStrong"
                style={styles.chipLabel}
                color={active ? colors.background : colors.textSecondary}
              >
                {audienceChipLabel(a)}
              </ThemedText>
            </Pressable>
          );
        })}
        {groups.map((g) => {
          const active = g.id === groupId;
          return (
            <Pressable
              key={g.id}
              onPress={() => onPick(g.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              testID={`group-${g.id}`}
              style={[styles.chip, active && styles.chipActive]}
            >
              <View style={[styles.dot, { backgroundColor: g.color ?? colorForName(g.name) }]} />
              <ThemedText
                variant="bodyStrong"
                style={styles.chipLabel}
                color={active ? colors.background : colors.textSecondary}
              >
                {g.name}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      {helper ? (
        <ThemedText variant="caption" color={colors.textSecondary} testID="audience-helper">
          {helper}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chipLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  // 39 (9 + 18 + 9 + border) — picking the destination is the first thing
  // the sheet asks for. No row padding to reclaim, so the pill grows (PLA-40).
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 5,
  },
  // The people mark sits where a group's colour dot would: same footprint,
  // ember tile, so the row reads as one kind of thing.
  peopleDot: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
});
