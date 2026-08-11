/**
 * THESIS: A private correspondence desk, not an analytics dashboard.
 * OWN-WORLD: Planazo sand, ink, orange, pink, sage, Young Serif, Instrument Sans.
 * STORY: Scan the queue, read one complete report, make one deliberate decision.
 * FIRST VIEWPORT: Unresolved queue on the left, message and screenshot evidence on the right.
 * FORM: Seed key 99876d52, position 5. A light-table evidence sheet beside a compact index.
 */
import { requireAppAdmin } from '@/lib/admin/auth';
import {
  createFeedbackScreenshotUrls,
  loadFeedbackItems,
} from '@/lib/admin/feedback';
import {
  feedbackMatchesFilter,
  parseFeedbackFilter,
} from '@/lib/admin/feedback-utils';

import { FeedbackInbox } from './FeedbackInbox';
import { noticeFromSearchParameters, screenshotUrlsFor } from './view';

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
  const items = await loadFeedbackItems(supabase);
  const selected = items.find((item) => feedbackMatchesFilter(item, filter)) ?? null;
  const screenshotUrls = await screenshotUrlsFor(items, (feedbackItems) =>
    createFeedbackScreenshotUrls(supabase, feedbackItems),
  );

  return (
    <FeedbackInbox
      adminEmail={email}
      filter={filter}
      items={items}
      key={`${filter}:${selected?.id ?? 'empty'}`}
      mobileDetail={false}
      notice={noticeFromSearchParameters(parameters)}
      screenshotUrls={screenshotUrls}
      selected={selected}
    />
  );
}
