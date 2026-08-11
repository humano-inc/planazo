import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { ActionButton } from './ActionButton';
import { BackGlyph } from './NavigationGlyphs';
import { ThemedText } from './ThemedText';

interface BackButtonProps {
  onPress: () => void;
  /** Where back goes, e.g. "Weekend Crew". Announced as "Back to Weekend Crew". */
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
  // "Back to Back" helps nobody: a label that is already the word stands alone.
  const spokenLabel = label && label !== 'Back' ? `Back to ${label}` : 'Back';

  return (
    <ActionButton
      onPress={onPress}
      align="start"
      accessibilityLabel={accessibilityLabel ?? spokenLabel}
      style={[styles.row, style]}
      testID={testID}
    >
      <BackGlyph color={color} />
      {Platform.OS === 'ios' && label ? (
        <ThemedText variant="control" color={color} numberOfLines={1}>
          {label}
        </ThemedText>
      ) : null}
    </ActionButton>
  );
}

const styles = StyleSheet.create({
  // A row, so the box's own centring means the wrong axis: `alignItems` now
  // centres the glyph against the label, and the chevron has to stay hard left
  // against the screen edge with no padding of its own.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    gap: spacing.xxs,
  },
});
