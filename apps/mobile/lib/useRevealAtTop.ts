import { useCallback, useRef, type ComponentRef } from 'react';
import type { View } from 'react-native';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';

/** Enough to show the top edge of the field under the header. */
const GAP_ABOVE = 12;

interface Measurable {
  measureInWindow: (callback: (x: number, y: number) => void) => void;
}

/**
 * Scroll a form so a field sits at the top, leaving room for what opens under it.
 *
 * `KeyboardAwareScrollView` only promises that the focused field clears the
 * keyboard, which leaves it right on top of the footer with no room below. That
 * is fine for a field and useless for one with a list under it: the list opens
 * behind the footer and the keyboard, where nobody can see it.
 *
 * The screen renders `anchorRef` on a zero-size view at the top of its content.
 * The distance from there to the field is the scroll offset that puts the field
 * at the top, however far the form has already scrolled.
 */
export function useRevealAtTop() {
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const anchorRef = useRef<ComponentRef<typeof View>>(null);

  const reveal = useCallback((field: Measurable | null) => {
    const anchor = anchorRef.current;
    if (!field || !anchor) return;
    field.measureInWindow((_fieldX, fieldY) => {
      anchor.measureInWindow((_anchorX, anchorY) => {
        scrollRef.current?.scrollTo({ y: fieldY - anchorY - GAP_ABOVE, animated: true });
      });
    });
  }, []);

  return { scrollRef, anchorRef, reveal };
}
