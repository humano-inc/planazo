import { StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { COMMENT_MAX_LENGTH, isCommentBodyValid } from '@planazo/shared';
import { Button } from '../ui';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { colors, fonts, radii, spacing } from '../../theme/tokens';

/** About five lines. Past that the field scrolls, so the list above stays visible. */
const INPUT_MAX_HEIGHT = 128;
const INPUT_LINE_HEIGHT = 22;
const INPUT_PADDING_Y = spacing.md;

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
}

/** The field and its Send, which live in the comments screen's footer. */
export function CommentComposer({ value, onChangeText, onSend, sending }: Props) {
  const ready = isCommentBodyValid(value) && !sending;
  const { fontScale } = useWindowDimensions();

  // Sending empties `value` from here, and iOS leaves a multiline field as tall
  // as what it held until the next keystroke. Empty has one height, so say it:
  // one line at the current text size. Any text hands sizing back to the field.
  const emptyHeight = Math.max(
    MIN_TOUCH_TARGET,
    INPUT_LINE_HEIGHT * fontScale + INPUT_PADDING_Y * 2
  );

  return (
    <View style={styles.row}>
      <TextInput
        style={[styles.input, !value && { height: emptyHeight }]}
        value={value}
        onChangeText={onChangeText}
        placeholder="Add a comment"
        placeholderTextColor={colors.textFaint}
        accessibilityLabel="Add a comment"
        multiline
        maxLength={COMMENT_MAX_LENGTH}
        testID="comment-input"
      />
      <Button
        label={sending ? 'Sending…' : 'Send'}
        size="md"
        variant={ready ? 'primary' : 'secondary'}
        disabled={!ready}
        haptic={ready}
        onPress={onSend}
        testID="comment-send"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    maxHeight: INPUT_MAX_HEIGHT,
    paddingHorizontal: spacing.lg,
    paddingTop: INPUT_PADDING_Y,
    paddingBottom: INPUT_PADDING_Y,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: INPUT_LINE_HEIGHT,
    color: colors.textPrimary,
  },
});
