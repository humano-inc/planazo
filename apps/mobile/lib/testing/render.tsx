import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import { cloneElement, type ReactElement } from 'react';

/**
 * `render()` inside a fresh QueryClientProvider, which 25 test files each stood
 * up by hand (PLA-107).
 *
 * `retry: false` is the load-bearing part. A query left on the default three
 * retries with backoff does not fail during the test, it fails after it, and
 * what the suite shows is a passing assertion followed by an unhandled
 * rejection in whichever file ran next. `gcTime: 0` keeps one test's cache out
 * of the next one's screen.
 *
 * Awaiting the render is not optional here: RNTL in this repo returns a
 * promise from `render`, `fireEvent` and `renderHook` alike, and a missing
 * await surfaces as a state update outside `act`.
 */
export async function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

  /**
   * A fresh element each call, cloned rather than reused. React bails out of
   * re-rendering an identical element *reference*, so passing `ui` straight
   * through would make `rerenderSameInstance` a silent no-op: the screen would
   * keep its old params and the test would pass while the real thing stayed
   * stale. Cloning costs nothing and keeps the caller's API a plain element.
   */
  const tree = () => <QueryClientProvider client={client}>{cloneElement(ui)}</QueryClientProvider>;

  const utils = await render(tree());

  return {
    ...utils,
    client,
    /**
     * Re-render the *same* mounted instance, which is how new params reach a
     * screen the user never left. Remounting would pass while the real thing
     * stayed stale.
     */
    rerenderSameInstance: () => utils.rerender(tree()),
  };
}
