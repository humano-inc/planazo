import { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
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

interface SearchFieldProps extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  /**
   * Fill with paper instead of white, for a box that sits on a white card
   * rather than on the screen. Onboarding's still life is the only one.
   */
  onCard?: boolean;
  testID?: string;
}

/**
 * The app's search box: magnifier, then the field, in a bordered row.
 *
 * The border follows {@link FormField} rather than the black outline
 * find-people used to wear (PLA-85). An ink border means *selected* everywhere
 * else in Planazo — the active chip, the chosen swatch — so a resting input in
 * that colour was saying the wrong word. Resting is `borderStrong` and focus is
 * ember, which is what every other input in the app does.
 */
export function SearchField({ onCard = false, ...rest }: SearchFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.box, onCard && styles.boxOnCard, focused && styles.boxFocused]}>
      <SearchGlyph />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
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
  // 11pt, not 13: the handle needs the remaining 4pt of the 15pt box to clear
  // the ring. A wider ring runs its own stroke back across the lens.
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
  // takes a tap — the same reasoning as FormField, and the same 44pt floor for
  // large text settings.
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 13,
    minHeight: 44,
  },
});
