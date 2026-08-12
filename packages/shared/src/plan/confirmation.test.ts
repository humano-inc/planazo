import { describe, it, expect } from 'vitest';
import {
  isPlanConfirmed,
  isVoteRunning,
  goingLabel,
  planGoingCount,
  planGoingPeople,
  isUserParticipating,
  needsUserResponse,
} from './confirmation';
import type { Availability, DateOption } from './types';

describe('isPlanConfirmed', () => {
  it('confirms a fixed plan at exactly the minimum', () => {
    expect(
      isPlanConfirmed({
        plan_type: 'fixed',
        status: 'open',
        min_people: 2,
        rsvps: [{ response: 'yes' }, { response: 'yes' }, { response: 'no' }],
      })
    ).toBe(true);
  });

  it('does not confirm a fixed plan below the minimum', () => {
    expect(
      isPlanConfirmed({
        plan_type: 'fixed',
        status: 'open',
        min_people: 3,
        rsvps: [{ response: 'yes' }, { response: 'yes' }],
      })
    ).toBe(false);
  });

  it('confirms a flexible plan when any single option reaches the minimum', () => {
    expect(
      isPlanConfirmed({
        plan_type: 'flexible',
        status: 'open',
        min_people: 2,
        dateOptions: [
          { id: 'date-1', date: '2025-01-15' },
          { id: 'date-2', date: '2025-01-16' },
        ],
        availabilities: [
          { date_option_id: 'date-1', user_id: 'user-1' },
          { date_option_id: 'date-2', user_id: 'user-1' },
          { date_option_id: 'date-2', user_id: 'user-2' },
        ],
      })
    ).toBe(true);
  });

  it('does not confirm a flexible plan where votes are spread thin', () => {
    expect(
      isPlanConfirmed({
        plan_type: 'flexible',
        status: 'open',
        min_people: 2,
        dateOptions: [
          { id: 'date-1', date: '2025-01-15' },
          { id: 'date-2', date: '2025-01-16' },
        ],
        availabilities: [
          { date_option_id: 'date-1', user_id: 'user-1' },
          { date_option_id: 'date-2', user_id: 'user-2' },
        ],
      })
    ).toBe(false);
  });

  it('treats locked plans as confirmed regardless of counts', () => {
    expect(
      isPlanConfirmed({
        plan_type: 'fixed',
        status: 'locked',
        min_people: 10,
        rsvps: [],
      })
    ).toBe(true);
  });

  it('never confirms cancelled plans', () => {
    expect(
      isPlanConfirmed({
        plan_type: 'fixed',
        status: 'cancelled',
        min_people: 1,
        rsvps: [{ response: 'yes' }, { response: 'yes' }],
      })
    ).toBe(false);
  });

  it('handles missing rsvps/options', () => {
    expect(
      isPlanConfirmed({ plan_type: 'fixed', status: 'open', min_people: 2 })
    ).toBe(false);
    expect(
      isPlanConfirmed({ plan_type: 'flexible', status: 'open', min_people: 2 })
    ).toBe(false);
  });
});

// Shared by planGoingCount and planGoingPeople below: three dates, three
// people, and nobody free on the same evening as anybody else.
const threeDates: DateOption[] = [
  { id: 'date-1', date: '2025-01-15' },
  { id: 'date-2', date: '2025-01-16' },
  { id: 'date-3', date: '2025-01-17' },
];
const oneEach: Availability[] = [
  { date_option_id: 'date-1', user_id: 'user-1' },
  { date_option_id: 'date-2', user_id: 'user-2' },
  { date_option_id: 'date-3', user_id: 'user-3' },
];

describe('isVoteRunning', () => {
  it('is true only for a flexible plan still open', () => {
    expect(isVoteRunning({ plan_type: 'flexible', status: 'open' })).toBe(true);
    expect(isVoteRunning({ plan_type: 'flexible', status: 'locked' })).toBe(false);
    expect(isVoteRunning({ plan_type: 'flexible', status: 'cancelled' })).toBe(false);
    expect(isVoteRunning({ plan_type: 'fixed', status: 'open' })).toBe(false);
    expect(isVoteRunning({ plan_type: 'fixed', status: 'locked' })).toBe(false);
  });

  it('treats a missing status as no vote running', () => {
    expect(isVoteRunning({ plan_type: 'flexible' })).toBe(false);
    expect(isVoteRunning({ plan_type: 'flexible', status: null })).toBe(false);
  });
});

