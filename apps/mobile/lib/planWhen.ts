import { fmtDay, fmtTime } from './dates';

/**
 * When a plan happens, in one line. A settled date is a day and a time; an
 * open flexible plan is still a count of what people are choosing between.
 *
 * The feed and the group screen both label plans this way, so the sentence
 * lives here rather than in either of them.
 */
export function planWhenLabel(
  plan: { locked_date?: string | null; event_date?: string | null },
  dateOptions: { date: string }[]
): string {
  const settled = plan.locked_date || plan.event_date;
  if (settled) return `${fmtDay(settled)} · ${fmtTime(settled)}`;
  const count = dateOptions.length;
  return `${count} date${count === 1 ? '' : 's'} on the table`;
}
