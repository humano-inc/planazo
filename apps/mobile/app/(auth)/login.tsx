import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { LINK_HIT_SLOP, useAnnounce } from '../../lib/a11y';
import { useAuthStore } from '../../stores/authStore';
import {
  BrandMark,
  Button,
  FooterPrompt,
  FormField,
  FormScreen,
  ThemedText,
} from '../../components/ui';
import { colors, spacing } from '../../theme/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const { setSession, setProfile } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useAnnounce(error);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Put in your email and password to carry on.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        // Someone who quit signup before entering their code lands here, and
        // used to get Supabase's raw "Email not confirmed" with nothing to do
        // about it. Their account exists and we know the address, so send them
        // to the code step instead, which sends them a fresh one on arrival.
        if (signInError.code === 'email_not_confirmed') {
          router.replace({
            pathname: '/(auth)/signup',
            params: { verify: email.trim().toLowerCase() },
          });
          return;
        }
        setError(signInError.message);
        return;
      }

      setSession(data.session);

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .single();

      if (profile) {
        setProfile(profile);
      }

      // Index, not the tabs: it owns the first-run gate (PLA-75).
      router.replace('/');
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

  return (
    <FormScreen
      contentContainerStyle={styles.body}
      testID="login"
      footer={
        <>
          <Button
            label={loading ? 'Signing in…' : 'Sign in'}
            onPress={handleLogin}
            disabled={loading}
            testID="sign-in"
          />

          <FooterPrompt
            prompt="First time here?"
            action="Sign up"
            href="/(auth)/signup"
            testID="signup-link"
          />
        </>
      }
    >
      <BrandMark size={52} />

      <ThemedText variant="screenTitle" style={styles.title}>
        Welcome back
      </ThemedText>

      <View style={styles.fields}>
        <FormField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          testID="email-input"
        />

        <FormField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          autoCapitalize="none"
          autoComplete="password"
          secure
          testID="password-input"
        />

        <View style={styles.forgotRow}>
          <Link href="/(auth)/forgot" asChild>
            <Pressable accessibilityRole="button" hitSlop={LINK_HIT_SLOP} testID="forgot-link">
              <ThemedText variant="caption" color={colors.accentText}>
                Forgot your password?
              </ThemedText>
            </Pressable>
          </Link>
        </View>
      </View>

      {error ? (
        <View
          style={styles.errorBox}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          testID="login-error"
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
  body: {
    // flexGrow, not flex. `flex: 1` clamps this to the ScrollView's height, so
    // at large text sizes the content overflowed instead of making the view
    // scrollable, and the bottom of the form became unreachable.
    flexGrow: 1,
    // These three were 22 / 18 / xxl, deliberately undersized to keep "Forgot
    // your password?" clear of the footer with a keyboard up. FormScreen
    // measures the footer and scrolls the focused field above it, so the
    // spacing no longer has to double as arithmetic and goes back to tokens
    // (PLA-74).
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  title: {
    marginTop: spacing.xl,
  },
  fields: {
    gap: 18,
    marginTop: spacing.xxxl,
  },
  forgotRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  errorBox: {
    marginTop: spacing.xl,
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
