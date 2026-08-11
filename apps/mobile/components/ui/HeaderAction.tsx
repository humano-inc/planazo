import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { colors, fonts, spacing } from '../../theme/tokens';
import { ThemedText } from './ThemedText';

type HeaderActionTone = 'accent' | 'muted';

interface HeaderActionProps {
  label: string;
  onPress: () => void;
  align?: 'start' | 'end';
  tone?: HeaderActionTone;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** One-line text action for a screen header. */
export function HeaderAction({
  label,
  onPress,
  align = 'start',
  tone = 'accent',
  disabled = false,
  accessibilityLabel,
  style,
  testID,
}: HeaderActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        styles[align],
        style,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      testID={testID}
    >
      <ThemedText
        color={tone === 'muted' ? colors.textSecondary : colors.accentText}
        numberOfLines={1}
        style={styles.label}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    flexShrink: 0,
  },
  start: {
    alignItems: 'flex-start',
  },
  end: {
    alignItems: 'flex-end',
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.55,
  },
  disabled: {
    opacity: 0.4,
  },
});
