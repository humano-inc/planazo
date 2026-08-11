import { applyVoteToHomePlans, applyVoteToPolls, type VoteIntent } from '../pollVoteCache';
import type { PlanPollRow } from '../usePlanPoll';

const intent = (over: Partial<VoteIntent> = {}): VoteIntent => ({
  planId: 'plan-1',
  pollId: 'poll-1',
  userId: 'me',
  optionId: 'opt-a',
  ...over,
});

describe('applyVoteToPolls', () => {
  const poll = (over: Partial<PlanPollRow> = {}): PlanPollRow => ({
    id: 'poll-1',
    question: 'Which film?',
    created_at: '2026-08-01T00:00:00Z',
    plan_poll_options: [
      { id: 'opt-a', label: 'Dune', position: 0 },
      { id: 'opt-b', label: 'Heat', position: 1 },
    ],
    plan_poll_votes: [],
    ...over,
  });

  it('casts a first vote', () => {
    const result = applyVoteToPolls([poll()], intent());
    expect(result[0]?.plan_poll_votes).toEqual([
      { option_id: 'opt-a', user_id: 'me', profile: null },
    ]);
  });

  it('moves an existing vote to the new option', () => {
    const start = poll({
      plan_poll_votes: [{ option_id: 'opt-b', user_id: 'me', profile: null }],
    });
    const result = applyVoteToPolls([start], intent({ optionId: 'opt-a' }));
    expect(result[0]?.plan_poll_votes).toEqual([
      { option_id: 'opt-a', user_id: 'me', profile: null },
    ]);
  });

  it('withdraws on a null optionId', () => {
    const start = poll({
      plan_poll_votes: [{ option_id: 'opt-a', user_id: 'me', profile: null }],
    });
    const result = applyVoteToPolls([start], intent({ optionId: null }));
    expect(result[0]?.plan_poll_votes).toEqual([]);
  });

  it('keeps every other user’s vote', () => {
    const start = poll({
      plan_poll_votes: [
        { option_id: 'opt-a', user_id: 'lucia', profile: { display_name: 'Lucia' } },
        { option_id: 'opt-b', user_id: 'me', profile: null },
      ],
    });
    const result = applyVoteToPolls([start], intent({ optionId: 'opt-a' }));
    expect(result[0]?.plan_poll_votes).toEqual([
      { option_id: 'opt-a', user_id: 'lucia', profile: { display_name: 'Lucia' } },
      { option_id: 'opt-a', user_id: 'me', profile: null },
    ]);
  });

  it('leaves other polls untouched', () => {
    const other = poll({ id: 'poll-2' });
    const result = applyVoteToPolls([poll(), other], intent());
    expect(result[1]).toBe(other);
  });

  it('does not mutate the input', () => {
    const start = poll({
      plan_poll_votes: [{ option_id: 'opt-b', user_id: 'me', profile: null }],
    });
    applyVoteToPolls([start], intent());
    expect(start.plan_poll_votes).toEqual([
      { option_id: 'opt-b', user_id: 'me', profile: null },
    ]);
  });
});

describe('applyVoteToHomePlans', () => {
  const plan = (over: Record<string, unknown> = {}) => ({
    id: 'plan-1',
    title: 'Padel',
    plan_polls: [
      {
        id: 'poll-1',
        plan_poll_votes: [] as { option_id: string; user_id: string }[],
      },
    ],
    ...over,
  });

  it('casts a first vote on the plan’s poll', () => {
    const result = applyVoteToHomePlans([plan()], intent());
    expect(result[0]?.plan_polls?.[0]?.plan_poll_votes).toEqual([
      { option_id: 'opt-a', user_id: 'me' },
    ]);
  });

  it('moves an existing vote and keeps other voters', () => {
    const start = plan({
      plan_polls: [
        {
          id: 'poll-1',
          plan_poll_votes: [
            { option_id: 'opt-a', user_id: 'lucia' },
            { option_id: 'opt-b', user_id: 'me' },
          ],
        },
      ],
    });
    const result = applyVoteToHomePlans([start], intent({ optionId: 'opt-a' }));
    expect(result[0]?.plan_polls?.[0]?.plan_poll_votes).toEqual([
      { option_id: 'opt-a', user_id: 'lucia' },
      { option_id: 'opt-a', user_id: 'me' },
    ]);
  });

  it('withdraws on a null optionId', () => {
    const start = plan({
      plan_polls: [
        { id: 'poll-1', plan_poll_votes: [{ option_id: 'opt-a', user_id: 'me' }] },
      ],
    });
    const result = applyVoteToHomePlans([start], intent({ optionId: null }));
    expect(result[0]?.plan_polls?.[0]?.plan_poll_votes).toEqual([]);
  });

  it('leaves other plans untouched', () => {
    const other = plan({ id: 'plan-2' });
    const result = applyVoteToHomePlans([plan(), other], intent());
    expect(result[1]).toBe(other);
  });

  it('skips a plan with no polls embedded', () => {
    const bare = { id: 'plan-1', title: 'Padel', plan_polls: null };
    const result = applyVoteToHomePlans([bare], intent());
    expect(result[0]).toBe(bare);
  });

  it('leaves a different poll on the same plan alone', () => {
    const start = plan({
      plan_polls: [
        { id: 'poll-9', plan_poll_votes: [{ option_id: 'opt-a', user_id: 'lucia' }] },
      ],
    });
    const result = applyVoteToHomePlans([start], intent());
    expect(result[0]?.plan_polls?.[0]?.plan_poll_votes).toEqual([
      { option_id: 'opt-a', user_id: 'lucia' },
    ]);
  });

  it('does not mutate the input', () => {
    const start = plan();
    applyVoteToHomePlans([start], intent());
    expect(start.plan_polls[0]?.plan_poll_votes).toEqual([]);
  });
});
