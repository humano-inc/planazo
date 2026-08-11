import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { BackGlyph, ForwardGlyph } from './NavigationGlyphs';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { isoOfDate } from '../../lib/dates';
import { buildMonthGrid } from '../../lib/monthGrid';
import { colors, fonts, spacing } from '../../theme/tokens';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
// How far ahead the month arrows can go (design: half a year of runway)
const MAX_MONTHS_AHEAD = 5;

interface MonthCalendarProps {
  /** Picked days as YYYY-MM-DD */
  selected: string[];
  onToggleDay: (iso: string) => void;
}

/** Month grid from design 5a: tap days to pick them, past days are dead. */
export function MonthCalendar({ selected, onToggleDay }: MonthCalendarProps) {
  const [offset, setOffset] = useState(0);

  const now = new Date();
  const today = isoOfDate(now);
  const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const weeks = buildMonthGrid(base.getFullYear(), base.getMonth());

  const label = base.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const atStart = offset === 0;
  const atEnd = offset === MAX_MONTHS_AHEAD;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setOffset((o) => Math.max(0, o - 1))}
          disabled={atStart}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          testID="cal-prev"
          style={[styles.arrow, atStart && styles.arrowDisabled]}
        >
          <BackGlyph />
        </Pressable>
        <ThemedText style={styles.monthLabel}>{label}</ThemedText>
        <Pressable
          onPress={() => setOffset((o) => Math.min(MAX_MONTHS_AHEAD, o + 1))}
          disabled={atEnd}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          testID="cal-next"
          style={[styles.arrow, atEnd && styles.arrowDisabled]}
        >
          <ForwardGlyph />
        </Pressable>
      </View>

      <View style={styles.week}>
        {DOW.map((d, i) => (
          <ThemedText key={`dow-${i}`} style={styles.dow}>
            {d}
          </ThemedText>
        ))}
      </View>

      <View style={styles.grid}>
        {weeks.map((week, wi) => (
          <View key={`w-${wi}`} style={styles.week}>
            {week.map((cell) => {
              if (!cell.iso) return <View key={cell.key} style={styles.day} />;
              const past = cell.iso < today;
              const on = selected.includes(cell.iso);
              const isToday = cell.iso === today;
              return (
                <Pressable
                  key={cell.key}
                  onPress={() => onToggleDay(cell.iso!)}
                  disabled={past}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: past }}
                  testID={`cal-day-${cell.iso}`}
                  style={[styles.day, on && styles.dayOn]}
                >
                  <ThemedText
                    style={[styles.dayLabel, (on || isToday) && styles.dayLabelBold]}
                    color={
                      on
                        ? colors.textOnAccent
                        : past
                          ? colors.textFaint
                          : isToday
                            ? colors.accent
                            : colors.textPrimary
                    }
                  >
                    {cell.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
  },
  arrow: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisabled: {
    opacity: 0.3,
  },
  monthLabel: {
    fontFamily: fonts.display,
    fontSize: 17,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  grid: {
    gap: 0,
  },
  week: {
    flexDirection: 'row',
    gap: 0,
  },
  dow: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    lineHeight: 15,
    color: colors.textFaint,
    paddingBottom: 4,
  },
  day: {
    flex: 1,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  dayOn: {
    backgroundColor: colors.accent,
  },
  dayLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 19,
  },
  dayLabelBold: {
    fontFamily: fonts.bodyBold,
  },
});
