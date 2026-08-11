/**
 * What calling a plan off costs the people already in it (20b).
 *
 * Lifted out of the cancel sheet by PLA-108 so the six sentences it can
 * produce are reachable without rendering the screen. Two of the six were
 * covered before; the singular boundary and the whole flexible branch were
 * not, which is the kind of copy that only ever gets read at the worst moment.
 *
 * Who counts differs by plan type on purpose. A flexible plan has no yeses
 * yet, so the people it lands on are whoever sent dates, deduped: one person
 * ticking four dates is one person let down, not four.
 */
export interface CancelCostInput {
  plan_type?: string | null;
  status?: string | null;
}

// Named apart from the shared `RsvpLike` and `Availability` on purpose: these
// are only what this one sentence reads, so the cancel sheet's query shape fits
// without a cast, and a reader is never left wondering which one is meant.
export interface CancelRsvp {
  response?: string | null;
}

export interface CancelAvailability {
  user_id: string;
}

/**
 * How many people the cancellation reaches. Only an *open* flexible plan
 * counts date-senders: once it locks, the answer that matters is the yes.
 */
export function affectedCount(
  plan: CancelCostInput | null | undefined,
  rsvps: CancelRsvp[] | null | undefined,
  availabilities: CancelAvailability[] | null | undefined
): number {
  return isOpenFlexible(plan)
    ? new Set((availabilities ?? []).map((a) => a.user_id)).size
    : (rsvps ?? []).filter((r) => r.response === 'yes').length;
}

function isOpenFlexible(plan: CancelCostInput | null | undefined): boolean {
  return plan?.plan_type === 'flexible' && plan.status === 'open';
}

/** The sentence under the Cancel button, naming the cost out loud. */
export function costLine(
  plan: CancelCostInput | null | undefined,
  rsvps: CancelRsvp[] | null | undefined,
  availabilities: CancelAvailability[] | null | undefined
): string {
  const affected = affectedCount(plan, rsvps, availabilities);
  const verb = isOpenFlexible(plan) ? 'sent dates' : "said they're coming";

  if (affected === 0) return 'No one has answered yet. The plan moves to Past.';
  if (affected === 1) {
    return `1 person ${verb}. They'll get a notification straight away, and the plan moves to Past.`;
  }
  return `${affected} people ${verb}. They'll all get a notification straight away, and the plan moves to Past.`;
}
