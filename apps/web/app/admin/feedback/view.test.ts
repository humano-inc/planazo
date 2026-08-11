import { describe, expect, it } from 'vitest';

import type { FeedbackItem } from '@/lib/admin/feedback';

import { noticeFromSearchParameters, screenshotUrlsFor } from './view';

describe('noticeFromSearchParameters', () => {
  it('gives errors precedence over success messages', () => {
    expect(
      noticeFromSearchParameters({ error: 'Creation failed.', saved: 'linear' }),
    ).toEqual({ kind: 'error', message: 'Creation failed.' });
  });

  it.each([
    ['linear', 'Linear issue created and linked.'],
    ['dismissed', 'Marked as not doing.'],
    ['reopened', 'Returned to unresolved.'],
  ])('turns the %s result into a success notice', (saved, message) => {
    expect(noticeFromSearchParameters({ saved })).toEqual({ kind: 'success', message });
  });

  it('keeps a valid Linear link when persistence failed', () => {
    expect(
      noticeFromSearchParameters({
        linking: 'failed',
        created: 'PLA-123',
        createdUrl: 'https://linear.app/fioris/issue/PLA-123/example',
      }),
    ).toMatchObject({
      kind: 'warning',
      issue: {
        identifier: 'PLA-123',
        url: 'https://linear.app/fioris/issue/PLA-123/example',
      },
    });
  });

  it('rejects a forged issue link while preserving the warning', () => {
    expect(
      noticeFromSearchParameters({
        linking: 'failed',
        created: 'PLA-123',
        createdUrl: 'javascript:alert(1)',
      }),
    ).toMatchObject({ kind: 'warning', issue: null });
  });

  it('returns no notice without a recognized result', () => {
    expect(noticeFromSearchParameters({})).toBeNull();
    expect(noticeFromSearchParameters({ saved: 'unknown' })).toBeNull();
  });
});

describe('screenshotUrlsFor', () => {
  const item = { id: 'feedback-1' } as FeedbackItem;

  it('returns the batch of signed URLs', async () => {
    const createUrls = async () => ({ 'feedback-1': 'https://example.com/signed.png' });

    await expect(screenshotUrlsFor([item], createUrls)).resolves.toEqual({
      'feedback-1': 'https://example.com/signed.png',
    });
  });

  it('does not call storage for an empty inbox', async () => {
    let called = false;
    const createUrls = async () => {
      called = true;
      return {};
    };

    await expect(screenshotUrlsFor([], createUrls)).resolves.toEqual({});
    expect(called).toBe(false);
  });

  it('keeps the inbox usable when screenshot signing fails', async () => {
    const error = new Error('storage unavailable');
    const originalConsoleError = console.error;
    const messages: unknown[][] = [];
    console.error = (...args: unknown[]) => messages.push(args);

    try {
      await expect(
        screenshotUrlsFor([item], async () => {
          throw error;
        }),
      ).resolves.toEqual({});
    } finally {
      console.error = originalConsoleError;
    }

    expect(messages).toEqual([['Could not sign feedback screenshots.', error]]);
  });
});
