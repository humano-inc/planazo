import { type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../theme/tokens';
import { ActionButton } from './ActionButton';
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
    <ActionButton
      onPress={onPress}
      align={align}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={style}
      testID={testID}
    >
      <ThemedText
        variant="control"
        color={tone === 'muted' ? colors.textSecondary : colors.accentText}
        numberOfLines={1}
      >
        {label}
      </ThemedText>
    </ActionButton>
  );
}
