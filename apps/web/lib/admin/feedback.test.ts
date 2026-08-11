import { describe, expect, it } from 'vitest';

import {
  feedbackCounts,
  feedbackDetailHref,
  feedbackIdFromPathname,
  feedbackMatchesFilter,
  feedbackSummary,
  parseFeedbackFilter,
  shouldHandleInboxClick,
} from './feedback-utils';

describe('parseFeedbackFilter', () => {
  it.each(['unresolved', 'linear_issue', 'dismissed'] as const)(
    'keeps the supported %s filter',
    (filter) => {
      expect(parseFeedbackFilter(filter)).toBe(filter);
    },
  );

  it('defaults missing and unsupported filters to unresolved', () => {
    expect(parseFeedbackFilter(undefined)).toBe('unresolved');
    expect(parseFeedbackFilter('all')).toBe('unresolved');
    expect(parseFeedbackFilter('creating_linear')).toBe('unresolved');
  });
});

describe('feedbackSummary', () => {
  it('collapses whitespace in the submitted message', () => {
    expect(feedbackSummary({ kind: 'idea', message: '  Make\n sharing   easier. ' })).toBe(
      'Make sharing easier.',
    );
  });

  it('uses a useful fallback for every empty kind', () => {
    expect(feedbackSummary({ kind: 'broken', message: '' })).toBe(
      'Problem reported without a message',
    );
    expect(feedbackSummary({ kind: 'idea', message: '   ' })).toBe(
      'Idea submitted without a message',
    );
    expect(feedbackSummary({ kind: 'other', message: '\n' })).toBe(
      'Feedback submitted without a message',
    );
  });
});

describe('feedbackDetailHref', () => {
  it('keeps the active filter and encodes the feedback ID', () => {
    expect(feedbackDetailHref('feedback/one', 'dismissed')).toBe(
      '/admin/feedback/feedback%2Fone?status=dismissed',
    );
  });
});

describe('feedbackMatchesFilter', () => {
  it('keeps an interrupted Linear attempt in the unresolved queue', () => {
    expect(feedbackMatchesFilter({ resolution: 'creating_linear' }, 'unresolved')).toBe(true);
  });

  it.each([
    ['unresolved', 'linear_issue', false],
    ['linear_issue', 'linear_issue', true],
    ['dismissed', 'dismissed', true],
    ['dismissed', 'unresolved', false],
  ] as const)('matches %s feedback against %s as %s', (resolution, filter, expected) => {
    expect(feedbackMatchesFilter({ resolution }, filter)).toBe(expected);
  });
});

describe('feedbackCounts', () => {
  it('counts every status and folds interrupted creation into unresolved', () => {
    expect(
      feedbackCounts([
        { resolution: 'unresolved' },
        { resolution: 'creating_linear' },
        { resolution: 'linear_issue' },
        { resolution: 'dismissed' },
        { resolution: 'dismissed' },
      ]),
    ).toEqual({ unresolved: 2, linear_issue: 1, dismissed: 2 });
  });

  it('returns zeroes for an empty inbox', () => {
    expect(feedbackCounts([])).toEqual({ unresolved: 0, linear_issue: 0, dismissed: 0 });
  });
});

describe('feedbackIdFromPathname', () => {
  it('reads and decodes an item ID from the detail route', () => {
    expect(feedbackIdFromPathname('/admin/feedback/feedback%2Fone')).toBe('feedback/one');
  });

  it.each([
    '/admin/feedback',
    '/admin/feedback/',
    '/admin/feedback/one/more',
    '/admin/feedback/%E0%A4%A',
    '/support',
  ])('returns null for %s', (pathname) => {
    expect(feedbackIdFromPathname(pathname)).toBeNull();
  });
});

describe('shouldHandleInboxClick', () => {
  const plainClick = {
    button: 0,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  };

  it('handles an ordinary primary-button click locally', () => {
    expect(shouldHandleInboxClick(plainClick)).toBe(true);
  });

  it.each([
    { button: 1 },
    { altKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
  ])('leaves modified browser navigation alone for %o', (override) => {
    expect(shouldHandleInboxClick({ ...plainClick, ...override })).toBe(false);
  });
});
