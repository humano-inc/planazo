'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { SITE_URL } from '@/lib/links';
import { requireAppAdmin } from '@/lib/admin/auth';
import { downloadFeedbackScreenshot } from '@/lib/admin/feedback';
import { createLinearIssueFromFeedback, type CreatedLinearIssue } from '@/lib/admin/linear';
import { createLinearGateway } from '@/lib/admin/linear.server';
import { isFeedbackKind } from '@/lib/admin/linear-issue';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function feedbackIdFrom(formData: FormData) {
  const id = String(formData.get('feedbackId') ?? '').trim();

  if (!UUID_PATTERN.test(id)) {
    throw new Error('That feedback item is invalid.');
  }

  return id;
}

function detailPath(id: string, parameters: Record<string, string>) {
  const query = new URLSearchParams(parameters);
  return `/admin/feedback/${encodeURIComponent(id)}?${query.toString()}`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.startsWith('Linear is not configured yet.')) {
    return error.message;
  }

  return 'The Linear issue could not be created. This feedback is still unresolved.';
}

async function releaseLinearClaim(
  supabase: Awaited<ReturnType<typeof requireAppAdmin>>['supabase'],
  feedbackId: string,
) {
  const release = await supabase.rpc('release_feedback_from_linear', {
    p_feedback_id: feedbackId,
  });

  if (release.error) {
    console.error('Could not release the feedback Linear claim.', release.error);
  }
}

function revalidateFeedbackInbox(feedbackId: string) {
  revalidatePath('/admin/feedback');
  revalidatePath(`/admin/feedback/${feedbackId}`);
}

export async function dismissFeedbackAction(formData: FormData) {
  const feedbackId = feedbackIdFrom(formData);
  const { supabase } = await requireAppAdmin();
  const result = await supabase.rpc('dismiss_feedback', { p_feedback_id: feedbackId });

  if (result.error) {
    throw result.error;
  }

  revalidateFeedbackInbox(feedbackId);

  if (!result.data) {
    redirect(detailPath(feedbackId, { status: 'unresolved', error: 'This item was already handled.' }));
  }

  redirect(detailPath(feedbackId, { status: 'dismissed', saved: 'dismissed' }));
}

export async function reopenFeedbackAction(formData: FormData) {
  const feedbackId = feedbackIdFrom(formData);
  const { supabase } = await requireAppAdmin();
  const result = await supabase.rpc('reopen_feedback', { p_feedback_id: feedbackId });

  if (result.error) {
    throw result.error;
  }

  revalidateFeedbackInbox(feedbackId);

  if (!result.data) {
    redirect(detailPath(feedbackId, { status: 'unresolved', error: 'This item cannot be reopened.' }));
  }

  redirect(detailPath(feedbackId, { status: 'unresolved', saved: 'reopened' }));
}

export async function createLinearIssueAction(formData: FormData) {
  const feedbackId = feedbackIdFrom(formData);
  const { supabase } = await requireAppAdmin();
  const claim = await supabase.rpc('claim_feedback_for_linear', { p_feedback_id: feedbackId });

  if (claim.error) {
    throw claim.error;
  }

  if (!claim.data) {
    redirect(
      detailPath(feedbackId, {
        status: 'unresolved',
        error: 'This item is already being handled or has been resolved.',
      }),
    );
  }

  let createdIssue: CreatedLinearIssue | null = null;
  let destination: string;

  try {
    const feedback = await supabase.from('feedback').select('*').eq('id', feedbackId).single();

    if (feedback.error) {
      throw feedback.error;
    }

    if (!isFeedbackKind(feedback.data.kind)) {
      throw new Error(`Unsupported feedback kind: ${feedback.data.kind}`);
    }

    const screenshot = await downloadFeedbackScreenshot(supabase, feedback.data.screenshot_path);
    const sourceUrl = new URL(`/admin/feedback/${feedbackId}`, SITE_URL).toString();

    createdIssue = await createLinearIssueFromFeedback({
      feedback: {
        id: feedback.data.id,
        kind: feedback.data.kind,
        message: feedback.data.message,
        appVersion: feedback.data.app_version,
        deviceModel: feedback.data.device_model,
        createdAt: feedback.data.created_at,
      },
      gateway: createLinearGateway(),
      screenshot,
      sourceUrl,
    });

    const record = await supabase.rpc('record_feedback_linear_issue', {
      p_feedback_id: feedbackId,
      p_linear_issue_id: createdIssue.id,
      p_linear_issue_identifier: createdIssue.identifier,
      p_linear_issue_url: createdIssue.url,
    });

    if (record.error || !record.data) {
      throw record.error ?? new Error('The Linear issue was created but could not be linked.');
    }

    destination = detailPath(feedbackId, {
      status: 'linear_issue',
      saved: 'linear',
    });
  } catch (error) {
    console.error('Could not create a Linear issue from feedback.', error);

    if (createdIssue) {
      destination = detailPath(feedbackId, {
        status: 'unresolved',
        linking: 'failed',
        created: createdIssue.identifier,
        createdUrl: createdIssue.url,
      });
    } else {
      await releaseLinearClaim(supabase, feedbackId);
      destination = detailPath(feedbackId, {
        status: 'unresolved',
        error: errorMessage(error),
      });
    }
  }

  revalidateFeedbackInbox(feedbackId);
  redirect(destination);
}
