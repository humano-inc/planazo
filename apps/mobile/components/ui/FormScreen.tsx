import { useContext, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, SafeAreaInsetsContext, type Edge } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { FooterBar } from './FooterBar';
import { colors, spacing } from '../../theme/tokens';

/**
 * How much room to leave between a focused field and whatever sits under it.
 *
 * `KeyboardAwareScrollView` scrolls a focused input to just above the keyboard.
 * "Just above the keyboard" is the wrong place when a sticky footer is parked
 * there, so the bar's measured height is added to the clearance. Measured, not
 * guessed: the bar is one or two stacked actions and grows with text size, which
 * is exactly the sort of number `paddingBottom: 140` used to stand in for.
 */
export function focusClearance(footerHeight: number): number {
  return footerHeight + spacing.md;
}

type Props = {
  /**
   * Safe-area edges for the screen frame. `bottom` is excluded by the type
   * rather than by a comment: whatever sits at the bottom also has to clear the
   * keyboard, so the footer (or the content, when there is no footer) owns that
   * padding, and two owners is how you get 34pt of dead space above a keyboard.
   */
  edges?: readonly Exclude<Edge, 'bottom'>[];
  /** Fixed above the scroll. Nav rows and header actions live here. */
  header?: ReactNode;
  /**
   * Actions, wrapped in a `FooterBar` that stays on screen and rides up with
   * the keyboard. Omit it for screens whose action sits in the `header`.
   */
  footer?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Restores a scroll position, for deep-link QA (`?y=`). */
  contentOffset?: { x: number; y: number };
  testID?: string;
  children: ReactNode;
};

/**
 * The frame every form screen in the app shares: safe area, a fixed header, a
 * scroll that knows where the keyboard is, and actions that stay reachable
 * while it is open.
 *
 * Twelve screens used to hand-roll `SafeAreaView > KeyboardAvoidingView >
 * ScrollView` and tune padding by eye until it looked right on the reviewer's
 * phone. `behavior="padding"` shrinks the viewport and leaves everything else to
 * arithmetic, so whether the submit button survived a raised keyboard was a
 * question of whether the constants happened to add up on that device. On one
 * screen they did not, and a first-time user who could not find "Make your
 * account" signed in instead of signing up (PLA-69, PLA-74).
 *
 * The two things that replace the arithmetic:
 *
 * - `KeyboardAwareScrollView` insets the scroll by the real keyboard height and
 *   scrolls the focused field into view, so content below the fold is reachable
 *   rather than merely present.
 * - `KeyboardStickyView` lifts the footer to sit on top of the keyboard, so the
 *   primary action never goes behind it. On `group/new` that action's label is a
 *   live readout of the form ("Name it first" → "Create and invite 3"), which is
 *   worth nothing if the keyboard answering it covers it up.
 */
export function FormScreen({
  edges = ['top'],
  header,
  footer,
  contentContainerStyle,
  contentOffset,
  testID,
  children,
}: Props) {
  // The context rather than the hook, for the same reason FooterBar uses it: a
  // form that cannot render without a SafeAreaProvider is a worse primitive.
  const insets = useContext(SafeAreaInsetsContext);
  const [footerHeight, setFooterHeight] = useState(0);
  const measureFooter = (event: LayoutChangeEvent) =>
    setFooterHeight(event.nativeEvent.layout.height);

  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {header}

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          // With a footer the bar itself clears the indicator. Without one the
          // content is the last thing on screen, so it does.
          !footer && { paddingBottom: Math.max(insets?.bottom ?? 0, spacing.lg) },
          contentContainerStyle,
        ]}
        contentOffset={contentOffset}
        // Two different jobs, and a short form needs both. `bottomOffset` says
        // where to put the focused field: above the keyboard *and* above the
        // footer parked on top of it. `extraKeyboardSpace` is what makes that
        // reachable — while the keyboard is up the footer covers the bottom of
        // the scroll, and a form shorter than the screen has no slack to scroll
        // out from under it. Without this, `plan/[id]/cancel` autofocused an
        // input that sat half-hidden behind its own "Call it off" button.
        bottomOffset={focusClearance(footerHeight)}
        extraKeyboardSpace={footerHeight}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        testID={testID ? `${testID}-scroll` : undefined}
      >
        {children}
      </KeyboardAwareScrollView>

      {footer ? (
        // `opened` pulls the bar back down by the home-indicator inset. The bar
        // pads itself by that inset to clear the indicator, but a raised
        // keyboard covers the indicator too, so without this the bar floats a
        // notch above the keyboard with a strip of background showing through.
        // Opaque, because `FooterBar` is not: its background is 94% alpha, which
        // reads as depth when the bar sits in flow and as a bug once it rides up
        // over the scroll. Without this, login showed "Forgot your password?"
        // ghosting through behind "Sign up".
        <KeyboardStickyView
          style={styles.sticky}
          offset={{ closed: 0, opened: insets?.bottom ?? 0 }}
          testID={testID ? `${testID}-sticky` : undefined}
        >
          <FooterBar
            insetBottom
            onLayout={measureFooter}
            testID={testID ? `${testID}-footer` : undefined}
          >
            {footer}
          </FooterBar>
        </KeyboardStickyView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
  },
  sticky: {
    backgroundColor: colors.background,
  },
});
