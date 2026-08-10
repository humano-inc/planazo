import { useRouter, type Href } from 'expo-router';

/**
 * Leaving a modal or sheet, including one a deep link opened directly. The one
 * place that knows how: everything else in this file is built on it.
 *
 * `planazo://plan/create` and its like mount their screen with nothing behind
 * it, and `router.back()` there is a no-op: it logs "GO_BACK was not handled
 * by any navigator" and leaves the user sitting on a screen with no way out.
 * Replacing the route is the exit that works either way.
 *
 * Returns whether a screen was actually popped, because that is the only case
 * where anything meant to happen *after* the dismissal has to wait for the
 * animation. A replace has already arrived.
 *
 * `layers` is for a screen that was opened on top of another sheet and has to
 * take both with it. The fallback branch ignores it on purpose: with nothing
 * behind you there are no layers to count, and the replace lands in the same
 * place whether one sheet was skipped or two.
 */
function useDismiss() {
  const router = useRouter();

  return (target: Href, layers = 1) => {
    if (!router.canGoBack()) {
      router.replace(target);
      return false;
    }
    // `back()` rather than `dismiss(1)` for the ordinary case: it is what every
    // call site did before this hook existed, and the two are not synonyms on a
    // pushed screen inside a nested stack.
    if (layers > 1) router.dismiss(layers);
    else router.back();
    return true;
  };
}

/** Dismissing to a destination known when the screen renders, e.g. Cancel. */
export function useDismissTo(fallback: Href, layers = 1) {
  const dismiss = useDismiss();

  return () => dismiss(fallback, layers);
}

/**
 * How long a dismissal takes to get off the screen. Anything that has to land
 * *after* the sheet is gone waits this out, and nothing else should invent its
 * own number.
 */
export const DISMISS_MS = 100;

/**
 * Leaving a modal or sheet **for somewhere specific** — what a create sheet
 * wants once it has made the thing it was opened to make.
 *
 * The destination arrives at call time rather than at the hook, because the
 * row it points at does not exist until the insert comes back.
 *
 * Two paths, and the difference is the whole point:
 *
 * - A popped screen leaves a dismissal animation, so the arrival is deferred
 *   past it. Arriving immediately lands the new screen behind the sheet.
 * - A replace has already arrived. There is nothing to wait for, and no timer
 *   to schedule — which also means a cold deep link, where `back()` is a no-op,
 *   no longer strands the user under a sheet that never left while a stray
 *   push fires behind it.
 *
 * `arrive` is how the destination is entered: `push` for a row that did not
 * exist a moment ago, `navigate` for a tab, which must not be stacked twice.
 */
export function useLeaveFor(arrive: 'push' | 'navigate' = 'push') {
  const router = useRouter();
  const dismiss = useDismiss();

  return (href: Href) => {
    if (dismiss(href)) setTimeout(() => router[arrive](href), DISMISS_MS);
  };
}
