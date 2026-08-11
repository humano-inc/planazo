/**
 * THESIS: A private correspondence desk, not an analytics dashboard.
 * OWN-WORLD: Planazo sand, ink, orange, pink, sage, Young Serif, Instrument Sans.
 * STORY: Scan the queue, read one complete report, make one deliberate decision.
 * FIRST VIEWPORT: Unresolved queue on the left, message and screenshot evidence on the right.
 * FORM: Seed key 99876d52, position 5. A light-table evidence sheet beside a compact index.
 */
import { requireAppAdmin } from '@/lib/admin/auth';
import {
  createFeedbackScreenshotUrl,
  loadFeedbackCounts,
  loadFeedbackItems,
} from '@/lib/admin/feedback';
import { parseFeedbackFilter } from '@/lib/admin/feedback-utils';

import { FeedbackInbox } from './FeedbackInbox';
import { noticeFromSearchParameters, screenshotUrlFor } from './view';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FeedbackPage({ searchParams }: PageProps) {
  const parameters = await searchParams;
  const filter = parseFeedbackFilter(
    Array.isArray(parameters.status) ? parameters.status[0] : parameters.status,
  );
  const { email, supabase } = await requireAppAdmin();
  const [items, counts] = await Promise.all([
    loadFeedbackItems(supabase, filter),
    loadFeedbackCounts(supabase),
  ]);
  const selected = items[0] ?? null;
  const screenshotUrl = await screenshotUrlFor(selected, (path) =>
    createFeedbackScreenshotUrl(supabase, path),
  );

  return (
    <FeedbackInbox
      adminEmail={email}
      counts={counts}
      filter={filter}
      items={items}
      mobileDetail={false}
      notice={noticeFromSearchParameters(parameters)}
      screenshotUrl={screenshotUrl}
      selected={selected}
    />
  );
}
