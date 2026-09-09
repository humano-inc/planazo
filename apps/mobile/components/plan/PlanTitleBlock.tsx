import { StyleSheet, View } from 'react-native';
import type { PlanDerived, PlanDetailRow } from '../../lib/planDerived';
import { Badge, PeopleGlyph, ThemedText, colorForName } from '../ui';
import { audienceLabel } from '../../lib/planAudience';
import { colors, spacing } from '../../theme/tokens';

/**
 * What the plan is: its state, who it is for, its title and blurb.
 *
 * The badge's four states come from `derivePlanDetail`, beside the headline
 * that runs the same precedence — an ending beats a confirmation. Deciding it
 * here would have been a second, untested copy of that order.
 */
export function PlanTitleBlock({ plan, d }: { plan: PlanDetailRow; d: PlanDerived }) {
  const badge = d.statusBadge;
  const context = audienceLabel(plan);

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
        {context.people ? (
          <View style={[styles.swatch, styles.peopleTile]} testID="plan-title-people">
            <PeopleGlyph size={9} />
          </View>
        ) : (
          <View
            style={[styles.swatch, { backgroundColor: context.color ?? colorForName(context.label) }]}
          />
        )}
        <ThemedText variant="caption" numberOfLines={1} style={styles.contextLabel}>
          {context.label}
        </ThemedText>
      </View>
      <ThemedText variant="screenTitle" color={d.isEnded ? colors.textSecondary : colors.textPrimary}>
        {plan.title}
      </ThemedText>
      {plan.description ? (
        <ThemedText variant="sub" color={d.isEnded ? colors.textMuted : colors.textSecondary}>
          {plan.description}
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
  peopleTile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  // "Friends of friends · via Marta García" is the longest thing this row
  // holds; it yields to the badge rather than pushing it off.
  contextLabel: {
    flexShrink: 1,
  },
});
