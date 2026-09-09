/**
 * The supabase query-builder fake, which seven test files each carried their
 * own byte-similar copy of (PLA-107).
 *
 * Every copy stubbed a different subset of builder methods, which is the bug
 * this prevents: a screen that grows a `.neq()` fails in whichever test file
 * happened to omit it, with `undefined is not a function` pointing at the test
 * rather than at the query. The list here is the union of all seven, so adding
 * a filter to a screen does not send anyone reading a stack trace into their
 * own mock.
 *
 * `then` is what makes the object awaitable without being a real promise: the
 * builder has to keep returning itself for chaining right up until something
 * awaits it.
 */
const BUILDER_METHODS = [
  'select',
  'eq',
  'neq',
  'in',
  'gte',
  'or',
  'order',
  'limit',
  'single',
  'maybeSingle',
  'insert',
  'update',
  'upsert',
  'delete',
] as const;

/**
 * A result, or a function returning one.
 *
 * The thunk is not sugar. `group/[id]/__tests__/index.test.tsx` installs its
 * mock once in `beforeEach` and then assigns the row each test wants, so an
 * eagerly captured value would hand every test the first one. Six of the seven
 * copies passed a value and the seventh passed a thunk; supporting both is
 * what let all seven adopt this without a call site changing meaning.
 */
export type ChainResult = unknown | (() => unknown);

/**
 * The exact keys rather than an index signature: `noUncheckedIndexedAccess` is
 * on, so an indexed type would hand every caller a `| undefined` to narrow
 * before it could assert on `chain.select`.
 */
export type ChainMock = Record<(typeof BUILDER_METHODS)[number], jest.Mock> & {
  then: (resolve: (value: unknown) => void) => Promise<void>;
};

export function chain(result: ChainResult): ChainMock {
  const c = {} as Record<string, unknown>;
  BUILDER_METHODS.forEach((m) => {
    c[m] = jest.fn(() => c);
  });
  c.then = (resolve: (value: unknown) => void) =>
    Promise.resolve(typeof result === 'function' ? (result as () => unknown)() : result).then(
      resolve
    );
  return c as ChainMock;
}
