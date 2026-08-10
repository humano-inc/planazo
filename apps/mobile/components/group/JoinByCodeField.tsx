import { useState } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { inviteCodeFrom } from '../../lib/inviteCode';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { ThemedText } from '../ui';
import { colors, fonts, radii, spacing } from '../../theme/tokens';

/**
 * The way in for an invite that never became a tappable link (PLA-80).
 *
 * Every case it serves is a link that did not fire: Android before app links,
 * an install that broke the chain between the store and the app, a link read on
 * a laptop, a code read out on a pitch. It takes either shape, since
 * `inviteCodeFrom` finds the code inside a whole pasted link, but it only ever
 * says "link": a code is not a second thing to learn, it is the tail of the
 * same URL.
 *
 * It joins nobody. Pasting lands on `(app)/join/[code]`, the same screen a
 * tapped link opens, which shows the group's name before anyone is added to it
 * (PLA-49). Joining from here instead was the older shape, and it meant the two
 * ways in disagreed about whether you get to see what you are walking into.
 */
export function JoinByCodeField({ style }: { style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const [text, setText] = useState('');

  const code = inviteCodeFrom(text);

  // Cleared on the way out, so coming back from the join screen offers an empty
  // field rather than the code that is now spent.
  const openInvite = () => {
    if (!code) return;
    setText('');
    router.push(`/(app)/join/${code}`);
  };

  return (
    <View style={[styles.row, style]}>
      <TextInput
        style={styles.input}
        placeholder="Paste an invite link"
        placeholderTextColor={colors.textFaint}
        value={text}
        onChangeText={setText}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={openInvite}
        returnKeyType="go"
        testID="join-input"
      />
      <Pressable
        accessibilityRole="button"
        disabled={!code}
        onPress={openInvite}
        style={[styles.button, code ? styles.buttonReady : null]}
        testID="join-button"
      >
        <ThemedText
          variant="bodyStrong"
          color={code ? colors.textOnAccent : colors.textFaint}
          style={styles.buttonLabel}
        >
          Join
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 20,
    // Half of what the Join button grew by comes back here, so the field
    // stays about the height it was (PLA-40).
    paddingVertical: spacing.xs,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  button: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: 14,
    // Was 34 (8 + 18 + 8) — the only way to act on a code you just typed.
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
  },
  buttonReady: {
    backgroundColor: colors.accent,
  },
  buttonLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
});
