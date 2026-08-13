import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import type { City } from '@planazo/shared';
import { cityCaption } from '../../lib/cities';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { CityPicker } from './CityPicker';
import { ThemedText, ForwardGlyph, TextAction } from '../ui';
import { colors, radii, spacing } from '../../theme/tokens';

interface Props {
  value: City | null;
  onChange: (city: City) => void;
}

/**
 * The city step in group creation (PLA-88): a closed row, the picker, then the
 * city you chose.
 *
 * Closed to start, because the list is long and the person filling this in
 * usually knows the answer already: one tap, a few letters, done, and the form
 * closes back up to a single line. Choosing collapses it again rather than
 * leaving ninety rows open under a decision that has been made.
 *
 * There is no way back to "no city". The group cannot be created without one,
 * so an empty state after a choice would be a step backwards into a state the
 * Create button refuses.
 *
 * The row opens whether or not the list has arrived: `CityPicker` fetches it
 * and says so itself, which is one story about loading rather than two that
 * can disagree.
 */
export function CityField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const choose = (city: City) => {
    onChange(city);
    setOpen(false);
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <ThemedText variant="sectionLabel">City</ThemedText>
        {open ? (
          <TextAction label="Close" onPress={() => setOpen(false)} testID="city-close" />
        ) : null}
      </View>

      {open ? (
        <CityPicker selectedId={value?.id ?? null} onSelect={choose} />
      ) : value ? (
        <>
          <View style={styles.row} testID="city-picked">
            <View style={styles.chosenDot}>
              <View style={styles.chosenDotCore} />
            </View>
            <ThemedText variant="bodyStrong" numberOfLines={1} style={styles.rowLabel}>
              {value.name}
            </ThemedText>
            <TextAction label="Change" onPress={() => setOpen(true)} testID="city-change" />
          </View>
          <ThemedText variant="sub">{cityCaption(value.name)}</ThemedText>
        </>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          testID="city-open"
        >
          <View style={styles.emptyDot} />
          <ThemedText variant="body" color={colors.textFaint} style={styles.rowLabel}>
            Pick the city you meet in
          </ThemedText>
          <ForwardGlyph color={colors.textFaint} testID="city-open-glyph" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH_TARGET,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.input,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  rowPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
  },
  emptyDot: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.textMuted,
  },
  chosenDot: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chosenDotCore: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
});
