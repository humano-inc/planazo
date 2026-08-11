import { Platform, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { colors, fonts, spacing } from '../../theme/tokens';
import { BackGlyph } from './NavigationGlyphs';
import { ThemedText } from './ThemedText';

interface BackButtonProps {
  onPress: () => void;
  label?: string;
  color?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** One-line platform back affordance with a real touch target. */
export function BackButton({
  onPress,
  label,
  color = colors.accentText,
  accessibilityLabel,
  style,
  testID,
}: BackButtonProps) {
  const visibleLabel = Platform.OS === 'ios' ? label : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (label ? `Back to ${label}` : 'Back')}
      onPress={onPress}
      style={({ pressed }) => [styles.control, style, pressed && styles.pressed]}
      testID={testID}
    >
      <BackGlyph color={color} />
      {visibleLabel ? (
        <ThemedText
          color={color}
          numberOfLines={1}
          style={styles.label}
        >
          {visibleLabel}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.xxs,
    flexShrink: 0,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.55,
  },
});
