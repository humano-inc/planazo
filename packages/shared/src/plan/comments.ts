// The two comment rules a client has to know (PLA-152), mirroring the
// plan_comments_body_length constraint and can_comment_on_plan() in
// 20261105000000_plan_comments.sql. The database is the authority; these exist
// so a screen can decide what to draw rather than let someone find out by being
// refused.

/** The most a comment can hold once trimmed. */
export const COMMENT_MAX_LENGTH = 500;

/**
 * Whether the database will take this as a comment body.
 *
 * Counted in code points because that is what `char_length` counts. A string's
 * `length` counts UTF-16 units, which would call 300 emoji too long.
 */
export function isCommentBodyValid(body: string): boolean {
  const length = Array.from(body.trim()).length;
  return length >= 1 && length <= COMMENT_MAX_LENGTH;
}

/**
 * Whether a plan you can see takes new comments. It opens when the plan is
 * posted and never closes on its own: a plan that has passed still takes them,
 * and only calling it off stops them.
 */
export function canCommentOnPlan(plan: { status?: string | null }): boolean {
  return plan.status !== 'cancelled';
}
