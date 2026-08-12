import { StyleSheet } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { fmtDay, fmtTime } from '../../lib/dates';
import type { PlanDerived, PlanDetailRow } from '../../lib/planDerived';
import { Card, ListRow, ThemedText } from '../ui';
import { colors } from '../../theme/tokens';

/**
 * When, where and who set it up: the rows that do not change once the plan is
 * settled. A locked date animates in because it arrives mid-screen when the
 * host ends the vote; everything else is already there on first paint.
 */
export function PlanFactsCard({ plan, d }: { plan: PlanDetailRow; d: PlanDerived }) {
  const hasLocked = d.isLocked && !!plan.locked_date;
  // created_by goes null when the person who posted it deleted their account:
  // the plan outlives them, the name does not.
  const hostName = d.youCreated ? 'you' : plan.creator?.display_name ?? 'someone who left';

  return (
    <Animated.View layout={LinearTransition}>
      <Card padded={false} style={d.isEnded ? styles.endedDetails : null}>
        {hasLocked && plan.locked_date ? (
          <Animated.View entering={FadeInDown}>
            <ListRow
              title={fmtDay(plan.locked_date)}
              value={fmtTime(plan.locked_date)}
              struck={d.isCancelled}
            />
          </Animated.View>
        ) : null}
        {plan.event_date ? (
          <ListRow
            title={fmtDay(plan.event_date)}
            value={fmtTime(plan.event_date)}
            struck={d.isCancelled}
          />
        ) : null}
        {plan.location ? (
          <ListRow
            title={plan.location}
            divider={!!plan.event_date || hasLocked}
            right={
              d.isEnded ? undefined : (
                <ThemedText variant="bodyStrong" color={colors.accent}>
                  Map
                </ThemedText>
              )
            }
          />
        ) : null}
        <ListRow
          title={
            d.isEnded
              ? `${d.youCreated ? 'You' : plan.creator?.display_name ?? 'Someone who left'} set this up`
              : `Hosted by ${hostName}`
          }
          divider={!!plan.location || !!plan.event_date || hasLocked}
        />
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  endedDetails: {
    opacity: 0.7,
  },
});
