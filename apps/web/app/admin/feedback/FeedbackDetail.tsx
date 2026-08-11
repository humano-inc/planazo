'use client';

import Link from 'next/link';
import type { MouseEvent } from 'react';

import type { FeedbackItem } from '@/lib/admin/feedback';
import type { FeedbackFilter } from '@/lib/admin/feedback-utils';
import { getFeedbackKindDetails } from '@/lib/admin/linear-issue';

import styles from '../admin.module.css';
import { dismissFeedbackAction, reopenFeedbackAction } from './actions';
import { ConfirmationButton } from './ConfirmationButton';

const STATUS_LABELS: Record<FeedbackItem['resolution'], string> = {
  unresolved: 'Unresolved',
  creating_linear: 'Creation interrupted',
  linear_issue: 'Linear issue',
  dismissed: 'Not doing',
};

export type FeedbackNotice = {
  kind: 'error' | 'success' | 'warning';
  message: string;
  issue?: { identifier: string; url: string } | null;
} | null;

export function formatSubmittedAt(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function NoticeBanner({ notice }: { notice: FeedbackNotice }) {
  if (!notice) {
    return null;
  }

  return (
    <div
      className={`${styles.notice} ${styles[`notice_${notice.kind}`]}`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
    >
      <span>{notice.message}</span>
      {notice.issue ? (
        <a href={notice.issue.url} rel="noreferrer" target="_blank">
          Open {notice.issue.identifier} ↗
        </a>
      ) : null}
    </div>
  );
}

function FeedbackActions({ item }: { item: FeedbackItem }) {
  if (item.resolution === 'unresolved') {
    return (
      <div className={styles.actionRow}>
        <ConfirmationButton feedbackId={item.id} mode="linear" />
        <form action={dismissFeedbackAction}>
          <input name="feedbackId" type="hidden" value={item.id} />
          <button className={styles.dismissAction} type="submit">
            Not going to deal with it
          </button>
        </form>
      </div>
    );
  }

  if (item.resolution === 'dismissed') {
    return (
      <form action={reopenFeedbackAction}>
        <input name="feedbackId" type="hidden" value={item.id} />
        <button className={styles.secondaryAction} type="submit">
          Mark unresolved
        </button>
      </form>
    );
  }

  if (item.resolution === 'creating_linear') {
    return <ConfirmationButton feedbackId={item.id} mode="reopen" />;
  }

  return item.linear_issue_url && item.linear_issue_identifier ? (
    <a
      className={styles.linearLinkButton}
      href={item.linear_issue_url}
      rel="noreferrer"
      target="_blank"
    >
      Open {item.linear_issue_identifier} in Linear ↗
    </a>
  ) : null;
}

type FeedbackDetailProps = {
  filter: FeedbackFilter;
  item: FeedbackItem;
  notice: FeedbackNotice;
  onBack: (event: MouseEvent<HTMLAnchorElement>) => void;
  screenshotUrl: string | null;
};

export function FeedbackDetail({
  filter,
  item,
  notice,
  onBack,
  screenshotUrl,
}: FeedbackDetailProps) {
  const kind = getFeedbackKindDetails(item.kind);

  return (
    <article className={styles.evidenceSheet} aria-label={`Feedback from ${item.sender.displayName}`}>
      <Link
        className={styles.mobileBack}
        href={`/admin/feedback?status=${filter}`}
        onClick={onBack}
        prefetch={false}
      >
        ← Feedback inbox
      </Link>

      <NoticeBanner notice={notice} />

      <header className={styles.evidenceHeader}>
        <div className={styles.evidenceMeta}>
          <div className={styles.evidenceLabels}>
            <span className={`${styles.kindBadge} ${styles[`kindBadge_${item.kind}`]}`}>
              {kind.name}
            </span>
            <span className={`${styles.statusBadge} ${styles[`status_${item.resolution}`]}`}>
              {STATUS_LABELS[item.resolution]}
            </span>
          </div>
          <time dateTime={item.created_at}>{formatSubmittedAt(item.created_at)}</time>
        </div>
        <p
          className={`${styles.feedbackMessage} ${!item.message.trim() ? styles.emptyMessage : ''}`}
        >
          {item.message.trim() || 'No written message was included.'}
        </p>
      </header>

      <div className={styles.evidenceGrid}>
        <section className={styles.screenshotSection} aria-labelledby="screenshot-heading">
          <div className={styles.sectionHeadingRow}>
            <h2 id="screenshot-heading">Screenshot</h2>
            {screenshotUrl ? (
              <a href={screenshotUrl} rel="noreferrer" target="_blank">
                Open full size ↗
              </a>
            ) : null}
          </div>
          {screenshotUrl ? (
            <a
              className={styles.screenshotFrame}
              href={screenshotUrl}
              rel="noreferrer"
              target="_blank"
            >
              {/* A short-lived private URL is intentionally rendered as a native image. */}
              <img alt="Screenshot attached to this feedback" src={screenshotUrl} />
            </a>
          ) : (
            <div className={styles.noScreenshot}>
              <span aria-hidden="true">No image</span>
              <p>
                {item.screenshot_path
                  ? 'The attached screenshot could not be loaded.'
                  : 'This feedback did not include a screenshot.'}
              </p>
            </div>
          )}
        </section>

        <aside className={styles.contextColumn} aria-label="Feedback context">
          <div className={styles.senderBlock}>
            <span className={styles.senderAvatar} aria-hidden="true">
              {initials(item.sender.displayName) || 'P'}
            </span>
            <div>
              <strong>{item.sender.displayName}</strong>
              <span>{item.sender.email ?? 'Email not recorded'}</span>
            </div>
          </div>

          <dl className={styles.contextList}>
            <div>
              <dt>Submitted</dt>
              <dd>{formatSubmittedAt(item.created_at)}</dd>
            </div>
            <div>
              <dt>App version</dt>
              <dd>{item.app_version ?? 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Device</dt>
              <dd>{item.device_model ?? 'Not recorded'}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <footer className={styles.decisionFooter}>
        <FeedbackActions item={item} />
      </footer>
    </article>
  );
}
