import { deriveFeedPollItems, type FeedPollSource } from '../feedPolls';

const source = (over: Partial<FeedPollSource> = {}): FeedPollSource => ({
  planId: 'plan-1',
  planTitle: 'Sunday roast',
  groupName: 'Domingueros',
  groupColor: '#F7B0DC',
  isPast: false,
  canVote: true,
  peopleIn: 4,
  polls: [
    {
      id: 'poll-film',
      question: 'Which film?',
      created_at: '2026-08-04T10:00:00Z',
      plan_poll_options: [
        { id: 'opt-heat', label: 'Heat', position: 1 },
        { id: 'opt-dune', label: 'Dune', position: 0 },
      ],
      plan_poll_votes: [
        { option_id: 'opt-dune', user_id: 'marta' },
        { option_id: 'opt-dune', user_id: 'aina' },
      ],
      plan_poll_vote_receipts: [],
    },
  ],
  ...over,
});

describe('deriveFeedPollItems', () => {
  it('builds every unanswered poll, newest first, with ordered tallies', () => {
    const older = source();
    const newer = source({
      planId: 'plan-2',
      planTitle: 'Beach day',
      polls: [
        {
          id: 'poll-food',
          question: 'What should we bring?',
          created_at: '2026-08-05T10:00:00Z',
          plan_poll_options: [{ id: 'opt-fruit', label: 'Fruit', position: 0 }],
          plan_poll_votes: [],
          plan_poll_vote_receipts: [],
        },
      ],
    });

    const result = deriveFeedPollItems([older, newer], 'me');

    expect(result.map((poll) => poll.id)).toEqual(['poll-food', 'poll-film']);
    expect(result[1]?.options).toEqual([
      { id: 'opt-dune', label: 'Dune', votes: 2 },
      { id: 'opt-heat', label: 'Heat', votes: 0 },
    ]);
    expect(result[1]?.caption).toBe('2 of 4 voted');
  });

  it('hides a poll as soon as the current vote reaches the optimistic cache', () => {
    const voted = source({
      polls: [
        {
          ...source().polls![0]!,
          plan_poll_votes: [{ option_id: 'opt-dune', user_id: 'me' }],
        },
      ],
    });

    expect(deriveFeedPollItems([voted], 'me')).toEqual([]);
  });

  it('keeps a cleared vote hidden when its durable receipt remains', () => {
    const cleared = source({
      polls: [
        {
          ...source().polls![0]!,
          plan_poll_votes: [],
          plan_poll_vote_receipts: [{ user_id: 'me' }],
        },
      ],
    });

    expect(deriveFeedPollItems([cleared], 'me')).toEqual([]);
  });

  it('does not turn a past or ineligible poll into a feed action', () => {
    expect(deriveFeedPollItems([source({ isPast: true }), source({ canVote: false })], 'me')).toEqual(
      []
    );
  });

  it('returns nothing before the viewer is known', () => {
    expect(deriveFeedPollItems([source()], undefined)).toEqual([]);
  });
});
