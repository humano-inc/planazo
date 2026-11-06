import {
  commentAction,
  commentAuthorLabel,
  commentCountLabel,
  commentsCardFrom,
  commentsCardState,
  type PlanComment,
} from '../planComments';

const comment = (id: string): PlanComment => ({
  id,
  plan_id: 'p1',
  author_id: 'u-marta',
  body: `comment ${id}`,
  created_at: '2026-11-05T12:00:00Z',
  author: { display_name: 'Marta', avatar_url: null },
});

describe('commentsCardFrom', () => {
  it('reads oldest first, the way the whole list does', () => {
    const card = commentsCardFrom([comment('newest'), comment('older')], 7);
    expect(card.latest.map((c) => c.id)).toEqual(['older', 'newest']);
  });

  it('carries the total the query counted, not how many it returned', () => {
    expect(commentsCardFrom([comment('a'), comment('b')], 7).total).toBe(7);
  });

  it('falls back to the rows when no count came back', () => {
    expect(commentsCardFrom([comment('a')], null).total).toBe(1);
  });

  it('leaves the rows it was given alone', () => {
    const rows = [comment('newest'), comment('older')];
    commentsCardFrom(rows, 2);
    expect(rows.map((c) => c.id)).toEqual(['newest', 'older']);
  });
});

describe('commentsCardState', () => {
  it('holds back until the total has arrived, so a live plan never flashes the invitation', () => {
    expect(commentsCardState(undefined, false)).toBe('hidden');
    expect(commentsCardState(undefined, true)).toBe('hidden');
  });

  it('invites the first comment on a plan that is still on', () => {
    expect(commentsCardState(0, false)).toBe('invite');
  });

  it('hides on a cancelled plan with nothing on it', () => {
    expect(commentsCardState(0, true)).toBe('hidden');
  });

  it('previews whenever there is something to read, cancelled or not', () => {
    expect(commentsCardState(1, false)).toBe('preview');
    expect(commentsCardState(1, true)).toBe('preview');
  });
});

describe('commentCountLabel', () => {
  it.each([
    [0, '0 comments'],
    [1, '1 comment'],
    [2, '2 comments'],
  ])('%i', (total, expected) => {
    expect(commentCountLabel(total)).toBe(expected);
  });
});

describe('commentAction', () => {
  it('offers your own comment for deleting', () => {
    expect(commentAction('u-me', 'u-me')).toBe('delete');
  });

  it("offers anyone else's for reporting", () => {
    expect(commentAction('u-them', 'u-me')).toBe('report');
  });

  it('never offers a delete to a viewer it cannot identify', () => {
    expect(commentAction('u-them', undefined)).toBe('report');
  });
});

describe('commentAuthorLabel', () => {
  it('calls your own comment yours', () => {
    expect(commentAuthorLabel(comment('a'), 'u-marta')).toBe('You');
  });

  it("names everyone else's", () => {
    expect(commentAuthorLabel(comment('a'), 'u-me')).toBe('Marta');
  });
});
