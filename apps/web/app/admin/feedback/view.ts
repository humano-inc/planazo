import type { FeedbackItem } from '@/lib/admin/feedback';

type SearchParameters = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeLinearIssue(value: { identifier?: string; url?: string }) {
  if (!value.identifier || !value.url) {
    return null;
  }

  try {
    const url = new URL(value.url);

    if (url.protocol !== 'https:' || url.hostname !== 'linear.app') {
      return null;
    }

    return { identifier: value.identifier, url: url.toString() };
  } catch {
    return null;
  }
}

export function noticeFromSearchParameters(parameters: SearchParameters) {
  const error = first(parameters.error);

  if (error) {
    return { kind: 'error' as const, message: error };
  }

  if (first(parameters.linking) === 'failed') {
    return {
      kind: 'warning' as const,
      message: 'The Linear issue was created, but Planazo could not save its link. Keep this item here to avoid a duplicate.',
      issue: safeLinearIssue({
        identifier: first(parameters.created),
        url: first(parameters.createdUrl),
      }),
    };
  }

  const saved = first(parameters.saved);

  if (saved === 'linear') {
    return { kind: 'success' as const, message: 'Linear issue created and linked.' };
  }

  if (saved === 'dismissed') {
    return { kind: 'success' as const, message: 'Marked as not doing.' };
  }

  if (saved === 'reopened') {
    return { kind: 'success' as const, message: 'Returned to unresolved.' };
  }

  return null;
}

export async function screenshotUrlFor(
  item: FeedbackItem | null,
  createUrl: (path: string | null) => Promise<string | null>,
) {
  if (!item) {
    return null;
  }

  try {
    return await createUrl(item.screenshot_path);
  } catch (error) {
    console.error(`Could not sign screenshot for feedback ${item.id}.`, error);
    return null;
  }
}
