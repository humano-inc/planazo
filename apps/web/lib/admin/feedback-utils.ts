import type { FeedbackKind } from './linear-issue';

export const FEEDBACK_FILTERS = ['unresolved', 'linear_issue', 'dismissed'] as const;
export type FeedbackFilter = (typeof FEEDBACK_FILTERS)[number];
export type FeedbackResolution = FeedbackFilter | 'creating_linear';

type ResolvedFeedback = {
  resolution: FeedbackResolution;
};

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

export function feedbackMatchesFilter(
  item: ResolvedFeedback,
  filter: FeedbackFilter,
) {
  return filter === 'unresolved'
    ? item.resolution === 'unresolved' || item.resolution === 'creating_linear'
    : item.resolution === filter;
}

export function feedbackCounts(items: ResolvedFeedback[]) {
  return FEEDBACK_FILTERS.reduce(
    (counts, filter) => ({
      ...counts,
      [filter]: items.filter((item) => feedbackMatchesFilter(item, filter)).length,
    }),
    { unresolved: 0, linear_issue: 0, dismissed: 0 } as Record<FeedbackFilter, number>,
  );
}

export function feedbackIdFromPathname(pathname: string) {
  const match = pathname.match(/^\/admin\/feedback\/([^/]+)$/);

  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function shouldHandleInboxClick(event: {
  button: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}) {
  return (
    event.button === 0 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  );
}
