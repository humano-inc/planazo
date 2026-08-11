// PLA-97: feedback stays invisible to ordinary app sessions, while the one
// app-level admin can read it, see the private screenshot and make only the
// explicit inbox decisions exposed by the narrow RPCs.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { TestBed, TestUser, ok } from './testbed';

const BUCKET = 'feedback-screenshots';
const bed = new TestBed();
let admin: TestUser;
let sender: TestUser;
let outsider: TestUser;
let feedbackId: string;
let screenshotPath: string;

const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9,
]);

beforeAll(async () => {
  [admin, sender, outsider] = await Promise.all([
    bed.createUser('Inbox Admin'),
    bed.createUser('Inbox Sender'),
    bed.createUser('Inbox Outsider'),
  ]);
  ok(await bed.service.from('app_admins').insert({ user_id: admin.id }));

  screenshotPath = `${sender.id}/integration-feedback.jpg`;
  const upload = await sender.client.storage
    .from(BUCKET)
    .upload(screenshotPath, JPEG, { contentType: 'image/jpeg' });
  expect(upload.error).toBeNull();

  feedbackId = randomUUID();
  const insert = await sender.client.from('feedback').insert({
    id: feedbackId,
    user_id: sender.id,
    kind: 'broken',
    message: 'The invite sheet closed before I could share it.',
    screenshot_path: screenshotPath,
    app_version: '1.0.0',
    device_model: 'iPhone 16',
  });
  expect(insert.error).toBeNull();
});

afterAll(async () => {
  await bed.service.storage.from(BUCKET).remove([screenshotPath]);
  await bed.dispose();
});

describe('feedback inbox access', () => {
  it('identifies only the app-level admin', async () => {
    expect(ok(await admin.client.rpc('is_app_admin'))).toBe(true);
    expect(ok(await sender.client.rpc('is_app_admin'))).toBe(false);
    expect(ok(await outsider.client.rpc('is_app_admin'))).toBe(false);
  });

  it('lets the admin read every feedback field while ordinary users see no rows', async () => {
    const row = ok(
      await admin.client.from('feedback').select('*').eq('id', feedbackId).single(),
    );

    expect(row).toMatchObject({
      user_id: sender.id,
      kind: 'broken',
      message: 'The invite sheet closed before I could share it.',
      screenshot_path: screenshotPath,
      resolution: 'unresolved',
    });
    expect(ok(await sender.client.from('feedback').select('id').eq('id', feedbackId))).toEqual([]);
    expect(ok(await outsider.client.from('feedback').select('id').eq('id', feedbackId))).toEqual(
      [],
    );
  });

  it('lets the admin sign the private screenshot URL and refuses an outsider', async () => {
    const allowed = await admin.client.storage.from(BUCKET).createSignedUrl(screenshotPath, 60);
    expect(allowed.error).toBeNull();
    expect(allowed.data?.signedUrl).toContain('/feedback-screenshots/');

    const denied = await outsider.client.storage.from(BUCKET).createSignedUrl(screenshotPath, 60);
    expect(denied.error).not.toBeNull();
    expect(denied.data).toBeNull();
  });
});

describe('feedback inbox decisions', () => {
  it('refuses state changes from an ordinary authenticated user', async () => {
    const denied = await outsider.client.rpc('dismiss_feedback', { p_feedback_id: feedbackId });
    expect(denied.error?.message).toMatch(/App admin access required/);

    const row = ok(
      await bed.service.from('feedback').select('resolution').eq('id', feedbackId).single(),
    );
    expect(row.resolution).toBe('unresolved');
  });

  it('marks an item not doing and can return it to unresolved', async () => {
    expect(ok(await admin.client.rpc('dismiss_feedback', { p_feedback_id: feedbackId }))).toBe(
      true,
    );
    expect(ok(await admin.client.rpc('dismiss_feedback', { p_feedback_id: feedbackId }))).toBe(
      false,
    );

    expect(ok(await admin.client.rpc('reopen_feedback', { p_feedback_id: feedbackId }))).toBe(
      true,
    );
    const row = ok(
      await admin.client.from('feedback').select('resolution').eq('id', feedbackId).single(),
    );
    expect(row.resolution).toBe('unresolved');
  });

  it('claims one Linear creation at a time and releases a failed attempt', async () => {
    expect(
      ok(await admin.client.rpc('claim_feedback_for_linear', { p_feedback_id: feedbackId })),
    ).toBe(true);
    expect(
      ok(await admin.client.rpc('claim_feedback_for_linear', { p_feedback_id: feedbackId })),
    ).toBe(false);

    expect(ok(await admin.client.rpc('dismiss_feedback', { p_feedback_id: feedbackId }))).toBe(
      false,
    );
    expect(
      ok(await admin.client.rpc('release_feedback_from_linear', { p_feedback_id: feedbackId })),
    ).toBe(true);
  });

  it('records the created Linear issue once and makes that outcome final', async () => {
    const linearId = '20000000-0000-4000-8000-000000000001';
    expect(
      ok(await admin.client.rpc('claim_feedback_for_linear', { p_feedback_id: feedbackId })),
    ).toBe(true);
    expect(
      ok(
        await admin.client.rpc('record_feedback_linear_issue', {
          p_feedback_id: feedbackId,
          p_linear_issue_id: linearId,
          p_linear_issue_identifier: 'PLA-123',
          p_linear_issue_url: 'https://linear.app/fioris/issue/PLA-123/example',
        }),
      ),
    ).toBe(true);

    const row = ok(
      await admin.client
        .from('feedback')
        .select('resolution, linear_issue_id, linear_issue_identifier, linear_issue_url')
        .eq('id', feedbackId)
        .single(),
    );
    expect(row).toEqual({
      resolution: 'linear_issue',
      linear_issue_id: linearId,
      linear_issue_identifier: 'PLA-123',
      linear_issue_url: 'https://linear.app/fioris/issue/PLA-123/example',
    });
    expect(ok(await admin.client.rpc('reopen_feedback', { p_feedback_id: feedbackId }))).toBe(
      false,
    );
    expect(
      ok(await admin.client.rpc('claim_feedback_for_linear', { p_feedback_id: feedbackId })),
    ).toBe(false);
  });
});
