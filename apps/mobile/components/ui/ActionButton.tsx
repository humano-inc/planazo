import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { spacing } from '../../theme/tokens';

export type ActionAlign = 'start' | 'center' | 'end';

interface ActionButtonProps {
  onPress: () => void;
  align?: ActionAlign;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: ReactNode;
}

/**
 * The borderless control box every labelled action shares: the 48pt floor, the
 * alignment, and one pressed/disabled feedback pair.
 *
 * Kept internal on purpose. Screens reach for `HeaderAction`, `TextAction` or
 * `BackButton`, which differ only in what they draw inside this box; the box
 * itself is the part nobody should be re-deciding.
 *
 * `accessibilityState` is deliberately absent: `Pressable` derives it from
 * `disabled`, and a hand-written one is discarded.
 */
export function ActionButton({
  onPress,
  align = 'center',
  disabled = false,
  accessibilityLabel,
  style,
  testID,
  children,
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        actionStyles.control,
        actionStyles[align],
        style,
        pressed && actionStyles.pressed,
        disabled && actionStyles.disabled,
      ]}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

const actionStyles = StyleSheet.create({
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
