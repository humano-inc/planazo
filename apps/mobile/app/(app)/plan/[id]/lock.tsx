import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { dayTimeToIso, fmtDay, isoOfDate } from '../../../../lib/dates';
import { useDismissTo } from '../../../../lib/navigation';
import { planEndHasPassed, planEndIso, type PlanEndDraft } from '../../../../lib/planEnd';
import { useLockPlan } from '../../../../lib/useLockPlan';
import { planDetailQuery } from '../../../../lib/usePlanDetail';
import { PlanTimesCard } from '../../../../components/plan/PlanTimesCard';
import { ButtonRow, FormScreen, ThemedText } from '../../../../components/ui';
import { colors, radii, spacing } from '../../../../theme/tokens';

/**
 * Locking in the date a vote settled on. A date option is only a day, so this
 * is where the plan gets its start, and its end if the host wants to give one.
 * Not an OS alert, because an alert cannot ask.
 */
export default function LockPlanScreen() {
  const { id, optionId, date } = useLocalSearchParams<{
    id: string;
    optionId: string;
    date: string;
  }>();

  // Plan detail always sends both, but this route is also a live deep link, and
  // a date that does not parse has no day to build a time on.
  if (!optionId || !date || Number.isNaN(new Date(date).getTime())) {
    return <Redirect href={`/(app)/plan/${id}`} />;
  }
  return <LockSheet id={id} optionId={optionId} date={date} />;
}

function LockSheet({ id, optionId, date }: { id: string; optionId: string; date: string }) {
  const leave = useDismissTo(`/(app)/plan/${id}`);
  const { data: plan } = useQuery(planDetailQuery(id));
  const lockPlan = useLockPlan(id, plan?.group_id, { onLocked: leave });

  const startDay = isoOfDate(new Date(date));
  const [startTime, setStartTime] = useState('20:30');
  const [end, setEnd] = useState<PlanEndDraft | null>(null);
  const endsAt = end ? planEndIso(startDay, startTime, end) : null;

  return (
    <FormScreen
      header={<View style={styles.grabber} />}
      contentContainerStyle={styles.sheet}
      testID="lock"
      footer={
        <ButtonRow
          secondary={{
            label: 'Not yet',
            variant: 'secondary',
            onPress: leave,
            testID: 'lock-not-yet',
          }}
          primary={{
            label: 'Lock in',
            disabled: lockPlan.isPending || (!!endsAt && planEndHasPassed(endsAt)),
            onPress: () =>
              lockPlan.mutate({
                dateOptionId: optionId,
                startsAt: dayTimeToIso(startDay, startTime),
                endsAt,
              }),
            testID: 'lock-confirm',
          }}
        />
      }
    >
      <View style={styles.headerBlock}>
        <ThemedText variant="headerTitle">Lock in {fmtDay(date)}</ThemedText>
        <ThemedText variant="body" color={colors.textSecondary}>
          This ends the vote and notifies everyone who can make it.
        </ThemedText>
      </View>

      <PlanTimesCard
        startDay={startDay}
        startTime={startTime}
        onStartTimeChange={setStartTime}
        end={end}
        onEndChange={setEnd}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.endedBorder,
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  headerBlock: {
    gap: 7,
  },
});
