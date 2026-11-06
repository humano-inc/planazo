import { fmtDay, localDate } from '../dates';
import {
  deriveEndEdit,
  endDayLabel,
  planEndHasPassed,
  planEndIso,
  resolvePlanEnd,
  rolloverNotice,
  UNTOUCHED_END,
} from '../planEnd';

// Saturday 14 November 2026. These functions take `now` and `today` as
// arguments, so a literal date here cannot go stale.
const SAT = '2026-11-14';
const SUN = '2026-11-15';
const MON = '2026-11-16';

describe('resolvePlanEnd', () => {
  it('defaults to two hours after the start, on the same day', () => {
    expect(resolvePlanEnd(SAT, '20:30', UNTOUCHED_END)).toEqual({
      day: SAT,
      time: '22:30',
      rolledOver: false,
    });
  });

  it('follows the start until the host touches it', () => {
    expect(resolvePlanEnd(SAT, '18:15', UNTOUCHED_END).time).toBe('20:15');
  });

  it('moves the default to the next day when it crosses midnight', () => {
    expect(resolvePlanEnd(SAT, '23:00', UNTOUCHED_END)).toEqual({
      day: SUN,
      time: '01:00',
      rolledOver: true,
    });
  });

  it('keeps a later time on the same day', () => {
    expect(resolvePlanEnd(SAT, '20:00', { day: null, time: '23:45' })).toEqual({
      day: SAT,
      time: '23:45',
      rolledOver: false,
    });
  });

  it('reads an earlier time as the next day', () => {
    expect(resolvePlanEnd(SAT, '22:00', { day: null, time: '02:00' })).toEqual({
      day: SUN,
      time: '02:00',
      rolledOver: true,
    });
  });

  it('reads the same time as the next day, because an end has to be after the start', () => {
    expect(resolvePlanEnd(SAT, '20:00', { day: null, time: '20:00' })).toEqual({
      day: SUN,
      time: '20:00',
      rolledOver: true,
    });
  });

  it('keeps a later day the host chose, with any time on it', () => {
    expect(resolvePlanEnd(SAT, '18:00', { day: MON, time: '12:00' })).toEqual({
      day: MON,
      time: '12:00',
      rolledOver: false,
    });
  });

  it('treats a chosen day that is not after the start as not chosen', () => {
    expect(resolvePlanEnd(SUN, '20:00', { day: SAT, time: '22:00' })).toEqual({
      day: SUN,
      time: '22:00',
      rolledOver: false,
    });
    expect(resolvePlanEnd(SAT, '20:00', { day: SAT, time: '19:00' })).toEqual({
      day: SUN,
      time: '19:00',
      rolledOver: true,
    });
  });

  it('crosses a month end', () => {
    expect(resolvePlanEnd('2026-11-30', '23:00', UNTOUCHED_END).day).toBe('2026-12-01');
  });
});

describe('planEndIso', () => {
  it('is the instant the resolved day and time name', () => {
    expect(planEndIso(SAT, '22:00', { day: null, time: '02:00' })).toBe(
      new Date(2026, 10, 15, 2, 0).toISOString()
    );
  });
});

describe('planEndHasPassed', () => {
  const end = new Date(2026, 10, 14, 20, 0).toISOString();

  it('is false while the end is ahead', () => {
    expect(planEndHasPassed(end, new Date(2026, 10, 14, 19, 59))).toBe(false);
  });

  it('is true from the moment of the end', () => {
    expect(planEndHasPassed(end, new Date(2026, 10, 14, 20, 0))).toBe(true);
  });
});

describe('deriveEndEdit', () => {
  const now = new Date(2026, 10, 14, 12, 0);
  const start = new Date(2026, 10, 14, 20, 30).toISOString();
  const end = new Date(2026, 10, 14, 23, 0).toISOString();

  it('is null on a vote nobody has locked', () => {
    expect(deriveEndEdit({ event_date: null, locked_date: null }, undefined, now)).toBeNull();
  });

  it('reads the start and the stored end, with nothing changed', () => {
    expect(deriveEndEdit({ event_date: start, ends_at: end }, undefined, now)).toEqual({
      startDay: SAT,
      startTime: '20:30',
      draft: { day: SAT, time: '23:00' },
      endsAt: end,
      changed: false,
      blocked: false,
    });
  });

  it('prefers the locked date over the date a plan was created with', () => {
    const locked = new Date(2026, 10, 15, 10, 0).toISOString();
    const edit = deriveEndEdit({ event_date: start, locked_date: locked }, undefined, now);
    expect(edit).toMatchObject({ startDay: SUN, startTime: '10:00' });
  });

  it('keeps a stored overnight end on its own day', () => {
    const overnight = new Date(2026, 10, 15, 2, 0).toISOString();
    const edit = deriveEndEdit({ event_date: start, ends_at: overnight }, undefined, now);
    expect(edit).toMatchObject({ endsAt: overnight, changed: false });
  });

  it('leaves a plan with no end alone until the host adds one', () => {
    expect(deriveEndEdit({ event_date: start, ends_at: null }, undefined, now)).toMatchObject({
      draft: null,
      endsAt: null,
      changed: false,
      blocked: false,
    });
  });

  it('counts an added end as a change, starting from the default', () => {
    expect(deriveEndEdit({ event_date: start, ends_at: null }, UNTOUCHED_END, now)).toMatchObject({
      endsAt: new Date(2026, 10, 14, 22, 30).toISOString(),
      changed: true,
    });
  });

  it('counts an edited end as a change', () => {
    const edit = deriveEndEdit(
      { event_date: start, ends_at: end },
      { day: SAT, time: '23:30' },
      now
    );
    expect(edit).toMatchObject({
      endsAt: new Date(2026, 10, 14, 23, 30).toISOString(),
      changed: true,
      blocked: false,
    });
  });

  it('counts a removed end as a change, and never blocks it', () => {
    const later = new Date(2026, 10, 15, 9, 0);
    expect(deriveEndEdit({ event_date: start, ends_at: end }, null, later)).toMatchObject({
      draft: null,
      endsAt: null,
      changed: true,
      blocked: false,
    });
  });

  it('blocks a change that would end the plan in the past', () => {
    const late = new Date(2026, 10, 14, 22, 45);
    const edit = deriveEndEdit(
      { event_date: start, ends_at: end },
      { day: SAT, time: '22:00' },
      late
    );
    expect(edit).toMatchObject({ changed: true, blocked: true });
  });

  it('does not block an unchanged end, whatever the clock says', () => {
    const later = new Date(2026, 10, 15, 9, 0);
    expect(deriveEndEdit({ event_date: start, ends_at: end }, undefined, later)?.blocked).toBe(
      false
    );
  });
});

describe('endDayLabel', () => {
  it('reads "Same day" for a plan that starts on another day', () => {
    expect(endDayLabel(SAT, SAT, '2026-11-06')).toBe('Same day');
  });

  it('reads "Today" for a plan that starts today', () => {
    expect(endDayLabel(SAT, SAT, SAT)).toBe('Today');
  });

  it('names the date once the end is on a different day', () => {
    expect(endDayLabel(SUN, SAT, SAT)).toBe(fmtDay(localDate(SUN).toISOString()));
  });
});

describe('rolloverNotice', () => {
  it('names the weekday the plan ends on', () => {
    expect(rolloverNotice(SUN)).toBe('Runs past midnight, so it ends on Sunday.');
  });
});