describe('goingLabel', () => {
  it('counts up to the minimum, then says how many are going', () => {
    expect(goingLabel(0, 3)).toBe('0 of 3 needed');
    expect(goingLabel(2, 3)).toBe('2 of 3 needed');
    expect(goingLabel(3, 3)).toBe('3 going');
    expect(goingLabel(5, 3)).toBe('5 going');
  });

  it('reads sensibly at the edges', () => {
    expect(goingLabel(1, 1)).toBe('1 going');
    expect(goingLabel(0, 0)).toBe('0 going');
  });
});

describe('planGoingCount', () => {
  it('counts yes-RSVPs on a fixed plan', () => {
    expect(
      planGoingCount({
        plan_type: 'fixed',
        status: 'open',
        min_people: 3,
        rsvps: [{ response: 'yes' }, { response: 'yes' }, { response: 'no' }],
      })
    ).toBe(2);
  });

  it('is zero for a fixed plan nobody has answered', () => {
    expect(
      planGoingCount({
        plan_type: 'fixed',
        status: 'open',
        min_people: 3,
        rsvps: [{ response: null }, { response: 'no' }],
      })
    ).toBe(0);
  });

  it('counts yes-RSVPs on a locked flexible plan, not the wider availability', () => {
    expect(
      planGoingCount({
        plan_type: 'flexible',
        status: 'locked',
        min_people: 3,
        rsvps: [{ response: 'yes' }, { response: 'no' }],
        dateOptions: threeDates,
        availabilities: oneEach,
      })
    ).toBe(1);
  });

  it('is 1, not 3, when three people are each free on a different date', () => {
    const data = {
      plan_type: 'flexible' as const,
      status: 'open',
      min_people: 3,
      dateOptions: threeDates,
      availabilities: oneEach,
    };

    expect(planGoingCount(data)).toBe(1);
    expect(isPlanConfirmed(data)).toBe(false);
  });

  it('reports the best single date, not the union', () => {
    expect(
      planGoingCount({
        plan_type: 'flexible',
        status: 'open',
        min_people: 3,
        dateOptions: threeDates,
        availabilities: [
          { date_option_id: 'date-1', user_id: 'user-1' },
          { date_option_id: 'date-1', user_id: 'user-2' },
          { date_option_id: 'date-3', user_id: 'user-3' },
        ],
      })
    ).toBe(2);
  });

  it('agrees with isPlanConfirmed once one date reaches the minimum', () => {
    const data = {
      plan_type: 'flexible' as const,
      status: 'open',
      min_people: 3,
      dateOptions: threeDates,
      availabilities: [
        { date_option_id: 'date-2', user_id: 'user-1' },
        { date_option_id: 'date-2', user_id: 'user-2' },
        { date_option_id: 'date-2', user_id: 'user-3' },
        { date_option_id: 'date-3', user_id: 'user-1' },
      ],
    };

    expect(planGoingCount(data)).toBe(3);
    expect(isPlanConfirmed(data)).toBe(true);
  });

  it('falls to the yes-count on a cancelled flexible plan', () => {
    expect(
      planGoingCount({
        plan_type: 'flexible',
        status: 'cancelled',
        min_people: 3,
        rsvps: [{ response: 'yes' }, { response: 'yes' }],
        dateOptions: threeDates,
        availabilities: oneEach,
      })
    ).toBe(2);
  });

  it('is zero for empty or missing inputs', () => {
    expect(planGoingCount({ plan_type: 'fixed', status: 'open', min_people: 2 })).toBe(0);
    expect(planGoingCount({ plan_type: 'flexible', status: 'open', min_people: 2 })).toBe(0);
    expect(
      planGoingCount({
        plan_type: 'flexible',
        status: 'open',
        min_people: 2,
        rsvps: [],
        dateOptions: [],
        availabilities: [],
      })
    ).toBe(0);
    expect(
      planGoingCount({
        plan_type: 'flexible',
        status: 'open',
        min_people: 2,
        dateOptions: threeDates,
        availabilities: [],
      })
    ).toBe(0);
  });
});

