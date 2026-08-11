import { describe, expect, it, vi } from 'vitest';

import {
  createLinearIssueFromFeedback,
  type LinearGateway,
  type ScreenshotFile,
} from './linear';
import type { FeedbackForLinear } from './linear-issue';

const feedback: FeedbackForLinear = {
  id: 'feedback-1',
  kind: 'idea',
  message: 'Let me copy a plan link after I create it.',
  appVersion: '1.2.3',
  deviceModel: 'iPhone 16',
  createdAt: '2026-08-11T12:00:00.000Z',
};

function makeGateway(): LinearGateway {
  return {
    resolveTarget: vi.fn().mockResolvedValue({ teamId: 'team-1', labelId: 'feature-label' }),
    prepareUpload: vi.fn().mockResolvedValue({
      assetUrl: 'https://uploads.linear.app/screenshot.png',
      uploadUrl: 'https://storage.example.com/upload',
      headers: { 'Content-Type': 'image/png' },
    }),
    putUpload: vi.fn().mockResolvedValue(undefined),
    createIssue: vi.fn().mockResolvedValue({
      id: 'issue-1',
      identifier: 'PLA-123',
      url: 'https://linear.app/fioris/issue/PLA-123/example',
    }),
  };
}

const screenshot: ScreenshotFile = {
  bytes: new Uint8Array([1, 2, 3]).buffer,
  contentType: 'image/png',
  filename: 'feedback.png',
};

describe('createLinearIssueFromFeedback', () => {
  it('uploads the screenshot before creating a labeled issue', async () => {
    const gateway = makeGateway();

    const issue = await createLinearIssueFromFeedback({
      feedback,
      gateway,
      screenshot,
      sourceUrl: 'https://planazo.me/admin/feedback/feedback-1',
    });

    expect(issue.identifier).toBe('PLA-123');
    expect(gateway.resolveTarget).toHaveBeenCalledWith('PLA', 'Feature');
    expect(gateway.prepareUpload).toHaveBeenCalledWith(screenshot);
    expect(gateway.putUpload).toHaveBeenCalled();
    expect(gateway.createIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        labelId: 'feature-label',
        title: feedback.message,
        description: expect.stringContaining(
          '![Feedback screenshot](https://uploads.linear.app/screenshot.png)',
        ),
      }),
    );
    expect(vi.mocked(gateway.putUpload).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(gateway.createIssue).mock.invocationCallOrder[0],
    );
  });

  it('creates an issue without upload calls when there is no screenshot', async () => {
    const gateway = makeGateway();

    await createLinearIssueFromFeedback({
      feedback,
      gateway,
      screenshot: null,
      sourceUrl: 'https://planazo.me/admin/feedback/feedback-1',
    });

    expect(gateway.prepareUpload).not.toHaveBeenCalled();
    expect(gateway.putUpload).not.toHaveBeenCalled();
    expect(gateway.createIssue).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.not.stringContaining('## Screenshot') }),
    );
  });

  it('does not create an issue when screenshot upload fails', async () => {
    const gateway = makeGateway();
    vi.mocked(gateway.putUpload).mockRejectedValue(new Error('upload failed'));

    await expect(
      createLinearIssueFromFeedback({
        feedback,
        gateway,
        screenshot,
        sourceUrl: 'https://planazo.me/admin/feedback/feedback-1',
      }),
    ).rejects.toThrow('upload failed');
    expect(gateway.createIssue).not.toHaveBeenCalled();
  });

  it('does not upload or create when the target team cannot be resolved', async () => {
    const gateway = makeGateway();
    vi.mocked(gateway.resolveTarget).mockRejectedValue(new Error('team missing'));

    await expect(
      createLinearIssueFromFeedback({
        feedback,
        gateway,
        screenshot,
        sourceUrl: 'https://planazo.me/admin/feedback/feedback-1',
      }),
    ).rejects.toThrow('team missing');
    expect(gateway.prepareUpload).not.toHaveBeenCalled();
    expect(gateway.createIssue).not.toHaveBeenCalled();
  });
});
