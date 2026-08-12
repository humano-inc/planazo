// Whether a plan is on, who counts toward it, and whether it is still waiting
// on you. Every "who is going" question turns on isVoteRunning: while the date
// vote runs availability answers, once it is over yes-RSVPs do.

import { getYesCount } from './capacity';
import { countAvailabilityByDate } from './dates';
import type { Availability, DateOption, ProfileLike, RsvpLike } from './types';

export interface PlanConfirmationData {
  plan_type: 'fixed' | 'flexible';
  status?: string | null;
  min_people: number;
  rsvps?: RsvpLike[] | null;
  dateOptions?: DateOption[] | null;
  availabilities?: Availability[] | null;
}

/**
 * Whether the date vote is still running: a flexible plan nobody has locked or
 * called off. Every "who is going" question turns on this one line. While it
 * is true, availability answers; once it is false, yes-RSVPs do.
 *
 * Cancelled sits on the false side deliberately, which is why this is
 * `status === 'open'` rather than `status !== 'locked'`. A called-off plan is a
 * record of who had said yes, not a vote still waiting on dates.
 */
export function isVoteRunning(
  data: Pick<PlanConfirmationData, 'plan_type' | 'status'>
): boolean {
  return data.plan_type === 'flexible' && data.status === 'open';
}

/**
 * How many people count toward the plan happening — the number every surface
 * renders beside min_people. The best single date while the vote runs,
 * yes-RSVPs once it is over. The union of everyone available on any date is
 * planGoingPeople's job, never this one's.
 */
export function planGoingCount(data: PlanConfirmationData): number {
  if (!isVoteRunning(data)) return getYesCount(data.rsvps);

  const countByDate = countAvailabilityByDate(
    data.dateOptions ?? [],
    data.availabilities ?? []
  );
  return Object.values(countByDate).reduce((max, v) => Math.max(max, v.count), 0);
}

/**
 * Whether a plan has enough people to happen. Locked plans are confirmed by
 * definition; cancelled plans never are. Everything else is planGoingCount
 * against the minimum, so the number a screen shows and the verdict beside it
 * cannot contradict each other — the bug this pairing exists to prevent.
 */
export function isPlanConfirmed(data: PlanConfirmationData): boolean {
  if (data.status === 'cancelled') return false;
  if (data.status === 'locked') return true;
  return planGoingCount(data) >= data.min_people;
}

/**
 * Who has engaged with the plan, deduped, in first-seen row order — the faces
 * row. Everyone free on any date while the vote runs (availability is
 * interest), yes-RSVPs once it is over.
 *
 * Deliberately wider than planGoingCount: a card can honestly show three faces
 * beside "1 of 3 needed" when no date works for more than one of them. Callers
 * that draw their own chip filter themselves out; the order is the row order.
 */
export function planGoingPeople(data: PlanConfirmationData): { id: string; name: string }[] {
  const rows: { user_id?: string; profile?: ProfileLike | null }[] = isVoteRunning(data)
    ? data.availabilities ?? []
    : (data.rsvps ?? []).filter((r) => r.response === 'yes');

  const people: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  rows.forEach((row) => {
    if (!row.user_id || seen.has(row.user_id)) return;
    seen.add(row.user_id);
    people.push({ id: row.user_id, name: row.profile?.display_name ?? '?' });
  });
  return people;
}

/**
 * The line beside a plan's faces: how far off it is, or how many are in. Shared
 * so the feed card and the group row can never word the same number two ways.
 */
export function goingLabel(count: number, minPeople: number): string {
  return count < minPeople ? `${count} of ${minPeople} needed` : `${count} going`;
}

/**
 * Whether the user has said yes (fixed) or marked any availability
 * (flexible).
 */
export function isUserParticipating(
  data: Pick<PlanConfirmationData, 'plan_type' | 'rsvps' | 'availabilities'>,
  userId: string | null | undefined
): boolean {
  if (!userId) return false;

  if (data.plan_type === 'fixed') {
    return (data.rsvps ?? []).some(
      (r) => r.user_id === userId && r.response === 'yes'
    );
  }

  return (data.availabilities ?? []).some((a) => a.user_id === userId);
}

/**
 * Whether the plan is still waiting on this user: open, and they have
 * neither answered (fixed) nor declined / marked availability (flexible).
 */
export function needsUserResponse(
  data: Pick<
    PlanConfirmationData,
    'plan_type' | 'status' | 'rsvps' | 'availabilities'
  >,
  userId: string | null | undefined
): boolean {
  if (data.status !== 'open' || !userId) return false;

  const userRsvp = (data.rsvps ?? []).find((r) => r.user_id === userId);

  if (data.plan_type === 'fixed') {
    return !userRsvp || userRsvp.response === null;
  }

  if (userRsvp?.response === 'no') return false;
  return !(data.availabilities ?? []).some((a) => a.user_id === userId);
}
