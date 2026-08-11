import type { FeedbackKind } from './linear-issue';

export const FEEDBACK_FILTERS = ['unresolved', 'linear_issue', 'dismissed'] as const;
export type FeedbackFilter = (typeof FEEDBACK_FILTERS)[number];

export function parseFeedbackFilter(value: string | undefined): FeedbackFilter {
  return FEEDBACK_FILTERS.includes(value as FeedbackFilter)
    ? (value as FeedbackFilter)
    : 'unresolved';
}

export function feedbackSummary(item: { kind: FeedbackKind; message: string }) {
  const message = item.message.replace(/\s+/g, ' ').trim();

  if (message) {
    return message;
  }

  if (item.kind === 'broken') {
    return 'Problem reported without a message';
  }

  if (item.kind === 'idea') {
    return 'Idea submitted without a message';
  }

  return 'Feedback submitted without a message';
}

export function feedbackDetailHref(id: string, filter: FeedbackFilter) {
  return `/admin/feedback/${encodeURIComponent(id)}?status=${filter}`;
}
