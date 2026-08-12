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
  // Narrowed rather than a boolean, so the row below tests it once instead of
  // re-testing `plan.locked_date` to satisfy the compiler.
  const lockedDate = d.isLocked ? plan.locked_date : null;
  // created_by goes null when the person who posted it deleted their account:
  // the plan outlives them, the name does not.
  const ours = d.youCreated || !plan.creator?.display_name;
  const hostName = d.youCreated ? 'you' : plan.creator?.display_name ?? 'someone who left';
  // Only our own words take the capital that opens the ended sentence. A
  // display name is rendered exactly as its owner wrote it, lower case and all.
  const hostSentence = d.isEnded
    ? `${ours ? hostName.charAt(0).toUpperCase() + hostName.slice(1) : hostName} set this up`
    : `Hosted by ${hostName}`;

  return (
    <Animated.View layout={LinearTransition}>
      <Card padded={false} style={d.isEnded ? styles.endedDetails : null}>
        {lockedDate ? (
          <Animated.View entering={FadeInDown}>
            <ListRow
              title={fmtDay(lockedDate)}
              value={fmtTime(lockedDate)}
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
            divider={!!plan.event_date || !!lockedDate}
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
          title={hostSentence}
          divider={!!plan.location || !!plan.event_date || !!lockedDate}
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
