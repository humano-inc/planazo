import { Pressable, StyleSheet, View } from 'react-native';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { colors, spacing } from '../../theme/tokens';

interface ColorSwatchPickerProps {
  /** The palette to choose from, in display order. */
  swatches: readonly string[];
  /** The chosen colour, matched by value. */
  selected: string | undefined;
  onSelect: (color: string, index: number) => void;
}

/** Row of tappable colour swatches, one of them ringed as chosen. */
export function ColorSwatchPicker({ swatches, selected, onSelect }: ColorSwatchPickerProps) {
  return (
    <View style={styles.swatches}>
      {swatches.map((swatch, index) => (
        <Pressable
          key={swatch}
          accessibilityRole="button"
          accessibilityLabel={`Group color ${index + 1}`}
          accessibilityState={{ selected: swatch === selected }}
          onPress={() => onSelect(swatch, index)}
          style={[
            styles.swatch,
            { backgroundColor: swatch },
            swatch === selected && styles.swatchSelected,
          ]}
          testID={`swatch-${index}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  swatches: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  swatch: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: 15,
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: colors.ink,
  },
});
