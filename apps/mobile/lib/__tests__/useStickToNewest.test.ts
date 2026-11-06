import { act, renderHook } from '@testing-library/react-native';
import { Keyboard, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import { isAtEnd, useStickToNewest } from '../useStickToNewest';

const metrics = (y: number, inset = 0) => ({
  contentOffset: { x: 0, y },
  contentSize: { width: 390, height: 1000 },
  layoutMeasurement: { width: 390, height: 600 },
  contentInset: { top: 0, left: 0, right: 0, bottom: inset },
});

const scrollEvent = (y: number) =>
  ({ nativeEvent: metrics(y) }) as unknown as NativeSyntheticEvent<NativeScrollEvent>;

describe('isAtEnd', () => {
  it('is true at the very end, and just short of it', () => {
    expect(isAtEnd(metrics(400))).toBe(true);
    expect(isAtEnd(metrics(370))).toBe(true);
  });

  it('is false once the reader has scrolled up past a line', () => {
    expect(isAtEnd(metrics(300))).toBe(false);
  });

  it('is true for content shorter than the screen, which has nowhere to scroll', () => {
    expect(
      isAtEnd({
        contentOffset: { x: 0, y: 0 },
        contentSize: { width: 390, height: 200 },
        layoutMeasurement: { width: 390, height: 600 },
      }),
    ).toBe(true);
  });

  it('moves the end down by the room the keyboard takes', () => {
    expect(isAtEnd(metrics(400, 300))).toBe(false);
    expect(isAtEnd(metrics(700, 300))).toBe(true);
  });

  it('copes with a platform that reports no inset', () => {
    const { contentInset: _ignored, ...withoutInset } = metrics(400);
    expect(isAtEnd(withoutInset)).toBe(true);
  });
});

describe('useStickToNewest', () => {
  const scrollToEnd = jest.fn();
  const keyboardListeners: Record<string, () => void> = {};
  const removeListener = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Keyboard, 'addListener').mockImplementation((event, listener) => {
      keyboardListeners[event] = listener as () => void;
      return { remove: removeListener } as unknown as ReturnType<typeof Keyboard.addListener>;
    });
  });

  async function setUp(ready = true) {
    const view = await renderHook(
      ({ isReady }: { isReady: boolean }) => useStickToNewest(isReady),
      { initialProps: { isReady: ready } },
    );
    (view.result.current.scrollRef as { current: unknown }).current = {
      scrollToEnd,
    } as unknown as KeyboardAwareScrollViewRef;
    return view;
  }

  type Hook = ReturnType<typeof useStickToNewest>;

  const contentGrows = (hook: Hook) => hook.scrollProps.onContentSizeChange();

  /** The reader takes the scroll and leaves it at `y`. */
  function readerScrollsTo(hook: Hook, y: number) {
    hook.scrollProps.onScrollBeginDrag();
    hook.scrollProps.onScroll(scrollEvent(y));
  }

  /** Opens the list, and clears the record of how it got there. */
  function open(hook: Hook) {
    contentGrows(hook);
    scrollToEnd.mockClear();
  }

  it('waits for the list before it does anything', async () => {
    const { result } = await setUp(false);
    contentGrows(result.current);
    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  it('opens at the end without animating, and animates after that', async () => {
    const { result } = await setUp();

    contentGrows(result.current);
    expect(scrollToEnd).toHaveBeenLastCalledWith({ animated: false });

    contentGrows(result.current);
    expect(scrollToEnd).toHaveBeenLastCalledWith({ animated: true });
  });

  it('opens at the end when the list arrives after the screen does', async () => {
    const { result, rerender } = await setUp(false);
    contentGrows(result.current);

    await rerender({ isReady: true });
    contentGrows(result.current);

    expect(scrollToEnd).toHaveBeenCalledTimes(1);
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
  });

  /**
   * The bug only a real device showed. Reopening with the list cached, the first
   * jump was right for a viewport that the safe area then shrank by 59pt, so the
   * newest row sat half under the composer until someone scrolled.
   */
  it('goes back to the end when the scroll itself changes size', async () => {
    const { result } = await setUp();
    open(result.current);

    result.current.scrollProps.onLayout();

    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
  });

  it('keeps the newest row in view as the composer grows', async () => {
    const { result } = await setUp();
    open(result.current);

    result.current.scrollProps.onLayout();
    result.current.scrollProps.onLayout();

    expect(scrollToEnd).toHaveBeenCalledTimes(2);
  });

  it('does not take the reader to the end when the scroll changes size', async () => {
    const { result } = await setUp();
    open(result.current);
    readerScrollsTo(result.current, 100);

    result.current.scrollProps.onLayout();

    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  it('ignores the positions its own scroll passes through', async () => {
    const { result } = await setUp();
    open(result.current);

    contentGrows(result.current);
    result.current.scrollProps.onScroll(scrollEvent(200));
    contentGrows(result.current);

    expect(scrollToEnd).toHaveBeenCalledTimes(2);
  });

  it('leaves someone reading older comments where they are when a new one lands', async () => {
    const { result } = await setUp();
    open(result.current);

    readerScrollsTo(result.current, 100);
    contentGrows(result.current);

    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  it('picks following back up when they return to the end', async () => {
    const { result } = await setUp();
    open(result.current);

    readerScrollsTo(result.current, 100);
    readerScrollsTo(result.current, 400);
    contentGrows(result.current);

    expect(scrollToEnd).toHaveBeenCalledTimes(1);
  });

  it('keeps following a reader who only nudged the list near the end', async () => {
    const { result } = await setUp();
    open(result.current);

    readerScrollsTo(result.current, 380);
    contentGrows(result.current);

    expect(scrollToEnd).toHaveBeenCalledTimes(1);
  });

  it('takes the reader to their own comment wherever they had scrolled to', async () => {
    const { result } = await setUp();
    open(result.current);

    readerScrollsTo(result.current, 100);
    result.current.follow();
    // Still coasting from before they pressed Send, which must not cancel it.
    result.current.scrollProps.onScroll(scrollEvent(150));
    contentGrows(result.current);

    expect(scrollToEnd).toHaveBeenCalledWith({ animated: true });
  });

  it.each(['keyboardDidShow', 'keyboardDidHide'])('stays on the newest through %s', async (event) => {
    await setUp();

    await act(async () => keyboardListeners[event]!());

    expect(scrollToEnd).toHaveBeenCalledWith({ animated: true });
  });

  it('does not move someone reading older comments when the keyboard moves', async () => {
    const { result } = await setUp();
    open(result.current);
    readerScrollsTo(result.current, 100);

    await act(async () => keyboardListeners.keyboardDidShow!());

    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  it('stops listening to the keyboard when it unmounts', async () => {
    const { unmount } = await setUp();
    await unmount();
    expect(removeListener).toHaveBeenCalledTimes(2);
  });
});
