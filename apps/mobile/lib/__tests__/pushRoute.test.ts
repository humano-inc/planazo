import { pushRoute } from '../pushRoute';

describe('pushRoute', () => {
  it('opens the plan for a push about a plan', () => {
    expect(pushRoute({ plan_id: 'p1', group_id: 'g1' })).toBe('/(app)/plan/p1');
  });

  it('opens the comments for a push about a comment', () => {
    expect(pushRoute({ plan_id: 'p1', group_id: 'g1', comment_id: 'c1' })).toBe(
      '/(app)/plan/p1/comments',
    );
  });

  it('opens the plan when the comment id is not a string', () => {
    expect(pushRoute({ plan_id: 'p1', comment_id: 7 })).toBe('/(app)/plan/p1');
  });

  it.each([
    ['no plan id', { group_id: 'g1' }],
    ['a comment with no plan', { comment_id: 'c1' }],
    ['a plan id that is not a string', { plan_id: 42 }],
    ['an empty payload', {}],
    ['no payload', undefined],
    ['a null payload', null],
  ])('goes nowhere for %s', (_name, data) => {
    expect(pushRoute(data)).toBeNull();
  });
});
