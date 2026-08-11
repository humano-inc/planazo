import { type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../theme/tokens';
import { ActionButton, type ActionAlign } from './ActionButton';
import { ThemedText } from './ThemedText';

interface TextActionProps {
  label: string;
  onPress: () => void;
  /** `quiet` is the secondary of a pair, e.g. "Remove" beside "Change". */
  tone?: 'accent' | 'quiet';
  disabled?: boolean;
  accessibilityLabel?: string;
  align?: ActionAlign;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Borderless, labeled action for content and section rows. */
export function TextAction({
  label,
  onPress,
  tone = 'accent',
  disabled = false,
  accessibilityLabel,
  align = 'center',
  style,
  testID,
}: TextActionProps) {
  return (
    <ActionButton
      onPress={onPress}
      align={align}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={style}
      testID={testID}
    >
      <ThemedText
        variant="bodyStrong"
        color={tone === 'quiet' ? colors.textMuted : colors.accentText}
        numberOfLines={1}
      >
        {label}
      </ThemedText>
    </ActionButton>
  );
}
