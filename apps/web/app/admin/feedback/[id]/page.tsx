import { notFound } from 'next/navigation';

import { requireAppAdmin } from '@/lib/admin/auth';
import {
  createFeedbackScreenshotUrls,
  loadFeedbackItems,
} from '@/lib/admin/feedback';
import { parseFeedbackFilter } from '@/lib/admin/feedback-utils';

import { FeedbackInbox } from '../FeedbackInbox';
import { noticeFromSearchParameters, screenshotUrlsFor } from '../view';

export const dynamic = 'force-dynamic';

type DetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FeedbackDetailPage({ params, searchParams }: DetailPageProps) {
  const [{ id }, parameters] = await Promise.all([params, searchParams]);
  const filter = parseFeedbackFilter(
    Array.isArray(parameters.status) ? parameters.status[0] : parameters.status,
  );
  const { email, supabase } = await requireAppAdmin();
  const items = await loadFeedbackItems(supabase);
  const selected = items.find((item) => item.id === id) ?? null;

  if (!selected) {
    notFound();
  }

  const screenshotUrls = await screenshotUrlsFor(items, (feedbackItems) =>
    createFeedbackScreenshotUrls(supabase, feedbackItems),
  );

  return (
    <FeedbackInbox
      adminEmail={email}
      filter={filter}
      items={items}
      key={`${filter}:${selected.id}`}
      mobileDetail
      notice={noticeFromSearchParameters(parameters)}
      screenshotUrls={screenshotUrls}
      selected={selected}
    />
  );
}
