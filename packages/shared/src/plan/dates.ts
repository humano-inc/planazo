// Which dates a plan could happen on, and when it has stopped being able to:
// counting availability, picking the viable option, and the endings rule.

import type { Availability, DateCount, DateOption, NestedDateOption, PlanDates } from './types';

/**
 * Counts availability per date option
 */
export function countAvailabilityByDate(
  dateOptions: DateOption[],
  availabilities: Availability[]
): Record<string, DateCount> {
  const countByDate: Record<string, DateCount> = {};

  dateOptions.forEach((opt) => {
    countByDate[opt.id] = { count: 0, date: opt.date };
  });

  availabilities.forEach((a) => {
    const entry = countByDate[a.date_option_id];
    if (entry) {
      entry.count++;
    }
  });

  return countByDate;
}

/**
 * Finds dates that meet minimum participant requirements,
 * sorted by popularity (most available users first)
 */
export function findViableDates(
  countByDate: Record<string, DateCount>,
  minPeople: number
): Array<[string, DateCount]> {
  return Object.entries(countByDate)
    .filter(([_, val]) => val.count >= minPeople)
    .sort((a, b) => b[1].count - a[1].count);
}

/**
 * Gets user IDs available for a specific date option
 */
export function getUsersForDateOption(
  availabilities: Availability[],
  dateOptionId: string
): string[] {
  return availabilities
    .filter((a) => a.date_option_id === dateOptionId)
    .map((a) => a.user_id);
}

/**
 * Converts the nested Supabase select shape into flat date options +
 * availabilities so the counting functions can operate on either shape.
 */
export function flattenNestedOptions(
  nested: NestedDateOption[] | null | undefined
): { dateOptions: DateOption[]; availabilities: Availability[] } {
  const dateOptions: DateOption[] = [];
  const availabilities: Availability[] = [];

  (nested ?? []).forEach((opt) => {
    dateOptions.push({ id: opt.id, date: opt.date });
    (opt.date_availability ?? []).forEach((a) => {
      availabilities.push({ date_option_id: opt.id, user_id: a.user_id, profile: a.profile });
    });
  });

  return { dateOptions, availabilities };
}

/**
 * The earliest date that meets the minimum. Used for display ("when is this
 * happening"), where the soonest viable date is the honest answer.
 */
export function earliestViableDate(
  countByDate: Record<string, DateCount>,
  minPeople: number
): string | null {
  const viable = Object.values(countByDate)
    .filter((v) => v.count >= minPeople)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return viable[0]?.date ?? null;
}

/**
 * The viable option with the most availability. Used for locking, where the
 * host wants the date the most people can make. Ties break toward the
 * earlier date so the result is deterministic.
 */
export function bestViableOption(
  countByDate: Record<string, DateCount>,
  minPeople: number
): { id: string; date: string; count: number } | null {
  const viable = Object.entries(countByDate)
    .filter(([_, v]) => v.count >= minPeople)
    .sort((a, b) =>
      b[1].count - a[1].count !== 0
        ? b[1].count - a[1].count
        : new Date(a[1].date).getTime() - new Date(b[1].date).getTime()
    );
  const top = viable[0];
  return top ? { id: top[0], date: top[1].date, count: top[1].count } : null;
}

/**
 * The last date a plan could still happen on: the locked date, the fixed
 * date, or the latest of an open vote's options. Null when undated.
 */
export function planLastDate(
  plan: PlanDates,
  optionDates: string[] = []
): string | null {
  if (plan.locked_date) return plan.locked_date;
  if (plan.event_date) return plan.event_date;
  if (optionDates.length === 0) return null;
  return optionDates.reduce((a, b) =>
    new Date(a).getTime() >= new Date(b).getTime() ? a : b
  );
}

/**
 * Local midnight after the day the timestamp falls on. Built from date
 * components — never from a naive string (Hermes parses those as UTC).
 */
export function endOfLocalDay(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
}

/**
 * Endings rule (design 19c–19e): a plan is past once the end of its last
 * possible day has gone by, in the viewer's timezone. Undated plans never
 * expire. Whether a past plan "happened" or "didn't happen" is a separate
 * question answered by isPlanConfirmed.
 */
export function isPlanPast(
  plan: PlanDates,
  optionDates: string[] = [],
  now: Date = new Date()
): boolean {
  const last = planLastDate(plan, optionDates);
  if (!last) return false;
  return now.getTime() >= endOfLocalDay(last).getTime();
}
