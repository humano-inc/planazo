import { describe, it, expect } from 'vitest';
import {
  countAvailabilityByDate,
  findViableDates,
  getUsersForDateOption,
  flattenNestedOptions,
  earliestViableDate,
  bestViableOption,
  planLastDate,
  endOfLocalDay,
  isPlanPast,
} from './dates';
import type { Availability, DateOption } from './types';

describe('countAvailabilityByDate', () => {
  it('returns zero counts when no availabilities exist', () => {
    const dateOptions: DateOption[] = [
      { id: 'date-1', date: '2025-01-15' },
      { id: 'date-2', date: '2025-01-16' },
    ];
    const availabilities: Availability[] = [];

    const result = countAvailabilityByDate(dateOptions, availabilities);

    expect(result).toEqual({
      'date-1': { count: 0, date: '2025-01-15' },
      'date-2': { count: 0, date: '2025-01-16' },
    });
  });

  it('counts availabilities per date option', () => {
    const dateOptions: DateOption[] = [
      { id: 'date-1', date: '2025-01-15' },
      { id: 'date-2', date: '2025-01-16' },
    ];
    const availabilities: Availability[] = [
      { date_option_id: 'date-1', user_id: 'user-1' },
      { date_option_id: 'date-1', user_id: 'user-2' },
      { date_option_id: 'date-2', user_id: 'user-1' },
    ];

    const result = countAvailabilityByDate(dateOptions, availabilities);

    expect(result['date-1']!.count).toBe(2);
    expect(result['date-2']!.count).toBe(1);
  });

  it('ignores availabilities for unknown date options', () => {
    const dateOptions: DateOption[] = [{ id: 'date-1', date: '2025-01-15' }];
    const availabilities: Availability[] = [
      { date_option_id: 'date-1', user_id: 'user-1' },
      { date_option_id: 'unknown-date', user_id: 'user-2' },
    ];

    const result = countAvailabilityByDate(dateOptions, availabilities);

    expect(result['date-1']!.count).toBe(1);
    expect(result['unknown-date']).toBeUndefined();
  });

  it('handles empty date options', () => {
    const result = countAvailabilityByDate([], []);
    expect(result).toEqual({});
  });
});

describe('findViableDates', () => {
  it('returns empty array when no dates meet minimum', () => {
    const countByDate = {
      'date-1': { count: 2, date: '2025-01-15' },
      'date-2': { count: 1, date: '2025-01-16' },
    };

    const result = findViableDates(countByDate, 5);

    expect(result).toEqual([]);
  });

  it('returns dates that meet minimum threshold', () => {
    const countByDate = {
      'date-1': { count: 3, date: '2025-01-15' },
      'date-2': { count: 5, date: '2025-01-16' },
      'date-3': { count: 2, date: '2025-01-17' },
    };

    const result = findViableDates(countByDate, 3);

    expect(result).toHaveLength(2);
    expect(result.map(([id]) => id)).toContain('date-1');
    expect(result.map(([id]) => id)).toContain('date-2');
  });

  it('sorts by count descending (most popular first)', () => {
    const countByDate = {
      'date-1': { count: 3, date: '2025-01-15' },
      'date-2': { count: 7, date: '2025-01-16' },
      'date-3': { count: 5, date: '2025-01-17' },
    };

    const result = findViableDates(countByDate, 1);

    expect(result[0]![0]).toBe('date-2');
    expect(result[1]![0]).toBe('date-3');
    expect(result[2]![0]).toBe('date-1');
  });

  it('includes dates exactly at minimum threshold', () => {
    const countByDate = {
      'date-1': { count: 3, date: '2025-01-15' },
    };

    const result = findViableDates(countByDate, 3);

    expect(result).toHaveLength(1);
    expect(result[0]![1].count).toBe(3);
  });

  it('handles empty input', () => {
    const result = findViableDates({}, 1);
    expect(result).toEqual([]);
  });
});

describe('getUsersForDateOption', () => {
  it('returns user IDs for the specified date option', () => {
    const availabilities: Availability[] = [
      { date_option_id: 'date-1', user_id: 'user-1' },
      { date_option_id: 'date-1', user_id: 'user-2' },
      { date_option_id: 'date-2', user_id: 'user-3' },
    ];

    const result = getUsersForDateOption(availabilities, 'date-1');

    expect(result).toEqual(['user-1', 'user-2']);
  });

  it('returns empty array when no users match', () => {
    const availabilities: Availability[] = [
      { date_option_id: 'date-1', user_id: 'user-1' },
    ];

    const result = getUsersForDateOption(availabilities, 'date-2');

    expect(result).toEqual([]);
  });

  it('handles empty availabilities', () => {
    const result = getUsersForDateOption([], 'date-1');
    expect(result).toEqual([]);
  });
});

