const FEEDBACK_KINDS = ['broken', 'idea', 'other'] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export type FeedbackForLinear = {
  id: string;
  kind: FeedbackKind;
  message: string;
  appVersion: string | null;
  deviceModel: string | null;
  createdAt: string;
};

type KindDetails = {
  label: string;
  name: string;
  fallbackTitle: string;
};

const KIND_DETAILS: Record<FeedbackKind, KindDetails> = {
  broken: {
    label: 'Bug',
    name: 'Something broken',
    fallbackTitle: 'Investigate a reported Planazo problem',
  },
  idea: {
    label: 'Feature',
    name: 'Idea',
    fallbackTitle: 'Consider a user idea for Planazo',
  },
  other: {
    label: 'Improvement',
    name: 'Other feedback',
    fallbackTitle: 'Review general Planazo feedback',
  },
};

const MAX_TITLE_LENGTH = 100;

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function escapeMarkdown(value: string) {
  return value.replace(/([\\`*_[\]{}()#+\-.!>|])/g, '\\$1');
}

function truncateTitle(value: string) {
  if (value.length <= MAX_TITLE_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}

export function isFeedbackKind(value: string): value is FeedbackKind {
  return FEEDBACK_KINDS.includes(value as FeedbackKind);
}

export function getFeedbackKindDetails(kind: FeedbackKind) {
  return KIND_DETAILS[kind];
}

export function buildLinearIssueTitle(feedback: FeedbackForLinear) {
  const summary = collapseWhitespace(feedback.message);
  return truncateTitle(summary || KIND_DETAILS[feedback.kind].fallbackTitle);
}

export function buildLinearIssueDescription(
  feedback: FeedbackForLinear,
  sourceUrl: string,
  screenshotAssetUrl: string | null,
) {
  const message = feedback.message.trim() || 'No written message was included.';
  const quotedMessage = message
    .split(/\r?\n/)
    .map((line) => `> ${escapeMarkdown(line) || ' '}`)
    .join('\n');
  const details = KIND_DETAILS[feedback.kind];
  const context = [
    `- Type: ${details.name}`,
    `- Submitted: ${feedback.createdAt}`,
    `- App version: ${escapeMarkdown(feedback.appVersion ?? 'Not recorded')}`,
    `- Device: ${escapeMarkdown(feedback.deviceModel ?? 'Not recorded')}`,
  ];
  const screenshot = screenshotAssetUrl
    ? `\n\n## Screenshot\n\n![Feedback screenshot](${screenshotAssetUrl})`
    : '';

  return [
    '## User feedback',
    '',
    quotedMessage,
    screenshot,
    '',
    '## Context',
    '',
    ...context,
    '',
    `[Open the original feedback in Planazo](${sourceUrl})`,
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}
