import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useSwipeHint } from '../useSwipeHint';
import { markSwipeHintSeen, shouldPeekSwipeHint } from '../swipeHint';

jest.mock('../swipeHint', () => ({
  shouldPeekSwipeHint: jest.fn(),
  markSwipeHintSeen: jest.fn(),
}));

const shouldPeek = shouldPeekSwipeHint as jest.Mock;
const markSeen = markSwipeHintSeen as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  shouldPeek.mockResolvedValue(true);
  markSeen.mockResolvedValue(undefined);
});

/**
 * `renderHook` here is async and flushes microtasks, so a mock that resolves
 * immediately has already answered by the first assertion. Holding the promise
 * open is the only way to see the state the row actually mounts in.
 */
function deferAnswer() {
  let answer: (show: boolean) => void = () => {};
  shouldPeek.mockReturnValue(
    new Promise<boolean>((resolve) => {
      answer = resolve;
    })
  );
  return (show: boolean) => answer(show);
}

it('starts false, so nothing animates before the answer is in', async () => {
  const answer = deferAnswer();
  const { result } = await renderHook(() => useSwipeHint(true));

  expect(result.current).toBe(false);

  await act(async () => answer(true));
  expect(result.current).toBe(true);
});

it('spends the one shot the moment it decides to show the hint', async () => {
  const { result } = await renderHook(() => useSwipeHint(true));

  await waitFor(() => expect(result.current).toBe(true));
  expect(markSeen).toHaveBeenCalledTimes(1);
});

it('stays false for somebody who has already seen it', async () => {
  shouldPeek.mockResolvedValue(false);
  const { result } = await renderHook(() => useSwipeHint(true));

  await waitFor(() => expect(shouldPeek).toHaveBeenCalled());
  expect(result.current).toBe(false);
  expect(markSeen).not.toHaveBeenCalled();
});

// A list with nobody in it has no row to nudge, so asking would burn the hint
// on an animation that could never play.
it('does not even ask while disabled', async () => {
  const { result } = await renderHook(() => useSwipeHint(false));

  expect(shouldPeek).not.toHaveBeenCalled();
  expect(result.current).toBe(false);
});

it('asks as soon as the people arrive', async () => {
  const { result, rerender } = await renderHook((enabled: boolean) => useSwipeHint(enabled), {
    initialProps: false,
  });

  expect(shouldPeek).not.toHaveBeenCalled();

  await rerender(true);
  await waitFor(() => expect(result.current).toBe(true));
});

// They never saw it, so it is still owed to them.
it('leaves the hint unspent when the screen closes before the answer lands', async () => {
  const answer = deferAnswer();

  const { unmount } = await renderHook(() => useSwipeHint(true));
  await unmount();
  await act(async () => answer(true));

  expect(shouldPeek).toHaveBeenCalled();
  expect(markSeen).not.toHaveBeenCalled();
});
