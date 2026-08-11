import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import { LINK_HIT_SLOP, useAnnounce } from '../../lib/a11y';
import { useDismissTo } from '../../lib/navigation';
import {
  Button,
  BackButton,
  ConfirmCard,
  FooterPrompt,
  FormField,
  FormScreen,
  ThemedText,
} from '../../components/ui';
import { colors, spacing } from '../../theme/tokens';

/**
 * Where the recovery email lands the user back in the app. Supabase only
 * redirects here if the URL is on the project's allow-list — see
 * `supabase/config.toml` locally, and Auth → URL Configuration in the
 * hosted dashboard.
 *
 * No leading slash, and it matters. createURL builds `<scheme>://<hostUri><path>`
 * with an empty hostUri in a standalone build, so '/reset-password' comes out
 * as `planazo:///reset-password` — three slashes, and not the string anyone
 * put on the allow-list.
 */
export const RESET_REDIRECT_PATH = 'reset-password';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  // Login is behind this on the normal path, and is where the recovery email's
  // own link sends people, so it is the right place to land either way.
  const goBack = useDismissTo('/(auth)/login');
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useAnnounce(error);

  async function sendLink(address: string) {
    const clean = address.trim().toLowerCase();
    if (!clean) {
      setError('Put in your email and we’ll send the link.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(clean, {
        redirectTo: Linking.createURL(RESET_REDIRECT_PATH),
      });

      // Supabase deliberately succeeds for addresses with no account, so this
      // screen never tells a stranger which emails are registered.
      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSentTo(clean);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "That didn't go through. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.sentBody}>
          <ConfirmCard title="The link is out" testID="link-sent">
            It&apos;s on its way to <ThemedText variant="bodyStrong">{sentTo}</ThemedText>. If it
            hasn&apos;t landed in a minute, check spam.
          </ConfirmCard>

          <View style={styles.sentActions}>
            <Button
              label="Back to sign in"
              variant="outline"
              onPress={() => router.replace('/(auth)/login')}
              testID="back-to-login"
            />
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              hitSlop={LINK_HIT_SLOP}
              onPress={() => sendLink(sentTo)}
              style={styles.resend}
              testID="resend"
            >
              <ThemedText variant="caption" color={loading ? colors.textFaint : colors.accentText}>
                {loading ? 'Sending…' : 'Send it again'}
              </ThemedText>
            </Pressable>
          </View>

          {error ? (
            <View
              style={styles.errorBox}
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              testID="forgot-error"
            >
              <ThemedText variant="bodyStrong" color={colors.accentText}>
                {error}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const backRow = (
    <View style={styles.backRow}>
      <BackButton
        label="Back"
        color={colors.textSecondary}
        onPress={goBack}
        testID="back"
      />
    </View>
  );

  return (
    <FormScreen
      header={backRow}
      contentContainerStyle={styles.body}
      testID="forgot"
      footer={
        <>
          <Button
            label={loading ? 'Sending…' : 'Send me the link'}
            disabled={loading}
            onPress={() => sendLink(email)}
            testID="send-link"
          />

          <FooterPrompt
            prompt="Remembered it?"
            action="Sign in"
            href="/(auth)/login"
            testID="login-link"
          />
        </>
      }
    >
      <ThemedText variant="screenTitle" style={styles.title}>
        We&apos;ll send you a link
      </ThemedText>
      <ThemedText variant="body" color={colors.textSecondary} style={styles.blurb}>
        Put in the email you sign in with and we&apos;ll send a link to pick a new password.
      </ThemedText>

      <View style={styles.field}>
        <FormField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          autoFocus
          testID="email-input"
        />
      </View>

      {error ? (
        <View
          style={styles.errorBox}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          testID="forgot-error"
        >
          <ThemedText variant="bodyStrong" color={colors.accentText}>
            {error}
          </ThemedText>
        </View>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
  },
  body: {
    // flexGrow, not flex. `flex: 1` clamps this to the ScrollView's height, so
    // at large text sizes the content overflowed instead of making the view
    // scrollable — the sign-in button ended up below the fold, unreachable.
    flexGrow: 1,
    paddingTop: 28,
  },
  title: {
    maxWidth: 300,
  },
  blurb: {
    marginTop: 10,
    maxWidth: 305,
  },
  field: {
    marginTop: 30,
  },
  errorBox: {
    marginTop: spacing.xl,
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sentBody: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: 70,
  },
  sentActions: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  resend: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
});
