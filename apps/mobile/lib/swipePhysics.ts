/**
 * Where a swipe row goes when the finger leaves it, and how far it may be
 * dragged before that.
 *
 * Pure arithmetic, out here rather than inside `SwipeRow`, because this is the
 * whole of what makes a swipe feel right or wrong and it is the one part of a
 * gesture a test can pin exactly. Driving a real pan through jest proves
 * nothing about physics; these two functions are the physics.
 *
 * Every position is a translateX in points: 0 is shut, `rest` is fully open
 * and always negative (the actions live off the right edge).
 */

/**
 * Past halfway the row settles open. Fixed thresholds get this wrong at both
 * ends: 70pt was most of the way across a single 80pt Block action and barely
 * a third of the way across Block plus Remove.
 */
const OPEN_FRACTION = 0.5;

/**
 * Points per millisecond, matching `gestureState.vx`. Below this a movement is
 * somebody positioning the row; above it they have thrown it and the distance
 * they happened to reach stops mattering.
 */
const FLICK = 0.35;

/** How much of an overdrag past the last action still moves the row. */
const OVERDRAG = 0.2;

/**
 * The position a raw drag actually lands on.
 *
 * Two different ends, because they are not the same kind of edge:
 *
 * - **Past fully open** the row keeps moving at a fifth of the finger's pace.
 *   A hard stop there reads as a bug in the app; the drag under your thumb
 *   simply quits. A little give says "this is the end" while staying alive.
 * - **Right of shut** is a wall. There are no leading actions, so anything
 *   revealed on that side would be an empty gap with nothing in it.
 */
export function resistPast(raw: number, rest: number): number {
  if (raw > 0) return 0;
  if (raw < rest) return rest + (raw - rest) * OVERDRAG;
  return raw;
}

/**
 * Whether the row settles open, given where it landed and how fast it was
 * moving when released.
 *
 * Velocity wins over distance in both directions, which is the half the old
 * implementation was missing: a flick is a complete gesture at any distance,
 * and every other swipe row on the platform honours one.
 *
 * `landed` is the resisted position; overdrag past `rest` cannot make the
 * answer any more open than fully open already is.
 */
export function settlesOpen(landed: number, vx: number, rest: number): boolean {
  if (vx <= -FLICK) return true;
  if (vx >= FLICK) return false;
  return landed <= rest * OPEN_FRACTION;
}
