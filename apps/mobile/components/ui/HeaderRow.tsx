import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { spacing } from '../../theme/tokens';
import { ThemedText } from './ThemedText';

type Props = {
  layout?: 'spread' | 'leading';
  left?: ReactNode;
  right?: ReactNode;
  rightSpacerWidth?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  title?: ReactNode;
  titleStyle?: StyleProp<TextStyle>;
};

/**
 * Shared screen chrome for form, navigation, sheet, and menu rows.
 *
 * HeaderAction and BackButton own control behavior. HeaderRow owns their
 * placement, the title token, and the balancing space around the title.
 */
export function HeaderRow({
  layout = 'spread',
  left,
  right,
  rightSpacerWidth,
  style,
  testID,
  title,
  titleStyle,
}: Props) {
  return (
    <View
      style={[styles.row, layout === 'leading' && styles.leading, style]}
      testID={testID}
    >
      {left}
      {title ? (
        <ThemedText numberOfLines={1} style={titleStyle} variant="screenHeader">
          {title}
        </ThemedText>
      ) : null}
      {right ??
        (rightSpacerWidth !== undefined ? (
          <View
            style={{ width: rightSpacerWidth }}
            testID={testID ? `${testID}-spacer` : undefined}
          />
        ) : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  leading: {
    justifyContent: 'flex-start',
    gap: 14,
  },
});
