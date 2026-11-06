import { View, StyleSheet, Pressable } from 'react-native';
import { NO_MINIMUM } from '@planazo/shared';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { lowerCap, raiseCap, stepMin } from '../../lib/howMany';
import { MinusGlyph, PlusGlyph, ThemedText } from '../ui';
import { colors, fonts, spacing } from '../../theme/tokens';

interface Props {
  /** How many people it takes for the plan to happen at all, or NO_MINIMUM. */
  min: number;
  /** The ceiling, or null for no limit. */
  cap: number | null;
  onMinChange: (next: number) => void;
  onCapChange: (next: number | null) => void;
}

/** "How many": the floor and the ceiling, as a pair of steppers. */
export function HowManyField({ min, cap, onMinChange, onCapChange }: Props) {
  const noMinimum = min === NO_MINIMUM;
  const changeMin = (delta: 1 | -1) => {
    const next = stepMin(min, delta);
    // The ceiling may equal the floor ("exactly N people" is a valid plan),
    // so a climbing floor drags the cap along to match, never past it
    if (cap !== null && cap < next) onCapChange(next);
    onMinChange(next);
  };

  return (
    <View style={styles.section}>
      <ThemedText variant="sectionLabel">How many</ThemedText>
      <View style={styles.howManyCard}>
        <View style={styles.stepperRow}>
          {noMinimum ? (
            <ThemedText variant="body" style={styles.stepperCopy}>
              <ThemedText variant="body" style={styles.strong}>
                No minimum.
              </ThemedText>
              {'\n'}Happens either way.
            </ThemedText>
          ) : (
            <ThemedText variant="body" style={styles.stepperCopy}>
              Only happens if{'\n'}
              <ThemedText variant="body" style={styles.strong}>
                {min} people
              </ThemedText>{' '}
              are in
            </ThemedText>
          )}
          <View style={styles.stepper}>
            <Pressable
              onPress={() => changeMin(-1)}
              accessibilityRole="button"
              accessibilityLabel="Fewer people needed"
              testID="min-down"
              style={styles.stepDown}
            >
              <MinusGlyph color={colors.textSecondary} />
            </Pressable>
            <ThemedText
              style={styles.stepValue}
              color={noMinimum ? colors.textFaint : colors.textPrimary}
              testID="min-value"
            >
              {noMinimum ? '—' : min}
            </ThemedText>
            <Pressable
              onPress={() => changeMin(1)}
              accessibilityRole="button"
              accessibilityLabel="More people needed"
              testID="min-up"
              style={styles.stepUp}
            >
              <PlusGlyph color={colors.background} />
            </Pressable>
          </View>
        </View>
        <View style={styles.hairline} />
        <View style={styles.stepperRow}>
          <ThemedText variant="body" style={styles.stepperCopy}>
            Room for{'\n'}
            <ThemedText
              variant="body"
              style={styles.strong}
              color={cap ? colors.textPrimary : colors.textFaint}
            >
              {cap ?? 'No limit'}
            </ThemedText>
          </ThemedText>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => onCapChange(lowerCap(cap, min))}
              accessibilityRole="button"
              accessibilityLabel="Lower the cap"
              testID="cap-down"
              style={styles.stepDown}
            >
              <MinusGlyph color={colors.textSecondary} />
            </Pressable>
            <ThemedText
              style={styles.stepValue}
              color={cap ? colors.textPrimary : colors.textFaint}
              testID="cap-value"
            >
              {cap ?? '—'}
            </ThemedText>
            <Pressable
              onPress={() => onCapChange(raiseCap(cap, min))}
              accessibilityRole="button"
              accessibilityLabel="Raise the cap"
              testID="cap-up"
              style={styles.stepUp}
            >
              <PlusGlyph color={colors.background} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  howManyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    overflow: 'hidden',
  },
  stepperRow: {
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepperCopy: {
    flexShrink: 1,
  },
  strong: {
    fontFamily: fonts.bodyBold,
  },
  hairline: {
    height: 1,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.lg,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Both steppers were 38×38. They come in pairs a few points apart, so real
  // boxes matter here: two hitSlop regions would have overlapped and the one
  // that won a tap in the middle would not have been visible (PLA-40).
  stepDown: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  stepUp: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  stepValue: {
    width: 44,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 24,
    color: colors.textPrimary,
  },
});