describe('planGoingPeople', () => {
  const named = (id: string, name: string) => ({ user_id: id, profile: { display_name: name } });

  it('is the union of everyone available while a flexible plan is open', () => {
    expect(
      planGoingPeople({
        plan_type: 'flexible',
        status: 'open',
        min_people: 3,
        dateOptions: threeDates,
        availabilities: [
          { date_option_id: 'date-1', ...named('user-1', 'Marta') },
          { date_option_id: 'date-2', ...named('user-2', 'Aina') },
          { date_option_id: 'date-3', ...named('user-3', 'Pau') },
        ],
      })
    ).toEqual([
      { id: 'user-1', name: 'Marta' },
      { id: 'user-2', name: 'Aina' },
      { id: 'user-3', name: 'Pau' },
    ]);
  });

  it('dedupes someone free on two dates, keeping first-seen order', () => {
    expect(
      planGoingPeople({
        plan_type: 'flexible',
        status: 'open',
        min_people: 2,
        dateOptions: threeDates,
        availabilities: [
          { date_option_id: 'date-1', ...named('user-2', 'Aina') },
          { date_option_id: 'date-2', ...named('user-1', 'Marta') },
          { date_option_id: 'date-3', ...named('user-2', 'Aina') },
        ],
      })
    ).toEqual([
      { id: 'user-2', name: 'Aina' },
      { id: 'user-1', name: 'Marta' },
    ]);
  });

  it('ignores rsvps while a flexible plan is open', () => {
    expect(
      planGoingPeople({
        plan_type: 'flexible',
        status: 'open',
        min_people: 2,
        rsvps: [{ ...named('user-9', 'Nobody'), response: 'yes' }],
        dateOptions: threeDates,
        availabilities: [{ date_option_id: 'date-1', ...named('user-1', 'Marta') }],
      }).map((p) => p.id)
    ).toEqual(['user-1']);
  });

  it('is the yes-RSVPs on a fixed plan, excluding no and pending', () => {
    expect(
      planGoingPeople({
        plan_type: 'fixed',
        status: 'open',
        min_people: 2,
        rsvps: [
          { ...named('user-1', 'Marta'), response: 'yes' },
          { ...named('user-2', 'Aina'), response: 'no' },
          { ...named('user-3', 'Pau'), response: 'pending' },
          { ...named('user-4', 'Lucia'), response: null },
          { ...named('user-5', 'Alex'), response: 'yes' },
        ],
      })
    ).toEqual([
      { id: 'user-1', name: 'Marta' },
      { id: 'user-5', name: 'Alex' },
    ]);
  });

  it('is the yes-RSVPs on a locked flexible plan, not the availability union', () => {
    expect(
      planGoingPeople({
        plan_type: 'flexible',
        status: 'locked',
        min_people: 2,
        rsvps: [
          { ...named('user-1', 'Marta'), response: 'yes' },
          { ...named('user-2', 'Aina'), response: 'no' },
        ],
        dateOptions: threeDates,
        availabilities: [
          { date_option_id: 'date-1', ...named('user-1', 'Marta') },
          { date_option_id: 'date-2', ...named('user-2', 'Aina') },
          { date_option_id: 'date-3', ...named('user-3', 'Pau') },
        ],
      })
    ).toEqual([{ id: 'user-1', name: 'Marta' }]);
  });

  it('falls back to ? when a row carries no profile', () => {
    expect(
      planGoingPeople({
        plan_type: 'fixed',
        status: 'open',
        min_people: 2,
        rsvps: [
          { user_id: 'user-1', response: 'yes' },
          { user_id: 'user-2', response: 'yes', profile: null },
          { user_id: 'user-3', response: 'yes', profile: { display_name: null } },
        ],
      })
    ).toEqual([
      { id: 'user-1', name: '?' },
      { id: 'user-2', name: '?' },
      { id: 'user-3', name: '?' },
    ]);
  });

  it('skips yes rows with no user_id', () => {
    expect(
      planGoingPeople({
        plan_type: 'fixed',
        status: 'open',
        min_people: 2,
        rsvps: [{ response: 'yes' }, { ...named('user-1', 'Marta'), response: 'yes' }],
      })
    ).toEqual([{ id: 'user-1', name: 'Marta' }]);
  });

  it('is empty for empty or missing inputs', () => {
    expect(planGoingPeople({ plan_type: 'fixed', status: 'open', min_people: 2 })).toEqual([]);
    expect(planGoingPeople({ plan_type: 'flexible', status: 'open', min_people: 2 })).toEqual([]);
    expect(
      planGoingPeople({
        plan_type: 'flexible',
        status: 'open',
        min_people: 2,
        rsvps: [],
        dateOptions: [],
        availabilities: [],
      })
    ).toEqual([]);
  });
});

