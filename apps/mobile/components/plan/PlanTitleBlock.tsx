import { StyleSheet, View } from 'react-native';
import type { PlanDerived } from '../../lib/planDerived';
import { Badge, ThemedText, colorForName } from '../ui';
import { colors, spacing } from '../../theme/tokens';

/**
 * What the plan is: its state, whose group it belongs to, its title and blurb.
 *
 * The badge is computed here rather than passed in, because the four states it
 * can show are exactly the four the rest of this block dims for. An ended plan
 * (called off, or the night has been and gone) reads greyer than a live one,
 * and that pairing is the only reason the two live together.
 */
export function PlanTitleBlock({
  title,
  description,
  groupName,
  groupColor,
  d,
}: {
  title: string;
  description: string | null;
  groupName: string;
  groupColor: string | null;
  d: PlanDerived;
}) {
  const badge = d.isCancelled
    ? { label: 'Called off', ended: true }
    : d.isExpired
      ? { label: "Didn't happen", ended: true }
      : d.confirmed
        ? { label: 'Confirmed', tone: 'confirmed' as const }
        : { label: 'Open', tone: 'open' as const };

  return (
    <View style={styles.titleBlock}>
      <View style={styles.chipRow}>
        {'ended' in badge ? (
          <Badge
            label={badge.label}
            tone="custom"
            bg={colors.endedBadge}
            fg={colors.textSecondary}
            uppercase
          />
        ) : (
          <Badge label={badge.label} tone={badge.tone} uppercase />
        )}
        <View
          style={[styles.swatch, { backgroundColor: groupColor ?? colorForName(groupName) }]}
        />
        <ThemedText variant="caption">{groupName}</ThemedText>
      </View>
      <ThemedText variant="screenTitle" color={d.isEnded ? colors.textSecondary : colors.textPrimary}>
        {title}
      </ThemedText>
      {description ? (
        <ThemedText variant="sub" color={d.isEnded ? colors.textMuted : colors.textSecondary}>
          {description}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 5,
    marginLeft: spacing.xs,
  },
});
