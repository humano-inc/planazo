import { notFound } from 'next/navigation';

import { requireAppAdmin } from '@/lib/admin/auth';
import {
  createFeedbackScreenshotUrl,
  loadFeedbackCounts,
  loadFeedbackItem,
  loadFeedbackItems,
} from '@/lib/admin/feedback';
import { parseFeedbackFilter } from '@/lib/admin/feedback-utils';

import { FeedbackInbox } from '../FeedbackInbox';
import { noticeFromSearchParameters, screenshotUrlFor } from '../view';

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
  const [items, counts, selected] = await Promise.all([
    loadFeedbackItems(supabase, filter),
    loadFeedbackCounts(supabase),
    loadFeedbackItem(supabase, id),
  ]);

  if (!selected) {
    notFound();
  }

  const screenshotUrl = await screenshotUrlFor(selected, (path) =>
    createFeedbackScreenshotUrl(supabase, path),
  );

  return (
    <FeedbackInbox
      adminEmail={email}
      counts={counts}
      filter={filter}
      items={items}
      mobileDetail
      notice={noticeFromSearchParameters(parameters)}
      screenshotUrl={screenshotUrl}
      selected={selected}
    />
  );
}
