// The photo album's two rules (PLA-32), mirroring can_add_plan_photo() in
// 20260804000002_block_shield.sql. They lived inline in plan detail and drifted
// from the SQL, which is what PLA-55 was: an admin who skipped the night got a
// button whose every insert RLS refused.

import type { PlanDates, RsvpLike } from './types';

export interface PlanAlbumData extends PlanDates {
  status?: string | null;
  created_by?: string | null;
  rsvps?: RsvpLike[] | null;
}

/**
 * Whether the night has started, which is when the album opens. It never
 * closes again: somebody always sorts their camera roll a week late, and
 * locking them out of their own evening to keep the album tidy is a bad trade.
 *
 * The start is the locked date if a flexible plan has one, otherwise the fixed
 * date. A flexible plan nobody has locked yet has neither, and no album,
 * because the night does not exist yet.
 *
 * Deliberately **not** endOfLocalDay, which isPlanPast uses. These are opposite
 * ends of the same night: past asks whether the evening has finished, this asks
 * whether it has begun. Running to the end of the day would hold the album shut
 * until the following midnight, and put this out of step with the SQL's
 * `COALESCE(locked_date, event_date) <= NOW()`. The Hermes hazard endOfLocalDay
 * guards is a naive date string read as UTC; both columns are TIMESTAMPTZ and
 * arrive with an offset, so a plain comparison of instants is the honest one.
 */
export function isAlbumOpen(plan: PlanAlbumData, now: Date = new Date()): boolean {
  const start = plan.locked_date ?? plan.event_date;
  if (!start) return false;
  return new Date(start).getTime() <= now.getTime();
}

/**
 * Whether this person may add to the album. Looking belongs to the group,
 * adding belongs to the people who were there — so the creator, or a yes, and
 * nobody else. Being a group admin is power over the group, not evidence of
 * having been at the plan, and a yes is a yes rather than availability on a
 * flexible plan that never locked.
 *
 * The database is the authority (the storage INSERT policy asks
 * can_add_plan_photo directly); this exists so a screen can decide whether to
 * draw the button rather than let someone find out by being refused.
 *
 * Two conditions the SQL also carries are missing here on purpose: group
 * membership, which a client only ever sees plans it already passes, and the
 * block shield's `NOT is_blocked_by(created_by)`, which is exactly what RLS
 * must keep a client from reading. So a blocked person holding a leftover yes
 * on a past plan is the one case where this says yes and the database says no.
 * That divergence is the shield working, not drift to be closed.
 */
export function canAddPhotos(
  data: PlanAlbumData,
  userId: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!userId) return false;
  if (data.status === 'cancelled') return false;
  if (!isAlbumOpen(data, now)) return false;
  if (data.created_by === userId) return true;
  return (data.rsvps ?? []).some((r) => r.user_id === userId && r.response === 'yes');
}
