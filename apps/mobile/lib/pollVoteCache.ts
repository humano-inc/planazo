import type { PollVote } from '@planazo/shared';
import type { PlanPollRow, PollVoteRow } from './usePlanPoll';

/**
 * Pure cache edits behind the optimistic poll vote (PLA-94). A tap must
 * highlight before the network answers, and the two caches that render a
 * poll — the detail screen's ['plan-poll', planId] rows and the feed's
 * ['home-plans'] rows with their embedded first poll — each need my vote
 * moved the same way: my old row out, my new pick in, null withdrawing.
 * Both return new arrays and never touch the input, because these run
 * against live react-query cache snapshots that rollback must restore.
 */

export interface VoteIntent {
  planId: string;
  pollId: string;
  userId: string;
  optionId: string | null;
}

/**
 * The target poll's votes with mine replaced — my old row out, `mine` in,
 * null withdrawing. Every other poll, and every other voter, kept as-is.
 */
function pollsWithMyVote<
  V extends { user_id: string },
  T extends { id: string; plan_poll_votes: V[] },
>(polls: T[], vote: { pollId: string; userId: string; mine: V | null }): T[] {
  return polls.map((poll) => {
    if (poll.id !== vote.pollId) return poll;
    const others = poll.plan_poll_votes.filter((v) => v.user_id !== vote.userId);
    return { ...poll, plan_poll_votes: vote.mine ? [...others, vote.mine] : others };
  });
}

/** The detail screen's poll rows with my vote applied to the target poll. */
export function applyVoteToPolls(
  polls: PlanPollRow[],
  { pollId, userId, optionId }: VoteIntent
): PlanPollRow[] {
  // profile stays null: my own row always renders as "You", and the
  // settle-time refetch fills the real name for everyone else.
  const mine: PollVoteRow | null = optionId
    ? { option_id: optionId, user_id: userId, profile: null }
    : null;
  return pollsWithMyVote(polls, { pollId, userId, mine });
}

/** The slice of a feed plan row this edit needs to see; the rest rides along. */
interface HomePlanSlice {
  id: string;
  plan_polls?: { id: string; plan_poll_votes: PollVote[] }[] | null;
}

/** The feed's plan rows with my vote applied to the target plan's poll. */
export function applyVoteToHomePlans<P extends HomePlanSlice>(
  plans: P[],
  { planId, pollId, userId, optionId }: VoteIntent
): P[] {
  return plans.map((plan) =>
    plan.id !== planId || !plan.plan_polls
      ? plan
      : {
          ...plan,
          plan_polls: pollsWithMyVote(plan.plan_polls, {
            pollId,
            userId,
            mine: optionId ? { option_id: optionId, user_id: userId } : null,
          }),
        }
  );
}
