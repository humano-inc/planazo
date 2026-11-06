import { describe, expect, it } from 'vitest';
import { COMMENT_MAX_LENGTH, canCommentOnPlan, isCommentBodyValid } from './comments';

describe('isCommentBodyValid', () => {
  it('takes anything with something in it', () => {
    expect(isCommentBodyValid('a')).toBe(true);
    expect(isCommentBodyValid("I'll bring the speaker")).toBe(true);
  });

  it('refuses an empty body and one that is only whitespace', () => {
    expect(isCommentBodyValid('')).toBe(false);
    expect(isCommentBodyValid('   ')).toBe(false);
    expect(isCommentBodyValid('\n\t \r\n')).toBe(false);
    expect(isCommentBodyValid(' 　')).toBe(false);
  });

  it('allows the maximum and refuses one past it', () => {
    expect(isCommentBodyValid('a'.repeat(COMMENT_MAX_LENGTH))).toBe(true);
    expect(isCommentBodyValid('a'.repeat(COMMENT_MAX_LENGTH + 1))).toBe(false);
  });

  it('does not count the whitespace around the comment', () => {
    expect(isCommentBodyValid(`  ${'a'.repeat(COMMENT_MAX_LENGTH)}\n\n`)).toBe(true);
  });

  it('counts an emoji once, as the database does', () => {
    expect(isCommentBodyValid('🎉'.repeat(COMMENT_MAX_LENGTH))).toBe(true);
    expect(isCommentBodyValid('🎉'.repeat(COMMENT_MAX_LENGTH + 1))).toBe(false);
  });
});

describe('canCommentOnPlan', () => {
  it('stays open for a plan that is open or locked', () => {
    expect(canCommentOnPlan({ status: 'open' })).toBe(true);
    expect(canCommentOnPlan({ status: 'locked' })).toBe(true);
  });

  it('closes when the plan is called off', () => {
    expect(canCommentOnPlan({ status: 'cancelled' })).toBe(false);
  });
});
