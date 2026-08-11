import { describe, expect, it } from 'vitest';

import { feedbackDetailHref, feedbackSummary, parseFeedbackFilter } from './feedback-utils';

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
