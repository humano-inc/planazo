import { resistPast, settlesOpen } from '../swipePhysics';

/** One action (Block), and two (Block + Remove), the only widths that exist. */
const ONE = -80;
const TWO = -160;

describe('resistPast', () => {
  it('leaves an ordinary drag exactly where the finger put it', () => {
    expect(resistPast(-40, TWO)).toBe(-40);
    expect(resistPast(-159, TWO)).toBe(-159);
  });

  it('passes both ends of the free range through untouched', () => {
    expect(resistPast(0, TWO)).toBe(0);
    expect(resistPast(TWO, TWO)).toBe(TWO);
  });

  it('gives a fifth of the way past fully open', () => {
    expect(resistPast(-260, TWO)).toBe(-180);
    expect(resistPast(-180, ONE)).toBe(-100);
  });

  it('never lets an overdrag reach the distance the finger travelled', () => {
    const dragged = -400;
    const landed = resistPast(dragged, TWO);
    expect(landed).toBeGreaterThan(dragged);
    expect(landed).toBeLessThan(TWO);
  });

  it('walls off the closed side, where there is nothing to reveal', () => {
    expect(resistPast(1, TWO)).toBe(0);
    expect(resistPast(120, TWO)).toBe(0);
  });
});

describe('settlesOpen', () => {
  // The old implementation was distance-only, which is the bug: a thrown row
  // that happened to stop early snapped shut under the finger that threw it.
  it('opens on a flick that barely moved', () => {
    expect(settlesOpen(-20, -1.4, TWO)).toBe(true);
  });

  it('closes on a flick back, however far open the row already was', () => {
    expect(settlesOpen(-155, 1.4, TWO)).toBe(false);
  });

  it('falls back to distance when the finger was only positioning the row', () => {
    expect(settlesOpen(-90, -0.05, TWO)).toBe(true);
    expect(settlesOpen(-70, -0.05, TWO)).toBe(false);
  });

  it('puts the halfway line at half of whatever is open, not a fixed 70pt', () => {
    // 70pt used to be nearly all of a single action and barely a third of two.
    expect(settlesOpen(-45, 0, ONE)).toBe(true);
    expect(settlesOpen(-45, 0, TWO)).toBe(false);
  });

  it('treats exactly halfway as open, and a hair short of it as shut', () => {
    expect(settlesOpen(-80, 0, TWO)).toBe(true);
    expect(settlesOpen(-79.9, 0, TWO)).toBe(false);
  });

  it('treats exactly the flick speed as a flick, in both directions', () => {
    expect(settlesOpen(-10, -0.35, TWO)).toBe(true);
    expect(settlesOpen(-150, 0.35, TWO)).toBe(false);
  });

  it('is unmoved by an overdrag, which is already as open as open gets', () => {
    expect(settlesOpen(-190, 0, TWO)).toBe(true);
  });

  it('leaves a shut row shut when nothing happened', () => {
    expect(settlesOpen(0, 0, TWO)).toBe(false);
  });
});
