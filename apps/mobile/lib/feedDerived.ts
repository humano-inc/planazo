import {
  canVoteOnPolls,
  countAvailabilityByDate,
  earliestViableDate,
  flattenNestedOptions,
  isPlanConfirmed,
  isPlanFull,
  isPlanPast,
  isVoteRunning,
  needsUserResponse,
  planGoingCount,
  planGoingPeople,
  pollPeopleIn,
  waitlistPosition,
  type NestedDateOption,
  type PlanStatus,
  type PlanType,
  type RsvpLike,
  type RsvpResponse,
} from '@planazo/shared';
import { planWhenLabel } from './planWhen';

/**
 * The plan columns the feed derives from, as this file reads them — not the
 * whole row the query selects. `deriveFeedItems` is generic so the spread
 * below carries every other selected column through to the cards untouched.
 */
export interface FeedPlanSource {
  plan_type: string;
  status: string;
  min_people: number;
  max_people: number | null;
  created_by: string | null;
  event_date?: string | null;
  locked_date?: string | null;
  rsvps: (RsvpLike & { user_id: string })[];
  plan_date_options?: NestedDateOption[] | null;
}

/**
 * Everything the feed shows per plan that is computed rather than fetched.
 * Pure — the screen wraps it in a useMemo keyed on the inputs. This is
 * derivePlanDetail's sibling for the feed.
 */
export function deriveFeedItems<T extends FeedPlanSource>(
  plans: T[] | undefined,
  userId: string | undefined
) {
  return (plans ?? []).map((plan) => {
    const { dateOptions, availabilities } = flattenNestedOptions(plan.plan_date_options);
    // `plan_type` and `status` are CHECK-constrained text in the schema, so
    // the generated types can only call them `string`. Narrowing here is the
    // one place the constraint has to be restated, and it keeps the domain
    // unions intact everywhere downstream.
    const planData = {
      plan_type: plan.plan_type as PlanType,
      status: plan.status as PlanStatus,
      min_people: plan.min_people,
      rsvps: plan.rsvps,
      dateOptions,
      availabilities,
    };
    const confirmed = isPlanConfirmed(planData);
    const needs = needsUserResponse(planData, userId);
    const found = plan.rsvps.find((r) => r.user_id === userId);
    const userRsvp = found && { ...found, response: found.response as RsvpResponse | null };
    const myDates = availabilities.filter((a) => a.user_id === userId).length;
    const countByDate = countAvailabilityByDate(dateOptions, availabilities);
    // No live vote — either there never was one, or locking ended it. What
    // you can answer follows the same line as who counts, so the card's
    // footer and its numbers can never describe two different plans.
    const rsvpDriven = !isVoteRunning(planData);

    // Two different populations, on purpose. The faces are everyone who has
    // engaged, so someone who withdraws actually leaves the stack. The number
    // beside min_people is the best single date, because that is what decides
    // whether the plan is on. Three faces beside "1 of 3 needed" is honest.
    const goingCount = planGoingCount(planData);
    const goingNames = planGoingPeople(planData).map((p) => p.name);

    const sortDate =
      plan.locked_date ?? plan.event_date ?? earliestViableDate(countByDate, plan.min_people);

    // 19e: Plans only ever holds things that still need you — expired and
    // past-confirmed plans leave silently at the end of their day.
    const isPast = isPlanPast(plan, dateOptions.map((o) => o.date));

    // Every place taken (PLA-20). Only asked while a yes is what the plan
    // wants — a running vote hands out no seats until it locks.
    const isFull = rsvpDriven && isPlanFull({ max_people: plan.max_people, rsvps: plan.rsvps });

    // Only you see your own place in the queue (PLA-37).
    const waitPosition = waitlistPosition(plan.rsvps, userId);

    return {
      // Carries the narrowed unions forward so every card and helper reading
      // this plan sees the domain types, not the raw text columns.
      plan: { ...plan, plan_type: planData.plan_type, status: planData.status },
      isPast,
      confirmed,
      needs,
      userRsvp,
      rsvpDriven,
      isFull,
      waitPosition,
      myDates,
      when: planWhenLabel(plan, dateOptions),
      goingNames,
      goingCount,
      dateOptions,
      countByDate,
      canVoteOnPolls: canVoteOnPolls(
        { created_by: plan.created_by, rsvps: plan.rsvps, availabilities },
        userId
      ),
      pollPeopleIn: pollPeopleIn(plan.rsvps, availabilities),
      sortKey: sortDate ? new Date(sortDate).getTime() : Number.MAX_SAFE_INTEGER,
    };
  });
}
