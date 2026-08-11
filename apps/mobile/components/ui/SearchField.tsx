import { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { colors, fonts, radii } from '../../theme/tokens';

/**
 * The magnifier: a ring and a stroke at 45°, drawn from two views because the
 * app ships no icon set. Sized to sit on a 16pt text line, so a caller can drop
 * it beside a field or a button label without nudging it.
 *
 * The colour is a prop because the glyph does two jobs. Inside a field it is a
 * hint, and takes `textMuted`; on the groups tab's "Find people" pill it is
 * part of a button label, and takes the label's own ink.
 */
export function SearchGlyph({ color = colors.textMuted }: { color?: string }) {
  return (
    <View style={styles.glyph} testID="search-glyph">
      <View style={[styles.lens, { borderColor: color }]} testID="search-glyph-lens" />
      <View style={[styles.handle, { backgroundColor: color }]} testID="search-glyph-handle" />
    </View>
  );
}

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
  glyph: {
    width: 15,
    height: 14,
  },
  // 11pt, not 13. The ring is pinned to the top of a 14pt box and the handle to
  // the bottom, so the ring's *height* is what leaves the handle a band of its
  // own. At 13 there is none, and the stroke crosses the ring instead of
  // emerging from it, which is what the admins screen's copy was doing.
  lens: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 11,
    height: 11,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  handle: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 8,
    height: 2,
    transform: [{ rotate: '45deg' }],
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
