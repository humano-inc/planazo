import { useEffect, useState } from 'react';
import { markSwipeHintSeen, shouldPeekSwipeHint } from './swipeHint';

/**
 * Should this mount demonstrate the swipe?
 *
 * Answers false, then flips to true once at most, ever. Asking is what spends
 * the one shot, so `enabled` exists to stop a list with nobody in it burning
 * it: there would be no row to nudge.
 *
 * Unmounting before the read lands leaves the hint unspent. They never saw it,
 * so it is still owed to them.
 */
export function useSwipeHint(enabled: boolean): boolean {
  const [peek, setPeek] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    void shouldPeekSwipeHint().then((show) => {
      if (!mounted || !show) return;
      void markSwipeHintSeen();
      setPeek(true);
    });

    return () => {
      mounted = false;
    };
  }, [enabled]);

  return peek;
}
