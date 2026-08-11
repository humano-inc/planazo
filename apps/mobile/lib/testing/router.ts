/**
 * The `jest.mock('expo-router', …)` factory, which 32 test files each spelled
 * out with a slightly different set of router methods (PLA-107).
 *
 * The differing sets are the bug this prevents. A screen that starts calling
 * `router.navigate()` throws `navigate is not a function` in every file whose
 * mock only listed push/back/replace, and the failure names the test rather
 * than the screen. Every method the app can reach for is stubbed here, so a
 * new call site fails where it is written or not at all.
 *
 * Pass only what the test needs to assert on. Anything left out gets a fresh
 * `jest.fn()` that works and is simply never inspected, which is what the old
 * inline `navigate: jest.fn()` fillers were doing by hand.
 *
 * Used from inside a `jest.mock` factory, which is hoisted, so it has to be
 * reached through `require` rather than a top-level import:
 *
 *     jest.mock('expo-router', () =>
 *       require('../../lib/testing/router').expoRouterMock(
 *         () => ({ push: mockPush, canGoBack: () => mockCanGoBack }),
 *         () => ({ id: mockParamId })
 *       )
 *     );
 *
 * Both arguments are functions, and that is not a style choice. The factory
 * runs when expo-router is first required, which is while the test module's
 * own `const mockPush = jest.fn()` is still in the temporal dead zone. Taking
 * the overrides as a plain object reads `mockPush` there and captures
 * `undefined`, and the screen then dies on `router.push is not a function`
 * with a stack pointing at the component. Deferring the read to `useRouter()`
 * is what the hand-written mocks were doing by declaring the methods inside
 * the arrow, and this keeps that.
 *
 * The `mock` prefix on those variables is what lets the factory close over
 * them: jest rejects any other name as out-of-scope.
 */
/**
 * @knipignore Reached only through the `require()` inside a `jest.mock`
 * factory, which knip cannot follow: a hoisted factory body is not an import
 * edge in the graph. Both this and `expoRouterMock` are live in seven suites.
 */
export interface RouterMock {
  push: jest.Mock;
  back: jest.Mock;
  replace: jest.Mock;
  navigate: jest.Mock;
  dismiss: jest.Mock;
  dismissAll: jest.Mock;
  setParams: jest.Mock;
  canGoBack: () => boolean;
}

/** @knipignore Same reason as `RouterMock` above: required, never imported. */
export function expoRouterMock(
  router: () => Partial<RouterMock> = () => ({}),
  params: () => Record<string, unknown> = () => ({})
) {
  // Built per call, so the overrides are read after the test module has
  // finished initialising. See the note above.
  const stub = (): RouterMock => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
    setParams: jest.fn(),
    canGoBack: () => true,
    ...router(),
  });

  return {
    useRouter: stub,
    useLocalSearchParams: () => params(),
    useSegments: () => [],
    usePathname: () => '/',
    // Screens that render <Link> rather than calling the router still have to
    // resolve something, and the label is what a test would query by.
    Link: ({ children }: { children?: unknown }) => children,
  };
}
