import { countPollVotes, pollVotedPhrase } from '@planazo/shared';

interface FeedPollOptionRow {
  id: string;
  label: string;
  position: number;
}

interface FeedPollVoteRow {
  option_id: string;
  user_id: string;
}

interface FeedPollReceiptRow {
  user_id: string;
}

interface FeedPollRow {
  id: string;
  question: string;
  created_at: string;
  plan_poll_options: FeedPollOptionRow[];
  plan_poll_votes: FeedPollVoteRow[];
  plan_poll_vote_receipts?: FeedPollReceiptRow[] | null;
}

export interface FeedPollSource {
  planId: string;
  planTitle: string;
  /** What the plan is for: its group's name, or the audience (lib/planAudience.ts). */
  contextLabel: string;
  contextColor?: string | null;
  /** True when the slot draws the people mark rather than a group swatch. */
  contextPeople?: boolean;
  isPast: boolean;
  canVote: boolean;
  peopleIn: number;
  polls?: FeedPollRow[] | null;
}

export interface FeedPollItem {
  id: string;
  planId: string;
  planTitle: string;
  contextLabel: string;
  contextColor?: string | null;
  contextPeople?: boolean;
  question: string;
  createdAt: string;
  caption: string;
  options: { id: string; label: string; votes: number }[];
}

/**
 * The actionable poll items at the top of the feed. A current vote hides the
 * poll optimistically; its durable receipt keeps it hidden after that vote is
 * cleared on plan detail. Ineligible people still read the tally on detail,
 * but the feed only carries questions they can answer.
 */
export function deriveFeedPollItems(
  sources: FeedPollSource[],
  userId: string | null | undefined
): FeedPollItem[] {
  if (!userId) return [];

  return sources
    .flatMap((source) => {
      if (source.isPast || !source.canVote) return [];

      return (source.polls ?? []).flatMap((poll) => {
        const votes = poll.plan_poll_votes;
        const answered =
          votes.some((vote) => vote.user_id === userId) ||
          (poll.plan_poll_vote_receipts ?? []).some((receipt) => receipt.user_id === userId);
        if (answered) return [];

        const sortedOptions = [...poll.plan_poll_options].sort(
          (a, b) => a.position - b.position
        );
        const counts = countPollVotes(sortedOptions, votes);

        return [
          {
            id: poll.id,
            planId: source.planId,
            planTitle: source.planTitle,
            contextLabel: source.contextLabel,
            contextColor: source.contextColor,
            contextPeople: source.contextPeople,
            question: poll.question,
            createdAt: poll.created_at,
            caption: pollVotedPhrase(votes.length, source.peopleIn),
            options: sortedOptions.map((option) => ({
              id: option.id,
              label: option.label,
              votes: counts[option.id] ?? 0,
            })),
          },
        ];
      });
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
        a.id.localeCompare(b.id)
    );
}
