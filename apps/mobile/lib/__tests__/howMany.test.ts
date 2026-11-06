import { NO_MINIMUM } from '@planazo/shared';
import { initialMin, lowerCap, raiseCap, stepMin } from '../howMany';

describe('stepMin', () => {
  it('moves one at a time between the lowest and highest floor', () => {
    expect(stepMin(4, 1)).toBe(5);
    expect(stepMin(4, -1)).toBe(3);
  });

  it('steps down from the lowest number into no minimum', () => {
    expect(stepMin(2, -1)).toBe(NO_MINIMUM);
  });

  it('stays at no minimum on the way down', () => {
    expect(stepMin(NO_MINIMUM, -1)).toBe(NO_MINIMUM);
  });

  it('skips 1 on the way back up', () => {
    expect(stepMin(NO_MINIMUM, 1)).toBe(2);
  });

  it('stops at the highest floor', () => {
    expect(stepMin(20, 1)).toBe(20);
  });
});

describe('raiseCap', () => {
  it('leaves No limit onto the floor, for an exact headcount', () => {
    expect(raiseCap(null, 4)).toBe(4);
  });

  it('leaves No limit onto room for two when there is no floor', () => {
    expect(raiseCap(null, NO_MINIMUM)).toBe(2);
  });

  it('climbs one at a time and stops at the highest cap', () => {
    expect(raiseCap(5, 2)).toBe(6);
    expect(raiseCap(40, 2)).toBe(40);
  });
});

describe('lowerCap', () => {
  it('steps down while it stays at or above the floor', () => {
    expect(lowerCap(6, 4)).toBe(5);
    expect(lowerCap(5, 4)).toBe(4);
  });

  it('goes back to No limit from below the floor', () => {
    expect(lowerCap(4, 4)).toBeNull();
  });

  it('goes back to No limit rather than leaving room for one when there is no floor', () => {
    expect(lowerCap(3, NO_MINIMUM)).toBe(2);
    expect(lowerCap(2, NO_MINIMUM)).toBeNull();
  });

  it('leaves No limit alone', () => {
    expect(lowerCap(null, 4)).toBeNull();
  });
});

describe('initialMin', () => {
  it('opens on the default when nothing asks for another number', () => {
    expect(initialMin()).toBe(4);
    expect(initialMin('')).toBe(4);
    expect(initialMin('lots')).toBe(4);
  });

  it('takes the number it is given', () => {
    expect(initialMin('5')).toBe(5);
  });

  it('keeps a number it cannot offer inside the stepper', () => {
    expect(initialMin('1')).toBe(2);
    expect(initialMin('-3')).toBe(2);
    expect(initialMin('25')).toBe(20);
  });

  it('reads zero as no minimum, not as a missing number', () => {
    expect(initialMin('0')).toBe(NO_MINIMUM);
  });
});
