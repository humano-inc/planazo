import { NO_MINIMUM } from '@planazo/shared';

// The "How many" steppers on the new plan form. Neither one offers a 1: a floor
// of 1 would be a second way of saying no minimum, and a ceiling of 1 would be a
// plan with no room for anyone but the host.
const LOWEST_MIN = 2;
const HIGHEST_MIN = 20;
const DEFAULT_MIN = 4;
const LOWEST_CAP = 2;
const HIGHEST_CAP = 40;

/** The floor one step up or down: below the lowest number there is no minimum at all. */
export function stepMin(min: number, delta: 1 | -1): number {
  if (min === NO_MINIMUM) return delta === 1 ? LOWEST_MIN : NO_MINIMUM;
  const next = min + delta;
  return next < LOWEST_MIN ? NO_MINIMUM : Math.min(next, HIGHEST_MIN);
}

/** The ceiling one step up. Starting from "No limit", it lands on the floor. */
export function raiseCap(cap: number | null, min: number): number {
  return cap === null ? Math.max(min, LOWEST_CAP) : Math.min(HIGHEST_CAP, cap + 1);
}

/** The ceiling one step down. It may equal the floor; below that it is "No limit" again. */
export function lowerCap(cap: number | null, min: number): number | null {
  return cap === null || cap - 1 < Math.max(min, LOWEST_CAP) ? null : cap - 1;
}

/** The floor a form opens on, from the `min` of a deep link or "Try again". */
export function initialMin(param?: string): number {
  if (param === String(NO_MINIMUM)) return NO_MINIMUM;
  return Math.min(HIGHEST_MIN, Math.max(LOWEST_MIN, Number(param) || DEFAULT_MIN));
}
