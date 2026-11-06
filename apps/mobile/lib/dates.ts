/** "Sat 12 Jul" — the one shape a date takes on cards, rows and notices. */
export const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** "18:30" */
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const pad2 = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD from a year, 0-based month and day. Zero-padded so string compare orders correctly. */
export const isoDate = (year: number, monthIndex: number, day: number) =>
  `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;

/** A local Date as YYYY-MM-DD. */
export const isoOfDate = (d: Date) => isoDate(d.getFullYear(), d.getMonth(), d.getDate());

/** A local Date as HH:MM. */
export const timeOfDate = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/**
 * Local wall-clock Date from a YYYY-MM-DD day, plus an optional time. Built from
 * components, never by parsing a string: Hermes reads a naive date-time as UTC.
 */
export const localDate = (iso: string, h = 0, m = 0) => {
  const [y = 0, mo = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m);
};

/** The instant a YYYY-MM-DD day and an HH:MM time name on this phone. */
export const dayTimeToIso = (day: string, time: string) => {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return localDate(day, h, m).toISOString();
};

/**
 * How long ago something arrived, for a row where the exact time is noise:
 * "just now", "5m ago", "3h ago", "yesterday", "3 days ago", "2w ago".
 *
 * Coarsens as it goes, on purpose. A minute matters on an invite that landed
 * while you were looking; a week-old one only has to read as old.
 */
export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return `${Math.floor(days / 7)}w ago`;
}
