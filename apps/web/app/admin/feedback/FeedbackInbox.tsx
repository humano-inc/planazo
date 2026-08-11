import Link from 'next/link';

import type { FeedbackCounts, FeedbackItem } from '@/lib/admin/feedback';
import {
  FEEDBACK_FILTERS,
  feedbackDetailHref,
  feedbackSummary,
  type FeedbackFilter,
} from '@/lib/admin/feedback-utils';
import { getFeedbackKindDetails } from '@/lib/admin/linear-issue';

import { signOutAction } from '../actions';
import styles from '../admin.module.css';
import { dismissFeedbackAction, reopenFeedbackAction } from './actions';
import { ConfirmationButton } from './ConfirmationButton';

const FILTER_LABELS: Record<FeedbackFilter, string> = {
  unresolved: 'Unresolved',
  linear_issue: 'Linear issues',
  dismissed: 'Not doing',
};

const STATUS_LABELS: Record<FeedbackItem['resolution'], string> = {
  unresolved: 'Unresolved',
  creating_linear: 'Creation interrupted',
  linear_issue: 'Linear issue',
  dismissed: 'Not doing',
};

type Notice = {
  kind: 'error' | 'success' | 'warning';
  message: string;
  issue?: { identifier: string; url: string } | null;
} | null;

type FeedbackInboxProps = {
  adminEmail: string | null;
  counts: FeedbackCounts;
  filter: FeedbackFilter;
  items: FeedbackItem[];
  mobileDetail: boolean;
  notice: Notice;
  screenshotUrl: string | null;
  selected: FeedbackItem | null;
};

