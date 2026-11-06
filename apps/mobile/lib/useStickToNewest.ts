import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';

/** How far above the end still counts as being at it: about one line of text. */
const AT_END_SLACK = 40;

/**
 * Whether a scroll is at the end of its content. The bottom inset counts because
 * that is where the keyboard's room goes, so with it up the end is further down
 * than the content alone says.
 */
export function isAtEnd({
  contentOffset,
  contentSize,
  layoutMeasurement,
  contentInset,
}: Pick<NativeScrollEvent, 'contentOffset' | 'contentSize' | 'layoutMeasurement'> &
  Partial<Pick<NativeScrollEvent, 'contentInset'>>): boolean {
  const end = contentSize.height + (contentInset?.bottom ?? 0) - layoutMeasurement.height;
  return contentOffset.y >= end - AT_END_SLACK;
}

/**
 * Keeps a list that reads downward on its newest row, for as long as the person
 * reading it wants to be there.
 *
 * It opens at the end, without animating, because the end is where the screen
 * starts rather than somewhere it travels to. After that it follows new rows only
 * while the reader is at the end: someone who scrolled up to read an older comment
 * is not dragged away from it by a new one.
 *
 * Three things can move the end, and each has its own signal. New rows change the
 * content. The keyboard changes the scroll's inset, which nothing else reports. And
 * the scroll itself changes size, which matters more than it sounds: the safe area
 * arrives a moment after the first layout, so a list opened from cache jumps to the
 * end of a viewport that then shrinks and leaves it short, and a composer growing
 * by a line does the same thing later on.
 *
 * Only the reader can stop it following, so a drag is what hands the scroll over.
 * Until one happens, scroll events are this hook's own: an animated scroll passes
 * through every position on its way, and reading those as "not at the end" would
 * stop it following when two comments land close together.
 *
 * `follow` says the next row is the reader's own, which they want to see wherever
 * they had scrolled to.
 */
export function useStickToNewest(ready: boolean) {
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const atEnd = useRef(true);
  const readerHasIt = useRef(false);
  const landed = useRef(false);

  const toEnd = useCallback((animated: boolean) => {
    if (!atEnd.current) return;
    readerHasIt.current = false;
    scrollRef.current?.scrollToEnd({ animated });
  }, []);

  useEffect(() => {
    const onKeyboardMoved = () => toEnd(true);
    const shown = Keyboard.addListener('keyboardDidShow', onKeyboardMoved);
    const hidden = Keyboard.addListener('keyboardDidHide', onKeyboardMoved);
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [toEnd]);

  const scrollProps = {
    onContentSizeChange: () => {
      if (!ready) return;
      toEnd(landed.current);
      landed.current = true;
    },
    onLayout: () => toEnd(false),
    onScrollBeginDrag: () => {
      readerHasIt.current = true;
    },
    onScroll: ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (readerHasIt.current) atEnd.current = isAtEnd(nativeEvent);
    },
  };

  const follow = () => {
    atEnd.current = true;
    readerHasIt.current = false;
  };

  return { scrollRef, scrollProps, follow };
}
