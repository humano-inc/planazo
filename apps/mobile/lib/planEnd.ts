import { dayTimeToIso, fmtDay, isoOfDate, localDate, timeOfDate } from './dates';

/** How long a plan runs until the host says otherwise. */
const DEFAULT_LENGTH_HOURS = 2;

/**
 * What the host has said about when a plan ends, once they have added an end. A
 * null field is one they have not touched, which is what lets the end follow the
 * start until they do. A plan with no end has no draft at all.
 */
export interface PlanEndDraft {
  /** YYYY-MM-DD */
  day: string | null;
  /** HH:MM */
  time: string | null;
}

/** What "Add end time" starts from: nothing said yet, so the default shows. */
export const UNTOUCHED_END: PlanEndDraft = { day: null, time: null };

export interface ResolvedPlanEnd {
  day: string;
  time: string;
  /** It moved to the next day by itself, because its time is not after the start's. */
  rolledOver: boolean;
}

const nextDay = (day: string) => {
  const d = localDate(day);
  return isoOfDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
};

const defaultEndTime = (startTime: string) => {
  const [h = 0, m = 0] = startTime.split(':').map(Number);
  return timeOfDate(new Date(2000, 0, 1, h + DEFAULT_LENGTH_HOURS, m));
};

/**
 * When a plan ends, given what the host has said. Always after the start: a day
 * that is not later than the start's counts as not chosen, and a time that is
 * not after the start's means the next day.
 */
export function resolvePlanEnd(
  startDay: string,
  startTime: string,
  draft: PlanEndDraft
): ResolvedPlanEnd {
  const time = draft.time ?? defaultEndTime(startTime);
  if (draft.day && draft.day > startDay) return { day: draft.day, time, rolledOver: false };
  if (time > startTime) return { day: startDay, time, rolledOver: false };
  return { day: nextDay(startDay), time, rolledOver: true };
}

/** The instant a plan ends, ready for `ends_at`. */
export function planEndIso(startDay: string, startTime: string, draft: PlanEndDraft): string {
  const { day, time } = resolvePlanEnd(startDay, startTime, draft);
  return dayTimeToIso(day, time);
}

/**
 * Whether this end has already gone by. A plan posted with one would count as
 * over the moment it lands and never show up in the feed.
 */
export function planEndHasPassed(endsAt: string, now: Date = new Date()): boolean {
  return new Date(endsAt).getTime() <= now.getTime();
}

/** A saved `ends_at` as the draft that produces it. */
function draftFromEndsAt(endsAt: string): PlanEndDraft {
  const end = new Date(endsAt);
  return { day: isoOfDate(end), time: timeOfDate(end) };
}

export interface PlanEndEdit {
  startDay: string;
  startTime: string;
  draft: PlanEndDraft | null;
  endsAt: string | null;
  /** Saving would write a different end from the stored one. */
  changed: boolean;
  /** The change would end the plan in the past. */
  blocked: boolean;
}

const instant = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : null);

/**
 * What the edit screen knows about a plan's end. Null on a vote nobody has
 * locked, which has no start and so no end to give it yet.
 *
 * `edited` is undefined until the host touches the end, and null once they have
 * removed it, which is a different thing from leaving it alone.
 */
export function deriveEndEdit(
  plan: { locked_date?: string | null; event_date?: string | null; ends_at?: string | null },
  edited: PlanEndDraft | null | undefined,
  now: Date = new Date()
): PlanEndEdit | null {
  const start = plan.locked_date ?? plan.event_date;
  if (!start) return null;

  const startDay = isoOfDate(new Date(start));
  const startTime = timeOfDate(new Date(start));
  const stored = plan.ends_at ? draftFromEndsAt(plan.ends_at) : null;
  const draft = edited === undefined ? stored : edited;
  const endsAt = draft ? planEndIso(startDay, startTime, draft) : null;
  const changed = instant(endsAt) !== instant(plan.ends_at);

  return {
    startDay,
    startTime,
    draft,
    endsAt,
    changed,
    blocked: changed && !!endsAt && planEndHasPassed(endsAt, now),
  };
}

/**
 * What the end-day control reads. The start's own day is named relative to the
 * start, because "Sat 14 Nov" twice in one card asks the host to compare them.
 */
export function endDayLabel(
  endDay: string,
  startDay: string,
  today: string = isoOfDate(new Date())
): string {
  if (endDay !== startDay) return fmtDay(localDate(endDay).toISOString());
  return startDay === today ? 'Today' : 'Same day';
}

/** Why the end moved to the next day without being asked. */
export function rolloverNotice(endDay: string): string {
  const weekday = localDate(endDay).toLocaleDateString('en-GB', { weekday: 'long' });
  return `Runs past midnight, so it ends on ${weekday}.`;
}
