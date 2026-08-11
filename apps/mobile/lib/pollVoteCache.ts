import type { PlanPollRow } from './usePlanPoll';

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

/** My vote replaced in one poll's votes; every other user's rows kept. */
function withMyVote<V extends { option_id: string; user_id: string }>(
  votes: V[],
  userId: string,
  mine: V | null
): V[] {
  const others = votes.filter((v) => v.user_id !== userId);
  return mine ? [...others, mine] : others;
}

/** The detail screen's poll rows with my vote applied to the target poll. */
export function applyVoteToPolls(
  polls: PlanPollRow[],
  { pollId, userId, optionId }: VoteIntent
): PlanPollRow[] {
  return polls.map((poll) =>
    poll.id === pollId
      ? {
          ...poll,
          plan_poll_votes: withMyVote(
            poll.plan_poll_votes,
            userId,
            // profile stays null: my own row always renders as "You", and
            // the settle-time refetch fills the real name for everyone else.
            optionId ? { option_id: optionId, user_id: userId, profile: null } : null
          ),
        }
      : poll
  );
}

/** The slice of a feed plan row this edit needs to see; the rest rides along. */
interface HomePlanSlice {
  id: string;
  plan_polls?: {
    id: string;
    plan_poll_votes: { option_id: string; user_id: string }[];
  }[] | null;
}

/** The feed's plan rows with my vote applied to the target plan's poll. */
export function applyVoteToHomePlans<P extends HomePlanSlice>(
  plans: P[],
  { planId, pollId, userId, optionId }: VoteIntent
): P[] {
  return plans.map((plan) => {
    if (plan.id !== planId || !plan.plan_polls) return plan;
    return {
      ...plan,
      plan_polls: plan.plan_polls.map((poll) =>
        poll.id === pollId
          ? {
              ...poll,
              plan_poll_votes: withMyVote(
                poll.plan_poll_votes,
                userId,
                optionId ? { option_id: optionId, user_id: userId } : null
              ),
            }
          : poll
      ),
    };
  });
}
