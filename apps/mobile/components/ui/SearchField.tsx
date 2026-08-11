import { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { colors, fonts, radii } from '../../theme/tokens';
import { SearchGlyph } from './NavigationGlyphs';

interface SearchFieldProps
  extends Omit<TextInputProps, 'style' | 'placeholderTextColor' | 'editable'> {
  /**
   * A picture of a search box rather than one: no taps, no focus, no keyboard.
   * The three travel together as a single prop so a later edit cannot leave one
   * of them behind and quietly grow a live field inside onboarding's art.
   */
  decorative?: boolean;
  /**
   * Fill with paper instead of white, for a box that sits on a white card
   * rather than on the screen. Onboarding's still life is the only one.
   */
  onCard?: boolean;
}

/**
 * The app's search box: magnifier, then the field, in a bordered row.
 *
 * The border follows FormField rather than the black outline find-people used
 * to wear (PLA-85). An ink border means *selected* everywhere else in Planazo:
 * the active chip, the chosen swatch. A resting input in that colour was saying
 * the wrong word. Resting is `borderStrong` and focus is ember, which is what
 * every other input in the app does.
 */
export function SearchField({
  decorative = false,
  onCard = false,
  testID,
  ...rest
}: SearchFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[styles.box, onCard && styles.boxOnCard, focused && styles.boxFocused]}
      pointerEvents={decorative ? 'none' : 'auto'}
      testID={testID ? `${testID}-box` : undefined}
    >
      <SearchGlyph />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
        testID={testID}
        editable={!decorative}
        style={styles.input}
        placeholderTextColor={colors.textFaint}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radii.input,
    paddingHorizontal: 15,
  },
  boxOnCard: {
    backgroundColor: colors.background,
  },
  boxFocused: {
    borderColor: colors.accent,
  },
  // The padding is the input's, not the box's, so the whole visible rectangle
  // takes a tap. It shares FormField's app-wide floor for large text settings.
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 13,
    minHeight: MIN_TOUCH_TARGET,
  },
});