describe('isUserParticipating', () => {
  it('is true for a fixed plan only when the user said yes', () => {
    const rsvps = [
      { user_id: 'user-1', response: 'yes' },
      { user_id: 'user-2', response: 'no' },
    ];
    expect(
      isUserParticipating({ plan_type: 'fixed', rsvps }, 'user-1')
    ).toBe(true);
    expect(
      isUserParticipating({ plan_type: 'fixed', rsvps }, 'user-2')
    ).toBe(false);
  });

  it('is true for a flexible plan when the user marked any availability', () => {
    const availabilities = [{ date_option_id: 'date-1', user_id: 'user-1' }];
    expect(
      isUserParticipating({ plan_type: 'flexible', availabilities }, 'user-1')
    ).toBe(true);
    expect(
      isUserParticipating({ plan_type: 'flexible', availabilities }, 'user-2')
    ).toBe(false);
  });

  it('is false without a user id', () => {
    expect(isUserParticipating({ plan_type: 'fixed', rsvps: [] }, null)).toBe(
      false
    );
  });
});

describe('needsUserResponse', () => {
  it('is false for non-open plans', () => {
    expect(
      needsUserResponse(
        { plan_type: 'fixed', status: 'locked', rsvps: [] },
        'user-1'
      )
    ).toBe(false);
  });

  it('fixed: true when unanswered or response is null', () => {
    expect(
      needsUserResponse(
        { plan_type: 'fixed', status: 'open', rsvps: [] },
        'user-1'
      )
    ).toBe(true);
    expect(
      needsUserResponse(
        {
          plan_type: 'fixed',
          status: 'open',
          rsvps: [{ user_id: 'user-1', response: null }],
        },
        'user-1'
      )
    ).toBe(true);
    expect(
      needsUserResponse(
        {
          plan_type: 'fixed',
          status: 'open',
          rsvps: [{ user_id: 'user-1', response: 'no' }],
        },
        'user-1'
      )
    ).toBe(false);
  });

  it('flexible: false when declined, false when availability marked, true otherwise', () => {
    const base = { plan_type: 'flexible' as const, status: 'open' };
    expect(
      needsUserResponse(
        { ...base, rsvps: [{ user_id: 'user-1', response: 'no' }] },
        'user-1'
      )
    ).toBe(false);
    expect(
      needsUserResponse(
        {
          ...base,
          availabilities: [{ date_option_id: 'date-1', user_id: 'user-1' }],
        },
        'user-1'
      )
    ).toBe(false);
    expect(needsUserResponse({ ...base }, 'user-1')).toBe(true);
  });
});

describe('a pending row', () => {
  const waiting = [{ user_id: 'u1', response: 'pending', waitlist_seq: 1 }];

  it('stops the plan nagging you for an answer', () => {
    expect(
      needsUserResponse({ plan_type: 'fixed', status: 'open', rsvps: waiting }, 'u1')
    ).toBe(false);
  });

  it('does not make you a participant', () => {
    expect(
      isUserParticipating({ plan_type: 'fixed', rsvps: waiting }, 'u1')
    ).toBe(false);
  });
});

