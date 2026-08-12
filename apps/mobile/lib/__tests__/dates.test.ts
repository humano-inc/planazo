import { fmtDay, fmtTime, isoDate, isoOfDate, timeAgo } from '../dates';

/**
 * fmtDay is "the one shape a date takes on cards, rows and notices", so this is
 * the only place the shape itself is pinned. Screen tests build their
 * expectations by calling fmtDay, which keeps them immune to the calendar but
 * means a change to the locale or the options would reformat every date in the
 * app without turning a single one of them red.
 */
describe('fmtDay', () => {
  it('is "Sun 12 Jul" — short weekday, bare day, short month, no year', () => {
    expect(fmtDay(new Date(2026, 6, 12, 19, 0).toISOString())).toBe('Sun 12 Jul');
  });

  it('does not pad the day, so the 1st is "1" and not "01"', () => {
    expect(fmtDay(new Date(2026, 7, 1, 19, 0).toISOString())).toBe('Sat 1 Aug');
  });
});

describe('fmtTime', () => {
  it('is 24-hour and zero-padded', () => {
    expect(fmtTime(new Date(2026, 6, 12, 18, 30).toISOString())).toBe('18:30');
    expect(fmtTime(new Date(2026, 6, 12, 9, 5).toISOString())).toBe('09:05');
  });
});

describe('isoDate', () => {
  it('zero-pads month and day', () => {
    expect(isoDate(2026, 2, 5)).toBe('2026-03-05');
  });

  it('leaves two-digit month and day alone', () => {
    expect(isoDate(2026, 11, 25)).toBe('2026-12-25');
  });

  it('orders correctly under string compare across a month boundary', () => {
    // The calendar greys out past days with `iso < today` — this is the
    // property that makes that comparison safe.
    expect(isoDate(2026, 8, 30) < isoDate(2026, 9, 1)).toBe(true);
  });
});

describe('isoOfDate', () => {
  it('formats a local Date as YYYY-MM-DD', () => {
    expect(isoOfDate(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
});

describe('timeAgo', () => {
  const ago = (ms: number) => timeAgo(new Date(Date.now() - ms).toISOString());
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it('buckets minutes, hours, days and weeks', () => {
    expect(ago(30 * 1000)).toBe('just now');
    expect(ago(5 * MIN)).toBe('5m ago');
    expect(ago(3 * HOUR)).toBe('3h ago');
    expect(ago(26 * HOUR)).toBe('yesterday');
    expect(ago(3 * DAY)).toBe('3 days ago');
    expect(ago(20 * DAY)).toBe('2w ago');
  });

  it('says "just now" for the first minute, then counts', () => {
    expect(ago(0)).toBe('just now');
    expect(ago(MIN)).toBe('just now');
    expect(ago(2 * MIN)).toBe('2m ago');
  });

  /** Each boundary reads as the coarser unit the moment it is reached. */
  it('turns over at 60 minutes, 24 hours and 7 days', () => {
    expect(ago(59 * MIN)).toBe('59m ago');
    expect(ago(HOUR)).toBe('1h ago');
    expect(ago(23 * HOUR)).toBe('23h ago');
    expect(ago(DAY)).toBe('yesterday');
    expect(ago(6 * DAY)).toBe('6 days ago');
    expect(ago(7 * DAY)).toBe('1w ago');
  });

  /**
   * A clock that is behind the server's, which is the ordinary case for a row
   * that just arrived. Negative ages clamp rather than reading "-1m ago".
   */
  it('clamps a timestamp from the future to "just now"', () => {
    expect(timeAgo(new Date(Date.now() + 5 * MIN).toISOString())).toBe('just now');
  });
});
