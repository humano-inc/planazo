import {
  flattenNestedOptions,
  goingLabel,
  isPlanConfirmed,
  isPlanPast,
  planGoingCount,
  planLastDate,
  type NestedDateOption,
  type RsvpLike,
} from '@planazo/shared';
import { planWhenLabel } from './planWhen';

/** The plan shape the group query selects, as this file reads it. */
export interface GroupPlan {
  id: string;
  title: string;
  plan_type: 'fixed' | 'flexible';
  status?: string | null;
  event_date?: string | null;
  locked_date?: string | null;
  min_people: number;
  cancelled_by?: string | null;
  canceller?: { display_name?: string | null } | null;
  rsvps?: RsvpLike[] | null;
  plan_date_options?: NestedDateOption[] | null;
}

export interface GroupPlanRow {
  id: string;
  title: string;
  when: string;
  meta: string;
  open: boolean;
  past: boolean;
  ending: 'cancelled' | 'expired' | 'happened' | null;
  endingLine: string;
  wentNames: string[];
  wentLabel: string;
  endDate: string | null;
  sortKey: number;
}

/**
 * Who was there, you first, as the Past section names them. Falls back to the
 * going count when a past plan carries no yes-RSVPs to name at all.
 */
function whoWent(
  rsvps: RsvpLike[] | null | undefined,
  userId: string | undefined,
  going: number
): { wentNames: string[]; wentLabel: string } {
  const wentNames = (rsvps ?? [])
    .filter((r) => r.response === 'yes')
    .map((r) => (r.user_id === userId ? 'You' : r.profile?.display_name ?? '?'))
    .sort((a, b) => (a === 'You' ? -1 : b === 'You' ? 1 : 0));

  const youWent = wentNames[0] === 'You';
  const wentLabel = youWent
    ? wentNames.length === 1
      ? 'You went'
      : `You and ${wentNames.length - 1} other${wentNames.length === 2 ? '' : 's'} went`
    : `${wentNames.length || going} went`;

  return { wentNames, wentLabel };
}

/**
 * 19d: three endings, one Past section. A plan that happened keeps its white
 * card and the faces of who was there; the two non-events sink into flat
 * stone with one line of explanation.
 */
function endingOf({
  plan,
  past,
  confirmed,
  going,
  userId,
}: {
  plan: GroupPlan;
  past: boolean;
  confirmed: boolean;
  going: number;
  userId: string | undefined;
}): { ending: GroupPlanRow['ending']; endingLine: string } {
  if (plan.status === 'cancelled') {
    const who = plan.cancelled_by === userId ? 'you' : plan.canceller?.display_name ?? 'the host';
    return { ending: 'cancelled', endingLine: `Called off by ${who}` };
  }
  if (!past) return { ending: null, endingLine: '' };
  if (confirmed) return { ending: 'happened', endingLine: '' };
  return { ending: 'expired', endingLine: `Didn't happen · ${going} of ${plan.min_people}` };
}

function toRow(plan: GroupPlan, userId: string | undefined): GroupPlanRow {
  // The row already carries plan_type, status, min_people and rsvps; the
  // options only need flattening out of their nested select shape.
  const { dateOptions, availabilities } = flattenNestedOptions(plan.plan_date_options);
  const planData = { ...plan, dateOptions, availabilities };

  // Yes-RSVPs once fixed or locked, the best single date while a flexible
  // plan is open — the same number plan detail renders, never the union of
  // everyone free on any date (that union is the faces row's business).
  const going = planGoingCount(planData);

  const optionDates = dateOptions.map((o) => o.date);
  const past = plan.status === 'cancelled' || isPlanPast(plan, optionDates);
  const endDate = planLastDate(plan, optionDates);

  return {
    id: plan.id,
    title: plan.title,
    when: planWhenLabel(plan, dateOptions),
    meta: goingLabel(going, plan.min_people),
    open: plan.status === 'open',
    past,
    ...endingOf({ plan, past, confirmed: isPlanConfirmed(planData), going, userId }),
    ...whoWent(plan.rsvps, userId, going),
    endDate,
    sortKey: endDate ? new Date(endDate).getTime() : 0,
  };
}

/**
 * Everything the group screen shows about its plans that is computed rather
 * than fetched, already sliced into the sections it renders. Pure — the
 * screen wraps it in a useMemo keyed on the inputs.
 */
export function deriveGroupPlanRows({
  plans,
  userId,
}: {
  plans?: GroupPlan[] | null;
  userId?: string;
}): {
  live: GroupPlanRow[];
  waiting: GroupPlanRow[];
  locked: GroupPlanRow[];
  past: GroupPlanRow[];
} {
  const rows = (plans ?? []).map((p) => toRow(p, userId));
  const live = rows.filter((p) => !p.past);

  return {
    live,
    waiting: live.filter((p) => p.open),
    locked: live.filter((p) => !p.open),
    past: rows.filter((p) => p.past).sort((a, b) => b.sortKey - a.sortKey),
  };
}
