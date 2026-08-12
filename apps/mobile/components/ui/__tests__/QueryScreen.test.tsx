import { render, screen, fireEvent } from '@testing-library/react-native';
import { QueryScreen } from '../QueryScreen';

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

  it('reports a real failure with the generic copy and a retry', async () => {
    const onRetry = jest.fn();
    await show({ failed: true, error: new Error('boom'), onRetry });

    expect(screen.getByText("That didn't load")).toBeTruthy();
    await fireEvent.press(screen.getByTestId('group-error-retry'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('classifies the failure rather than showing its message', async () => {
    await show({ failed: true, error: { code: '42501', message: 'permission denied for table groups' } });

    expect(screen.getByText("You can't see this")).toBeTruthy();
    expect(screen.queryByText('permission denied for table groups')).toBeNull();
  });

  it('always leaves a way out', async () => {
    const onBack = jest.fn();
    await show({ failed: true, error: notFound, onBack });

    await fireEvent.press(screen.getByTestId('group-error-back'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