describe('flattenNestedOptions', () => {
  it('flattens the nested Supabase select shape', () => {
    const result = flattenNestedOptions([
      {
        id: 'date-1',
        date: '2025-01-15',
        date_availability: [{ user_id: 'user-1' }, { user_id: 'user-2' }],
      },
      { id: 'date-2', date: '2025-01-16', date_availability: [] },
    ]);

    expect(result.dateOptions).toEqual([
      { id: 'date-1', date: '2025-01-15' },
      { id: 'date-2', date: '2025-01-16' },
    ]);
    expect(result.availabilities).toEqual([
      { date_option_id: 'date-1', user_id: 'user-1' },
      { date_option_id: 'date-1', user_id: 'user-2' },
    ]);
  });

  it('tolerates null/undefined input and null availability arrays', () => {
    expect(flattenNestedOptions(null)).toEqual({
      dateOptions: [],
      availabilities: [],
    });
    expect(flattenNestedOptions(undefined)).toEqual({
      dateOptions: [],
      availabilities: [],
    });
    expect(
      flattenNestedOptions([
        { id: 'date-1', date: '2025-01-15', date_availability: null },
      ]).availabilities
    ).toEqual([]);
  });
});

describe('earliestViableDate', () => {
  it('returns the earliest date meeting the minimum, not the most popular', () => {
    const countByDate = {
      'date-1': { count: 5, date: '2025-01-20' },
      'date-2': { count: 3, date: '2025-01-15' },
      'date-3': { count: 2, date: '2025-01-10' },
    };

    expect(earliestViableDate(countByDate, 3)).toBe('2025-01-15');
  });

  it('returns null when nothing is viable', () => {
    expect(
      earliestViableDate({ 'date-1': { count: 1, date: '2025-01-15' } }, 3)
    ).toBeNull();
    expect(earliestViableDate({}, 1)).toBeNull();
  });
});

describe('bestViableOption', () => {
  it('returns the most-available viable option', () => {
    const countByDate = {
      'date-1': { count: 3, date: '2025-01-15' },
      'date-2': { count: 5, date: '2025-01-16' },
    };

    expect(bestViableOption(countByDate, 3)).toEqual({
      id: 'date-2',
      date: '2025-01-16',
      count: 5,
    });
  });

  it('breaks count ties toward the earlier date', () => {
    const countByDate = {
      'date-late': { count: 4, date: '2025-01-20' },
      'date-early': { count: 4, date: '2025-01-12' },
    };

    expect(bestViableOption(countByDate, 2)?.id).toBe('date-early');
  });

  it('returns null when nothing is viable', () => {
    expect(
      bestViableOption({ 'date-1': { count: 1, date: '2025-01-15' } }, 3)
    ).toBeNull();
  });
});

describe('endings — planLastDate / endOfLocalDay / isPlanPast', () => {
  it('planLastDate prefers locked, then fixed, then the latest option', () => {
    expect(
      planLastDate(
        { locked_date: '2026-08-13T20:00:00Z', event_date: null },
        ['2026-08-20T20:00:00Z']
      )
    ).toBe('2026-08-13T20:00:00Z');
    expect(planLastDate({ event_date: '2026-08-08T19:00:00Z' })).toBe('2026-08-08T19:00:00Z');
    expect(
      planLastDate({ event_date: null, locked_date: null }, [
        '2026-08-07T20:00:00Z',
        '2026-08-14T20:00:00Z',
        '2026-08-09T20:00:00Z',
      ])
    ).toBe('2026-08-14T20:00:00Z');
    expect(planLastDate({ event_date: null, locked_date: null }, [])).toBeNull();
  });

  it('endOfLocalDay is midnight after the local day of the stamp', () => {
    const eod = endOfLocalDay(new Date(2026, 7, 8, 19, 0).toISOString());
    expect(eod.getFullYear()).toBe(2026);
    expect(eod.getMonth()).toBe(7);
    expect(eod.getDate()).toBe(9);
    expect(eod.getHours()).toBe(0);
  });

  it('a plan stays live through its whole day and expires at local midnight', () => {
    const evening = new Date(2026, 7, 8, 19, 0).toISOString();
    const plan = { event_date: evening, locked_date: null };
    // Later the same night — still not past
    expect(isPlanPast(plan, [], new Date(2026, 7, 8, 23, 30))).toBe(false);
    // Next morning — past
    expect(isPlanPast(plan, [], new Date(2026, 7, 9, 0, 1))).toBe(true);
  });

  it('an open vote lives until the end of its latest option', () => {
    const plan = { event_date: null, locked_date: null };
    const opts = [
      new Date(2026, 7, 7, 20, 0).toISOString(),
      new Date(2026, 7, 14, 20, 0).toISOString(),
    ];
    expect(isPlanPast(plan, opts, new Date(2026, 7, 10, 12, 0))).toBe(false);
    expect(isPlanPast(plan, opts, new Date(2026, 7, 15, 0, 1))).toBe(true);
    // Undated plans never expire
    expect(isPlanPast(plan, [], new Date(2030, 0, 1))).toBe(false);
  });
});

