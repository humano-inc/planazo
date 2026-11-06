/**
 * How many comments the plan-detail card shows before it lets the total do the
 * talking.
 */
export const COMMENT_CARD_LATEST = 2;

export interface PlanComment {
  id: string;
  plan_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: { display_name: string; avatar_url: string | null };
}

export interface CommentsCard {
  /** Everything this viewer can read, which is not everything that exists. */
  total: number;
  /** Oldest first, the order the whole list reads in. */
  latest: PlanComment[];
}

/**
 * The card's query asks for the newest rows, because those are the ones it
 * wants. It shows them in the order the comments screen does, so the two never
 * disagree about which way a conversation runs.
 */
export function commentsCardFrom(newestFirst: PlanComment[], count: number | null): CommentsCard {
  return { total: count ?? newestFirst.length, latest: [...newestFirst].reverse() };
}

type CommentsCardState = 'hidden' | 'invite' | 'preview';

/**
 * What the plan-detail card draws. A total that has not arrived yet holds it
 * back, so a plan with comments never flashes an invitation to write the first
 * one. A cancelled plan takes no new comments, so an empty one has nothing to
 * invite and nothing to show.
 */
export function commentsCardState(
  total: number | undefined,
  isCancelled: boolean,
): CommentsCardState {
  if (total === undefined) return 'hidden';
  if (total > 0) return 'preview';
  return isCancelled ? 'hidden' : 'invite';
}

export function commentCountLabel(total: number): string {
  return total === 1 ? '1 comment' : `${total} comments`;
}

/** Yours to delete, anyone else's to report. */
export function commentAction(authorId: string, userId: string | undefined): 'delete' | 'report' {
  return authorId === userId ? 'delete' : 'report';
}

export function commentAuthorLabel(
  comment: Pick<PlanComment, 'author' | 'author_id'>,
  userId: string | undefined,
): string {
  return comment.author_id === userId ? 'You' : comment.author.display_name;
}