function formatSubmittedAt(value: string) {
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

function QueueItem({
  active,
  filter,
  item,
}: {
  active: boolean;
  filter: FeedbackFilter;
  item: FeedbackItem;
}) {
  const details = getFeedbackKindDetails(item.kind);

  return (
    <li>
      <Link
        aria-current={active ? 'page' : undefined}
        className={`${styles.queueItem} ${active ? styles.queueItemActive : ''}`}
        href={feedbackDetailHref(item.id, filter)}
      >
        <span className={`${styles.kindDot} ${styles[`kind_${item.kind}`]}`} aria-hidden="true" />
        <span className={styles.queueItemBody}>
          <span className={styles.queueItemMeta}>
            <span>{details.name}</span>
            <time dateTime={item.created_at}>{formatSubmittedAt(item.created_at)}</time>
          </span>
          <span className={styles.queueItemMessage}>{feedbackSummary(item)}</span>
          <span className={styles.queueItemSender}>{item.sender.displayName}</span>
        </span>
      </Link>
    </li>
  );
}

function NoticeBanner({ notice }: { notice: Notice }) {
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

function EmptyDetail({ filter }: { filter: FeedbackFilter }) {
  return (
    <div className={styles.emptyDetail}>
      <span className={styles.emptySeal} aria-hidden="true">
        ✓
      </span>
      <h2>{filter === 'unresolved' ? 'The inbox is clear.' : 'Nothing here yet.'}</h2>
      <p>
        {filter === 'unresolved'
          ? 'New feedback will arrive here with its screenshot and device context.'
          : `No feedback is currently marked as ${FILTER_LABELS[filter].toLowerCase()}.`}
      </p>
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

function FeedbackDetail({
  filter,
  item,
  notice,
  screenshotUrl,
}: {
  filter: FeedbackFilter;
  item: FeedbackItem;
  notice: Notice;
  screenshotUrl: string | null;
}) {
  const kind = getFeedbackKindDetails(item.kind);

  return (
    <article className={styles.evidenceSheet}>
      <Link className={styles.mobileBack} href={`/admin/feedback?status=${filter}`}>
        ← Feedback inbox
      </Link>

      <NoticeBanner notice={notice} />

      <header className={styles.evidenceHeader}>
        <div className={styles.evidenceLabels}>
          <span className={`${styles.kindBadge} ${styles[`kindBadge_${item.kind}`]}`}>
            {kind.name}
          </span>
          <span className={`${styles.statusBadge} ${styles[`status_${item.resolution}`]}`}>
            {STATUS_LABELS[item.resolution]}
          </span>
        </div>
        <h2>{feedbackSummary(item)}</h2>
        <p className={styles.submittedLine}>
          Submitted by {item.sender.displayName} on{' '}
          <time dateTime={item.created_at}>{formatSubmittedAt(item.created_at)}</time>
        </p>
      </header>

      <div className={styles.evidenceGrid}>
        <div className={styles.reportColumn}>
          <section className={styles.messageSection} aria-labelledby="message-heading">
            <h3 id="message-heading">Message</h3>
            <p className={!item.message.trim() ? styles.emptyMessage : undefined}>
              {item.message.trim() || 'No written message was included.'}
            </p>
          </section>

          <section className={styles.screenshotSection} aria-labelledby="screenshot-heading">
            <div className={styles.sectionHeadingRow}>
              <h3 id="screenshot-heading">Screenshot</h3>
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
        </div>

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
              <dt>App version</dt>
              <dd>{item.app_version ?? 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Device</dt>
              <dd>{item.device_model ?? 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Feedback ID</dt>
              <dd className={styles.feedbackId}>{item.id}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <footer className={styles.decisionFooter}>
        <div>
          <p className={styles.decisionLabel}>Decision</p>
          <p>
            {item.resolution === 'unresolved'
              ? 'Turn this evidence into work, or close it without adding to the backlog.'
              : item.resolution === 'creating_linear'
                ? 'The last Linear attempt did not finish cleanly. Check Linear before trying again.'
                : 'This feedback has been reviewed.'}
          </p>
        </div>
        <FeedbackActions item={item} />
      </footer>
    </article>
  );
}

export function FeedbackInbox({
  adminEmail,
  counts,
  filter,
  items,
  mobileDetail,
  notice,
  screenshotUrl,
  selected,
}: FeedbackInboxProps) {
  return (
    <main className={styles.adminPage}>
      <header className={styles.adminTopbar}>
        <div className={styles.topbarInner}>
          <div className={styles.adminBrand}>
            <Link href="/">Planazo</Link>
            <span>admin</span>
          </div>
          <div className={styles.adminAccount}>
            <span>{adminEmail}</span>
            <form action={signOutAction}>
              <button type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <div className={`${styles.workspace} ${mobileDetail ? styles.mobileDetail : ''}`}>
        <aside className={styles.queuePane} aria-label="Feedback queue">
          <div className={styles.queueHeader}>
            <div>
              <p className={styles.queueKicker}>Customer evidence</p>
              <h1>Feedback inbox</h1>
            </div>
            <span className={styles.unresolvedCount} aria-label={`${counts.unresolved} unresolved`}>
              {counts.unresolved}
            </span>
          </div>

          <nav className={styles.filters} aria-label="Feedback status">
            {FEEDBACK_FILTERS.map((candidate) => (
              <Link
                aria-current={filter === candidate ? 'page' : undefined}
                className={filter === candidate ? styles.filterActive : undefined}
                href={`/admin/feedback?status=${candidate}`}
                key={candidate}
              >
                <span>{FILTER_LABELS[candidate]}</span>
                <span>{counts[candidate]}</span>
              </Link>
            ))}
          </nav>

          {items.length ? (
            <ol className={styles.queueList}>
              {items.map((item) => (
                <QueueItem
                  active={selected?.id === item.id}
                  filter={filter}
                  item={item}
                  key={item.id}
                />
              ))}
            </ol>
          ) : (
            <div className={styles.emptyQueue}>
              <p>No {FILTER_LABELS[filter].toLowerCase()} feedback.</p>
            </div>
          )}
        </aside>

        <section className={styles.detailPane} aria-label="Selected feedback">
          {selected ? (
            <FeedbackDetail
              filter={filter}
              item={selected}
              notice={notice}
              screenshotUrl={screenshotUrl}
            />
          ) : (
            <EmptyDetail filter={filter} />
          )}
        </section>
      </div>
    </main>
  );
}
