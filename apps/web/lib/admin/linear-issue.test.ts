import { describe, expect, it } from 'vitest';

import {
  buildLinearIssueDescription,
  buildLinearIssueTitle,
  getFeedbackKindDetails,
  isFeedbackKind,
  type FeedbackForLinear,
} from './linear-issue';

const feedback: FeedbackForLinear = {
  id: 'feedback-1',
  kind: 'broken',
  message: 'The invite sheet closes before I can share it.',
  appVersion: '1.2.3',
  deviceModel: 'iPhone 16',
  createdAt: '2026-08-11T12:00:00.000Z',
};

describe('feedback kind metadata', () => {
  it('recognizes only supported feedback kinds', () => {
    expect(isFeedbackKind('broken')).toBe(true);
    expect(isFeedbackKind('idea')).toBe(true);
    expect(isFeedbackKind('other')).toBe(true);
    expect(isFeedbackKind('moderation')).toBe(false);
  });

  it('maps each kind to its Linear label', () => {
    expect(getFeedbackKindDetails('broken').label).toBe('Bug');
    expect(getFeedbackKindDetails('idea').label).toBe('Feature');
    expect(getFeedbackKindDetails('other').label).toBe('Improvement');
  });
});

describe('Linear issue title', () => {
  it('uses a compact form of the user message', () => {
    expect(buildLinearIssueTitle({ ...feedback, message: '  Invite   sheet\ncloses  ' })).toBe(
      'Invite sheet closes',
    );
  });

  it('uses a kind-specific fallback for an empty message', () => {
    expect(buildLinearIssueTitle({ ...feedback, message: '' })).toBe(
      'Investigate a reported Planazo problem',
    );
  });

  it('limits long titles without cutting the issue into an invalid length', () => {
    const title = buildLinearIssueTitle({ ...feedback, message: 'x'.repeat(140) });
    expect(title).toHaveLength(100);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('Linear issue description', () => {
  it('includes feedback, device context, source, and screenshot', () => {
    const description = buildLinearIssueDescription(
      feedback,
      'https://planazo.me/admin/feedback/feedback-1',
      'https://uploads.linear.app/screenshot.png',
    );

    expect(description).toContain('> The invite sheet closes before I can share it\\.');
    expect(description).toContain('- Type: Something broken');
    expect(description).toContain('- App version: 1\\.2\\.3');
    expect(description).toContain('- Device: iPhone 16');
    expect(description).toContain(
      '![Feedback screenshot](https://uploads.linear.app/screenshot.png)',
    );
    expect(description).toContain(
      '[Open the original feedback in Planazo](https://planazo.me/admin/feedback/feedback-1)',
    );
  });

  it('states that no message was included and omits an absent screenshot', () => {
    const description = buildLinearIssueDescription(
      { ...feedback, message: '', appVersion: null, deviceModel: null },
      'https://planazo.me/admin/feedback/feedback-1',
      null,
    );

    expect(description).toContain('No written message was included');
    expect(description).toContain('App version: Not recorded');
    expect(description).not.toContain('## Screenshot');
  });

  it('escapes Markdown supplied by the user', () => {
    const description = buildLinearIssueDescription(
      { ...feedback, message: '![surprise](https://example.com/image.png)' },
      'https://planazo.me/admin/feedback/feedback-1',
      null,
    );

    expect(description).toContain(
      '> \\!\\[surprise\\]\\(https://example\\.com/image\\.png\\)',
    );
  });
});
