import { describe, it, expect } from 'vitest';
import {
  countPollVotes,
  pollLeaders,
  canVoteOnPolls,
  pollPeopleIn,
  pollVotedPhrase,
} from './polls';
// The last case here asserts what confirmation must never read, so it needs
// both modules on purpose.
import { isPlanConfirmed } from './confirmation';

describe('polls (PLA-47)', () => {
  const options = [
    { id: 'opt-dune', label: 'Dune Part Two', position: 0 },
    { id: 'opt-sub', label: 'The Substance', position: 1 },
    { id: 'opt-anora', label: 'Anora', position: 2 },
  ];

  it('counts votes per option, zero-filled', () => {
    const votes = [
      { option_id: 'opt-dune', user_id: 'u1' },
      { option_id: 'opt-dune', user_id: 'u2' },
      { option_id: 'opt-anora', user_id: 'u3' },
    ];
    expect(countPollVotes(options, votes)).toEqual({
      'opt-dune': 2,
      'opt-sub': 0,
      'opt-anora': 1,
    });
  });

  it('ignores votes for options it was not given', () => {
    const votes = [{ option_id: 'opt-gone', user_id: 'u1' }];
    expect(countPollVotes(options, votes)).toEqual({
      'opt-dune': 0,
      'opt-sub': 0,
      'opt-anora': 0,
    });
  });

  it('names a single leader', () => {
    const votes = [
      { option_id: 'opt-sub', user_id: 'u1' },
      { option_id: 'opt-sub', user_id: 'u2' },
      { option_id: 'opt-dune', user_id: 'u3' },
    ];
    const { leaders, maxVotes } = pollLeaders(options, votes);
    expect(maxVotes).toBe(2);
    expect(leaders.map((o) => o.id)).toEqual(['opt-sub']);
  });

  it('returns a tie rather than resolving one', () => {
    const votes = [
      { option_id: 'opt-anora', user_id: 'u1' },
      { option_id: 'opt-dune', user_id: 'u2' },
    ];
    const { leaders, maxVotes } = pollLeaders(options, votes);
    expect(maxVotes).toBe(1);
    // In option order, not vote order
    expect(leaders.map((o) => o.id)).toEqual(['opt-dune', 'opt-anora']);
  });

  it('zero votes means no leader, not "everything leads"', () => {
    expect(pollLeaders(options, [])).toEqual({ leaders: [], maxVotes: 0 });
  });

  it('a pick belongs to the people who are in, plus the creator', () => {
    const data = {
      created_by: 'u-host',
      rsvps: [
        { user_id: 'u-yes', response: 'yes' },
        { user_id: 'u-no', response: 'no' },
      ],
      availabilities: [{ date_option_id: 'd1', user_id: 'u-avail' }],
    };
    expect(canVoteOnPolls(data, 'u-host')).toBe(true);
    expect(canVoteOnPolls(data, 'u-yes')).toBe(true);
    expect(canVoteOnPolls(data, 'u-avail')).toBe(true);
    expect(canVoteOnPolls(data, 'u-no')).toBe(false);
    expect(canVoteOnPolls(data, 'u-bystander')).toBe(false);
    expect(canVoteOnPolls(data, null)).toBe(false);
  });

  it('the denominator is the distinct union of yeses and availability voters', () => {
    // On a locked flexible plan the same person holds both a seeded yes and
    // their old availability rows; they count once.
    expect(
      pollPeopleIn(
        [
          { user_id: 'u1', response: 'yes' },
          { user_id: 'u2', response: 'no' },
        ],
        [
          { date_option_id: 'd1', user_id: 'u1' },
          { date_option_id: 'd1', user_id: 'u3' },
        ]
      )
    ).toBe(2);
    expect(pollPeopleIn(null, null)).toBe(0);
  });

  it('one turnout phrase for every surface', () => {
    expect(pollVotedPhrase(0, 5)).toBe("Nobody's voted");
    expect(pollVotedPhrase(3, 5)).toBe('3 of 5 voted');
    expect(pollVotedPhrase(5, 5)).toBe("Everyone's voted");
    // The creator's vote can outrun a denominator that doesn't count them.
    expect(pollVotedPhrase(6, 5)).toBe("Everyone's voted");
  });

  it('confirmation knows nothing about polls', () => {
    // The contract from the issue: a date option winning IS the plan, a film
    // winning is a detail of a plan already happening. If poll data ever
    // becomes an input to confirmation, this directive stops compiling.
    expect(
      // @ts-expect-error — poll state is deliberately not confirmation data
      isPlanConfirmed({ plan_type: 'fixed', status: 'open', min_people: 2, poll: { closed_at: null } })
    ).toBe(false);
  });
});
