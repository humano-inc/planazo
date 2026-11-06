import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { fmtDay, isoOfDate, localDate, timeOfDate } from '../../lib/dates';
import {
  endDayLabel,
  planEndHasPassed,
  planEndIso,
  resolvePlanEnd,
  rolloverNotice,
  UNTOUCHED_END,
  type PlanEndDraft,
} from '../../lib/planEnd';
import { PlusGlyph, ThemedText } from '../ui';
import { colors, fonts, spacing } from '../../theme/tokens';

type Wheel = 'start' | 'endDay' | 'endTime';

interface Props {
  /** YYYY-MM-DD */
  startDay: string;
  /** HH:MM */
  startTime: string;
  /** Left out where the start is settled: the card then shows it without offering it. */
  onStartTimeChange?: (time: string) => void;
  /** Null is no end. Plenty of plans have no honest answer, so this is never required. */
  end: PlanEndDraft | null;
  onEndChange: (end: PlanEndDraft | null) => void;
}

/** A Date whose only meaningful part is the time, for the wheel to sit on. */
const onDay = (day: string, time: string) => {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return localDate(day, h, m);
};

/**
 * When a plan starts and, if the host says, when it ends: creating a plan,
 * locking a vote and editing all ask this the same way.
 *
 * Which wheel is open stays here, since nothing outside this card can tell.
 */
export function PlanTimesCard({ startDay, startTime, onStartTimeChange, end, onEndChange }: Props) {
  const [wheel, setWheel] = useState<Wheel | null>(null);
  const resolved = end ? resolvePlanEnd(startDay, startTime, end) : null;
  const toggle = (next: Wheel) => setWheel((open) => (open === next ? null : next));
  const close = () => setWheel(null);

  // On iOS the spinner stays open while it turns. On Android it is a dialog, and
  // answering it is what closes it.
  const closeOnAndroid = () => {
    if (Platform.OS !== 'ios') close();
  };

  const removeEnd = () => {
    close();
    onEndChange(null);
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <ThemedText variant="bodyStrong">{onStartTimeChange ? 'Starts at' : 'Starts'}</ThemedText>
        {onStartTimeChange ? (
          <Pressable
            onPress={() => toggle('start')}
            accessibilityRole="button"
            accessibilityLabel={`Starts at ${startTime}`}
            testID="time-pill"
            style={styles.pill}
          >
            <ThemedText style={styles.timeValue}>{startTime}</ThemedText>
          </Pressable>
        ) : (
          <ThemedText variant="body" color={colors.textSecondary} testID="start-settled">
            {fmtDay(localDate(startDay).toISOString())} · {startTime}
          </ThemedText>
        )}
      </View>
      {wheel === 'start' && onStartTimeChange ? (
        <DateTimePicker
          value={onDay(startDay, startTime)}
          mode="time"
          display="spinner"
          onValueChange={(_event, picked) => {
            closeOnAndroid();
            onStartTimeChange(timeOfDate(picked));
          }}
          onDismiss={close}
          testID="start-wheel"
        />
      ) : null}

      <View style={styles.divider} />

      {end && resolved ? (
        <>
          <View style={styles.row}>
            <ThemedText variant="bodyStrong">Ends</ThemedText>
            <View style={styles.pills}>
              <Pressable
                onPress={() => toggle('endDay')}
                accessibilityRole="button"
                accessibilityLabel={`End day: ${endDayLabel(resolved.day, startDay)}`}
                testID="end-day-pill"
                style={[styles.pill, styles.dayPill]}
              >
                <ThemedText variant="bodyStrong" testID="end-day-label">
                  {endDayLabel(resolved.day, startDay)}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => toggle('endTime')}
                accessibilityRole="button"
                accessibilityLabel={`Ends at ${resolved.time}`}
                testID="end-time-pill"
                style={styles.pill}
              >
                <ThemedText style={styles.timeValue}>{resolved.time}</ThemedText>
              </Pressable>
            </View>
          </View>
          {wheel === 'endDay' ? (
            <DateTimePicker
              value={localDate(resolved.day)}
              mode="date"
              display="spinner"
              minimumDate={localDate(startDay)}
              onValueChange={(_event, picked) => {
                closeOnAndroid();
                onEndChange({ ...end, day: isoOfDate(picked) });
              }}
              onDismiss={close}
              testID="end-day-wheel"
            />
          ) : null}
          {wheel === 'endTime' ? (
            <DateTimePicker
              value={onDay(resolved.day, resolved.time)}
              mode="time"
              display="spinner"
              onValueChange={(_event, picked) => {
                closeOnAndroid();
                onEndChange({ ...end, time: timeOfDate(picked) });
              }}
              onDismiss={close}
              testID="end-time-wheel"
            />
          ) : null}

          {planEndHasPassed(planEndIso(startDay, startTime, end)) ? (
            <ThemedText variant="caption" color={colors.accentText} testID="end-passed">
              That has already gone by. Pick a later end.
            </ThemedText>
          ) : resolved.rolledOver ? (
            <ThemedText variant="caption" color={colors.textSecondary} testID="end-rollover">
              {rolloverNotice(resolved.day)}
            </ThemedText>
          ) : null}

          <View style={styles.divider} />
          <Pressable
            onPress={removeEnd}
            accessibilityRole="button"
            testID="end-remove"
            style={styles.textAction}
          >
            <ThemedText variant="caption" color={colors.textSecondary}>
              Remove end time
            </ThemedText>
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={() => onEndChange(UNTOUCHED_END)}
          accessibilityRole="button"
          accessibilityLabel="Add end time"
          testID="end-add"
          style={styles.textAction}
        >
          <PlusGlyph color={colors.accentText} />
          <ThemedText variant="bodyStrong" color={colors.accentText}>
            Add end time
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The bottom is tighter than the top because the last thing in here is always
  // a full-height text action, whose own target supplies the rest.
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingTop: 14,
    paddingBottom: spacing.xs,
    paddingHorizontal: 16,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  pills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  pill: {
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  dayPill: {
    flexShrink: 1,
  },
  timeValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  textAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH_TARGET,
  },
});
