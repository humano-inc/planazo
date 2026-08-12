// How many places a plan has, who holds one, and who is queued for the next
// one to free up (PLA-20, PLA-37).

import type { RsvpLike } from './types';

export function getYesCount(rsvps: RsvpLike[] | null | undefined): number {
  return (rsvps ?? []).filter((r) => r.response === 'yes').length;
}

export interface PlanCapacityData {
  /** The ceiling. Null is "No limit" in the create sheet, not a missing value. */
  max_people?: number | null;
  rsvps?: RsvpLike[] | null;
}

/**
 * Places still open, or null when the plan is uncapped.
 *
 * Only a yes takes a seat: availability on an open flexible plan is a vote,
 * not attendance, so a capped plan can legitimately have more people free on
 * a date than it has room for. The seats become real at the lock.
 *
 * Clamped at zero — a plan that predates cap enforcement (PLA-20) can already
 * be over its ceiling, and "-2 left" is not something to render.
 */
export function seatsLeft(data: PlanCapacityData): number | null {
  if (data.max_people == null) return null;
  return Math.max(data.max_people - getYesCount(data.rsvps), 0);
}

/**
 * Whether another yes would be refused. The database is the authority here
 * (a trigger raises PT409); this exists so screens can say so before the tap
 * rather than after the round-trip.
 */
export function isPlanFull(data: PlanCapacityData): boolean {
  return seatsLeft(data) === 0;
}

/** How many people are waiting for a place (PLA-37). */
export function getWaitingCount(rsvps: RsvpLike[] | null | undefined): number {
  return (rsvps ?? []).filter((r) => r.response === 'pending').length;
}

/**
 * Someone's place in the queue, 1-based, or null if they are not in it.
 *
 * Counted rather than read off waitlist_seq, because the numbers are an
 * ordering key with gaps in it: a promotion clears one, a withdrawal takes one
 * out of the middle, and a re-lock starts the new arrivals above the people
 * already waiting. What is honest is how many people are ahead of you.
 *
 * The number only ever gets smaller. People join behind you, and the only
 * things that move you are somebody ahead being promoted or dropping out.
 */
export function waitlistPosition(
  rsvps: RsvpLike[] | null | undefined,
  userId: string | null | undefined
): number | null {
  if (!userId) return null;

  const waiting = (rsvps ?? []).filter(
    (r) => r.response === 'pending' && r.waitlist_seq != null
  );
  const mine = waiting.find((r) => r.user_id === userId);
  if (!mine) return null;

  return waiting.filter((r) => r.waitlist_seq! < mine.waitlist_seq!).length + 1;
}
