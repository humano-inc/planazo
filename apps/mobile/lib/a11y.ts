import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Touch-target padding for a text link.
 *
 * The app uses one 48×48 floor on both platforms. That clears Android's 48dp
 * requirement and gives iOS four points beyond its 44pt minimum, which is a
 * better fit for a thumb-first planning app than two subtly different control
 * systems. A caption is about 35×17 and a `sub` link about 90×20, so the
 * widths are usually fine once you account for the word but the heights are
 * not. hitSlop grows the touchable area without moving layout and stays the
 * fallback for genuine inline links and overlay controls.
 */
export const LINK_HIT_SLOP = { top: 16, bottom: 16, left: 12, right: 12 } as const;

/**
 * Planazo's adaptive minimum touch target, in density-independent points.
 *
 * Use it as `minHeight`/`minWidth` in a StyleSheet. Prefer making a control
 * genuinely this big over slopping around a small one. Visible padding makes
 * the area a person sees agree with the area they can hit.
 *
 * `hitSlopTo` is the fallback for the cases where there is nothing to reclaim
 * and growing the box would cover something else.
 */
export const MIN_TOUCH_TARGET = 48;

/**
 * Slop that lifts a control of `size` points up to {@link MIN_TOUCH_TARGET} on
 * one axis — half the shortfall on each side, so the target stays centred on
 * the thing you can see. Already-big controls get 0 rather than a negative.
 *
 * Beware of neighbours: slop is invisible and unlike a real box it happily
 * overlaps the control next to it, and the one that wins a tap in the overlap
 * is not something you can see or reason about from the layout.
 */
export function hitSlopTo(size: number): number {
  return Math.max(0, Math.ceil((MIN_TOUCH_TARGET - size) / 2));
}

/**
 * Speak a message the moment it appears.
 *
 * The auth screens replaced native `Alert`s with inline error boxes, which
 * look better and say nothing: VoiceOver does not announce a View that
 * quietly appears mid-screen, so a blind user tapped "Sign in" and got
 * silence. `accessibilityRole="alert"` alone is unreliable on iOS for
 * already-mounted trees, so announce it explicitly as well.
 */
export function useAnnounce(message: string | null | undefined): void {
  useEffect(() => {
    if (message) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message]);
}
