import { describe, expect, it } from 'vitest';

import { noticeFromSearchParameters } from './view';

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
