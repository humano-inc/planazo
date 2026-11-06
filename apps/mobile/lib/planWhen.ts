import { fmtDay, fmtTime, isoOfDate } from './dates';

/** Under this, a plan that crosses midnight is one night out, not a trip. */
const ONE_NIGHT_MS = 12 * 60 * 60 * 1000;

/**
 * Whether naming the start's day is not enough. "Sat 14 Nov · 22:00 – 02:00"
 * says what it means; "Sat 14 Nov · 18:00 – 12:00" would not.
 */
export function spansDays(start: string, end: string): boolean {
  const from = new Date(start);
  const to = new Date(end);
  if (isoOfDate(from) === isoOfDate(to)) return false;
  return to.getTime() - from.getTime() >= ONE_NIGHT_MS;
}

/**
 * When a plan happens, in one line. A settled date is a day and a time range;
 * an open flexible plan is still a count of what people are choosing between.
 *
 * The feed and the group screen both label plans this way, so the sentence
 * lives here rather than in either of them.
 */
export function planWhenLabel(
  plan: { locked_date?: string | null; event_date?: string | null; ends_at?: string | null },
  dateOptions: { date: string }[]
): string {
  const settled = plan.locked_date || plan.event_date;
  if (settled) {
    const end = plan.ends_at;
    if (!end) return `${fmtDay(settled)} · ${fmtTime(settled)}`;
    if (spansDays(settled, end)) {
      return `${fmtDay(settled)} ${fmtTime(settled)} – ${fmtDay(end)} ${fmtTime(end)}`;
    }
    return `${fmtDay(settled)} · ${fmtTime(settled)} – ${fmtTime(end)}`;
  }
  const count = dateOptions.length;
  return `${count} date${count === 1 ? '' : 's'} on the table`;
}

export interface PlanWhenRow {
  title: string;
  value: string;
}

/** The same fact for plan detail, which has a row per day where the feed has a line. */
export function planWhenRows(start: string, end?: string | null): PlanWhenRow[] {
  if (!end) return [{ title: fmtDay(start), value: fmtTime(start) }];
  if (spansDays(start, end)) {
    return [
      { title: fmtDay(start), value: fmtTime(start) },
      { title: `Until ${fmtDay(end)}`, value: fmtTime(end) },
    ];
  }
  return [{ title: fmtDay(start), value: `${fmtTime(start)} – ${fmtTime(end)}` }];
}
