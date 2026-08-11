import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { colors, spacing } from '../../theme/tokens';
import { ThemedText } from './ThemedText';

interface TextActionProps {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'destructive';
  disabled?: boolean;
  accessibilityLabel?: string;
  align?: 'start' | 'center' | 'end';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Borderless, labeled action for content and section rows. */
export function TextAction({
  label,
  onPress,
  tone = 'default',
  disabled = false,
  accessibilityLabel,
  align = 'center',
  style,
  testID,
}: TextActionProps) {
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
        variant="bodyStrong"
        color={tone === 'destructive' ? colors.accentPressed : colors.accentText}
        numberOfLines={1}
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
  center: {
    alignItems: 'center',
  },
  end: {
    alignItems: 'flex-end',
  },
  pressed: {
    opacity: 0.55,
  },
  disabled: {
    opacity: 0.4,
  },
});
