import { renderHook } from '@testing-library/react-native';
import { useRevealAtTop } from '../useRevealAtTop';

const atY = (y: number) => ({
  measureInWindow: (callback: (x: number, y: number, w: number, h: number) => void) =>
    callback(0, y, 100, 50),
});

async function setup(anchorY: number | null) {
  const { result } = await renderHook(() => useRevealAtTop());
  const scrollTo = jest.fn();
  (result.current.scrollRef as any).current = { scrollTo };
  (result.current.anchorRef as any).current = anchorY === null ? null : atY(anchorY);
  return { reveal: result.current.reveal, scrollTo };
}

describe('useRevealAtTop', () => {
  it('scrolls to the field\'s distance from the top of the content', async () => {
    const { reveal, scrollTo } = await setup(100);
    reveal(atY(700));
    expect(scrollTo).toHaveBeenCalledWith({ y: 588, animated: true });
  });

  it('gives the same answer however far the form has already scrolled', async () => {
    const { reveal, scrollTo } = await setup(-300);
    reveal(atY(300));
    expect(scrollTo).toHaveBeenCalledWith({ y: 588, animated: true });
  });

  it('does nothing without a field', async () => {
    const { reveal, scrollTo } = await setup(100);
    reveal(null);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('does nothing on a screen that rendered no anchor', async () => {
    const { reveal, scrollTo } = await setup(null);
    reveal(atY(700));
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
