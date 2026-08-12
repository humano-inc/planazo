import { render, screen, fireEvent } from '@testing-library/react-native';
import { QueryScreen } from '../QueryScreen';
import { errorCopy } from '../../../lib/queryErrors';

const goneCopy = { title: "This group isn't here", body: 'It was deleted, or you were removed.' };

/** PostgREST's zero-row shape, which is what a deleted or RLS-hidden row is. */
const notFound = { code: 'PGRST116', details: 'The result contains 0 rows' };

const show = (props: Partial<Parameters<typeof QueryScreen>[0]> = {}) =>
  render(
    <QueryScreen
      isLoading={false}
      failed={false}
      id="g1"
      error={null}
      goneCopy={goneCopy}
      onRetry={jest.fn()}
      onBack={jest.fn()}
      testID="group-error"
      {...props}
    />
  );

describe('QueryScreen', () => {
  it('spins while the query is in flight', async () => {
    await show({ isLoading: true });

    expect(screen.getByTestId('group-error-loading')).toBeTruthy();
    expect(screen.queryByTestId('group-error')).toBeNull();
  });

  /**
   * The refetch behind a retry starts by loading, so an error that stayed on
   * screen would flash its own failure at someone who just asked again.
   */
  it('spins over a stale failure once the query is loading again', async () => {
    await show({ isLoading: true, failed: true, error: notFound });

    expect(screen.getByTestId('group-error-loading')).toBeTruthy();
    expect(screen.queryByText("This group isn't here")).toBeNull();
  });

  /**
   * Plan detail passes `failed={!!session && …}` so a signed-out deep link
   * sees the spinner while the redirect to login lands, not "isn't here".
   */
  it('spins when the screen settled but says it has not failed', async () => {
    await show({ isLoading: false, failed: false });

    expect(screen.getByTestId('group-error-loading')).toBeTruthy();
  });

  it('names the missing row and offers no retry', async () => {
    await show({ failed: true, error: notFound });

    expect(screen.getByText("This group isn't here")).toBeTruthy();
    expect(screen.getByText('It was deleted, or you were removed.')).toBeTruthy();
    expect(screen.queryByTestId('group-error-retry')).toBeNull();
  });

  it('treats a missing route param as a missing row', async () => {
    await show({ failed: true, id: undefined, error: null });

    expect(screen.getByText("This group isn't here")).toBeTruthy();
    expect(screen.queryByTestId('group-error-retry')).toBeNull();
  });

  it('reports a real failure through errorCopy, with a retry', async () => {
    const onRetry = jest.fn();
    const boom = new Error('boom');
    await show({ failed: true, error: boom, onRetry });

    // The assertion is the choice of copy, not its wording: the strings
    // themselves are pinned in lib/__tests__/queryErrors.test.ts.
    expect(screen.getByText(errorCopy(boom).title)).toBeTruthy();
    expect(screen.queryByText(goneCopy.title)).toBeNull();

    await fireEvent.press(screen.getByTestId('group-error-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('never shows the raw message of a failure it classified', async () => {
    await show({
      failed: true,
      error: { code: '42501', message: 'permission denied for table groups' },
    });

    expect(screen.getByText(errorCopy({ code: '42501' }).title)).toBeTruthy();
    expect(screen.queryByText('permission denied for table groups')).toBeNull();
  });

  /**
   * Pins PLA-129 rather than fixing it: `retryQuery` counts a forbidden error
   * as permanent, so this button re-runs a query configured never to retry it.
   * Carried across from the four screens verbatim, because a class C
   * extraction does not change behaviour. Flip this when PLA-129 lands.
   */
  it('still offers a retry on a forbidden error (PLA-129)', async () => {
    await show({ failed: true, error: { code: '42501' } });

    expect(screen.getByTestId('group-error-retry')).toBeTruthy();
  });

  it('always leaves a way out', async () => {
    const onBack = jest.fn();
    await show({ failed: true, error: notFound, onBack });

    await fireEvent.press(screen.getByTestId('group-error-back'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
