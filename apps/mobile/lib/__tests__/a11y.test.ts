import { LINK_HIT_SLOP, MIN_TOUCH_TARGET, hitSlopTo } from '../a11y';

describe('MIN_TOUCH_TARGET', () => {
  it('clears Android\'s 48dp requirement on both platforms', () => {
    expect(MIN_TOUCH_TARGET).toBe(48);
  });
});

describe('hitSlopTo', () => {
  it('lifts a small control to the minimum on both sides', () => {
    // 20pt tall + 14 above + 14 below = 48
    expect(hitSlopTo(20)).toBe(14);
    expect(20 + hitSlopTo(20) * 2).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it('rounds up rather than landing a point short', () => {
    // 21 needs 13.5 a side; half a point of slop is not worth the arithmetic
    // it would cost every caller, and 47 would defeat the whole point.
    expect(hitSlopTo(21)).toBe(14);
    expect(21 + hitSlopTo(21) * 2).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it('asks for nothing once the control is already big enough', () => {
    expect(hitSlopTo(MIN_TOUCH_TARGET)).toBe(0);
    expect(hitSlopTo(60)).toBe(0);
  });

  it('never returns a negative, which would shrink the target', () => {
    expect(hitSlopTo(1000)).toBe(0);
  });
});

describe('LINK_HIT_SLOP', () => {
  // The auth screens lean on this for their text links, so the constant itself
  // has to be enough for the ~17-20pt line box it wraps.
  it('is enough to take a caption-sized line to 48', () => {
    const captionLineHeight = 17;
    expect(captionLineHeight + LINK_HIT_SLOP.top + LINK_HIT_SLOP.bottom).toBeGreaterThanOrEqual(
      MIN_TOUCH_TARGET,
    );
  });
});
