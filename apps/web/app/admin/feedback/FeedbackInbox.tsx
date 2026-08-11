'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type MouseEvent } from 'react';

import type { FeedbackItem } from '@/lib/admin/feedback';
import {
  FEEDBACK_FILTERS,
  feedbackCounts,
  feedbackDetailHref,
  feedbackIdFromPathname,
  feedbackMatchesFilter,
  feedbackSummary,
  parseFeedbackFilter,
  shouldHandleInboxClick,
  type FeedbackFilter,
} from '@/lib/admin/feedback-utils';
import { getFeedbackKindDetails } from '@/lib/admin/linear-issue';

import { signOutAction } from '../actions';
import styles from '../admin.module.css';
import {
  FeedbackDetail,
  formatSubmittedAt,
  type FeedbackNotice,
} from './FeedbackDetail';

const FILTER_LABELS: Record<FeedbackFilter, string> = {
  unresolved: 'Unresolved',
  linear_issue: 'Linear issues',
  dismissed: 'Not doing',
};

type FeedbackInboxProps = {
  adminEmail: string | null;
  filter: FeedbackFilter;
  items: FeedbackItem[];
  mobileDetail: boolean;
  notice: FeedbackNotice;
  screenshotUrls: Record<string, string>;
  selected: FeedbackItem | null;
};

function QueueItem({
  active,
  filter,
  item,
  onSelect,
}: {
  active: boolean;
  filter: FeedbackFilter;
  item: FeedbackItem;
  onSelect: (item: FeedbackItem, event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const details = getFeedbackKindDetails(item.kind);

  return (
    <li>
      <Link
        aria-current={active ? 'page' : undefined}
        className={`${styles.queueItem} ${active ? styles.queueItemActive : ''}`}
        href={feedbackDetailHref(item.id, filter)}
        onClick={(event) => onSelect(item, event)}
        prefetch={false}
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

export function FeedbackInbox({
  adminEmail,
  filter,
  items,
  mobileDetail,
  notice,
  screenshotUrls,
  selected,
}: FeedbackInboxProps) {
  const [activeFilter, setActiveFilter] = useState(filter);
  const [selectedId, setSelectedId] = useState(selected?.id ?? null);
  const [showMobileDetail, setShowMobileDetail] = useState(mobileDetail);
  const detailPaneRef = useRef<HTMLElement>(null);
  const counts = feedbackCounts(items);
  const visibleItems = items.filter((item) => feedbackMatchesFilter(item, activeFilter));
  const activeItem =
    items.find((item) => item.id === selectedId) ?? visibleItems[0] ?? null;

  useEffect(() => {
    function syncWithHistory() {
      const parameters = new URLSearchParams(window.location.search);
      const nextFilter = parseFeedbackFilter(parameters.get('status') ?? undefined);
      const pathId = feedbackIdFromPathname(window.location.pathname);
      const fallback = items.find((item) => feedbackMatchesFilter(item, nextFilter));
      const nextId = pathId && items.some((item) => item.id === pathId) ? pathId : fallback?.id;

      setActiveFilter(nextFilter);
      setSelectedId(nextId ?? null);
      setShowMobileDetail(Boolean(pathId));
    }

    window.addEventListener('popstate', syncWithHistory);
    return () => window.removeEventListener('popstate', syncWithHistory);
  }, [items]);

  function selectFeedback(item: FeedbackItem, event: MouseEvent<HTMLAnchorElement>) {
    if (!shouldHandleInboxClick(event)) {
      return;
    }

    event.preventDefault();
    setSelectedId(item.id);
    setShowMobileDetail(true);
    window.history.pushState(null, '', feedbackDetailHref(item.id, activeFilter));
    detailPaneRef.current?.scrollTo({ top: 0 });
  }

  function selectFilter(candidate: FeedbackFilter, event: MouseEvent<HTMLAnchorElement>) {
    if (!shouldHandleInboxClick(event)) {
      return;
    }

    event.preventDefault();
    const nextItem = items.find((item) => feedbackMatchesFilter(item, candidate));
    setActiveFilter(candidate);
    setSelectedId(nextItem?.id ?? null);
    setShowMobileDetail(false);
    window.history.pushState(null, '', `/admin/feedback?status=${candidate}`);
    detailPaneRef.current?.scrollTo({ top: 0 });
  }

  function showQueue(event: MouseEvent<HTMLAnchorElement>) {
    if (!shouldHandleInboxClick(event)) {
      return;
    }

    event.preventDefault();
    setShowMobileDetail(false);
    window.history.pushState(null, '', `/admin/feedback?status=${activeFilter}`);
  }

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

      <div className={`${styles.workspace} ${showMobileDetail ? styles.mobileDetail : ''}`}>
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
                aria-current={activeFilter === candidate ? 'page' : undefined}
                className={activeFilter === candidate ? styles.filterActive : undefined}
                href={`/admin/feedback?status=${candidate}`}
                key={candidate}
                onClick={(event) => selectFilter(candidate, event)}
                prefetch={false}
              >
                <span>{FILTER_LABELS[candidate]}</span>
                <span>{counts[candidate]}</span>
              </Link>
            ))}
          </nav>

          {visibleItems.length ? (
            <ol className={styles.queueList}>
              {visibleItems.map((item) => (
                <QueueItem
                  active={activeItem?.id === item.id}
                  filter={activeFilter}
                  item={item}
                  key={item.id}
                  onSelect={selectFeedback}
                />
              ))}
            </ol>
          ) : (
            <div className={styles.emptyQueue}>
              <p>No {FILTER_LABELS[activeFilter].toLowerCase()} feedback.</p>
            </div>
          )}
        </aside>

        <section className={styles.detailPane} aria-label="Selected feedback" ref={detailPaneRef}>
          {activeItem ? (
            <FeedbackDetail
              filter={activeFilter}
              item={activeItem}
              notice={notice}
              onBack={showQueue}
              screenshotUrl={screenshotUrls[activeItem.id] ?? null}
            />
          ) : (
            <EmptyDetail filter={activeFilter} />
          )}
        </section>
      </div>
    </main>
  );
}
