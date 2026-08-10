import { Pressable, StyleSheet, View } from 'react-native';
import { Link, type Href } from 'expo-router';
import { ThemedText } from './ThemedText';
import { LINK_HIT_SLOP } from '../../lib/a11y';
import { colors, fonts } from '../../theme/tokens';

type Props = {
  /** The question, in plain weight. "First time here?" */
  prompt: string;
  /** The answer, and the tappable half of the row. "Sign up" */
  action: string;
  testID: string;
} & (
  | { href: Href; onPress?: never }
  | { onPress: () => void; href?: never }
);

/**
 * The one-line way out at the bottom of an auth screen: a question and the
 * link that answers it.
 *
 * Four of these sit in `FormScreen` footers (sign in, sign up, forgot, and the
 * confirm-code step), and all four were the same eleven lines of JSX over the
 * same two style keys. The wrapping is the reason they are worth sharing: at
 * accessibility text sizes "First time here?" and its link no longer fit side
 * by side, and a row that does not wrap runs off the side of the screen
 * (PLA-69). One copy, so that holds on all four rather than on whichever was
 * fixed last.
 *
 * Either `href` or `onPress`, never both: three of the four navigate, and the
 * confirm-code step steps backwards inside its own screen.
 */
export function FooterPrompt({ prompt, action, href, onPress, testID }: Props) {
  const link = (
    <Pressable
      accessibilityRole="button"
      hitSlop={LINK_HIT_SLOP}
      onPress={onPress}
      testID={testID}
    >
      <ThemedText variant="sub" color={colors.accentText} style={styles.action}>
        {action}
      </ThemedText>
    </Pressable>
  );

  return (
    <View style={styles.row} testID={`${testID}-row`}>
      <ThemedText variant="sub">{prompt}</ThemedText>
      {href ? (
        <Link href={href} asChild>
          {link}
        </Link>
      ) : (
        link
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  action: {
    fontFamily: fonts.bodyBold,
  },
});
