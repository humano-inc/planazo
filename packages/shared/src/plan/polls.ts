// The open question a plan can carry (PLA-47). Deliberately not part of
// PlanConfirmationData or isPlanConfirmed: a date option winning IS the plan,
// a film winning is a detail of a plan already happening, and a plan must
// never hang unconfirmed because nobody picked a bar.

import type { Availability, RsvpLike } from './types';

export interface PollOption {
  id: string;
  label: string;
  position: number;
}

export interface PollVote {
  option_id: string;
  user_id: string;
}

/** Votes per option id, zero-filled so every option renders a count. */
export function countPollVotes(
  options: PollOption[],
  votes: PollVote[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  options.forEach((o) => {
    counts[o.id] = 0;
  });
  votes.forEach((v) => {
    const current = counts[v.option_id];
    if (current !== undefined) counts[v.option_id] = current + 1;
  });
  return counts;
}

/**
 * Whether this user holds a pick — the client mirror of the SQL predicate
 * can_vote_plan_poll, kept in one place so the feed and the detail screen
 * cannot derive it differently (they briefly did, and one of them lied).
 * A pick belongs to the people who are in: a yes, availability on the
 * running date vote, or the plan's creator. No plan_type branching: the SQL
 * unions the two populations, so a locked flexible plan's promoted yes and
 * its leftover availability rows both count, exactly as the server sees
 * them. (Availability rows are always available=true in practice — the app
 * withdraws by deleting the row, never by flipping the flag.)
 */
export function canVoteOnPolls(
  data: {
    created_by?: string | null;
    rsvps?: RsvpLike[] | null;
    availabilities?: Availability[] | null;
  },
  userId: string | null | undefined
): boolean {
  if (!userId) return false;
  if (data.created_by === userId) return true;
  if ((data.rsvps ?? []).some((r) => r.user_id === userId && r.response === 'yes')) return true;
  return (data.availabilities ?? []).some((a) => a.user_id === userId);
}

/**
 * The poll denominator: how many people hold a pick. The same union
 * canVoteOnPolls tests one person against, counted — distinct, because on a
 * locked flexible plan the same person can appear as both a seeded yes and
 * an availability voter.
 */
export function pollPeopleIn(
  rsvps: RsvpLike[] | null | undefined,
  availabilities: Availability[] | null | undefined
): number {
  const ids = new Set<string>();
  (rsvps ?? []).forEach((r) => {
    if (r.response === 'yes' && r.user_id) ids.add(r.user_id);
  });
  (availabilities ?? []).forEach((a) => ids.add(a.user_id));
  return ids.size;
}

/**
 * The one sentence both poll surfaces say about turnout, so the feed card
 * and the plan screen cannot drift into "Nobody has voted" vs "Nobody's
 * voted". Screens append their own affordance ("tap to vote") after it.
 */
export function pollVotedPhrase(votedCount: number, peopleIn: number): string {
  if (votedCount === 0) return "Nobody's voted";
  if (votedCount >= peopleIn) return "Everyone's voted";
  return `${votedCount} of ${peopleIn} voted`;
}

/**
 * The option(s) holding the most votes, ties returned rather than resolved.
 * The UI badges leaders[0]; a caller that cares about the tie itself can see
 * it in the length. Zero votes everywhere means no leader at all, not
 * "everything leads".
 */
export function pollLeaders(
  options: PollOption[],
  votes: PollVote[]
): { leaders: PollOption[]; maxVotes: number } {
  const counts = countPollVotes(options, votes);
  const maxVotes = Math.max(0, ...Object.values(counts));
  if (maxVotes === 0) return { leaders: [], maxVotes: 0 };
  return {
    leaders: options
      .filter((o) => counts[o.id] === maxVotes)
      .sort((a, b) => a.position - b.position),
    maxVotes,
  };
}
