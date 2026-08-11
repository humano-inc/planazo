import 'server-only';

import type { Tables } from '@planazo/shared';

import type { createSupabaseServerClient } from '@/lib/supabase/server';

import { isFeedbackKind, type FeedbackKind } from './linear-issue';
import {
  FEEDBACK_FILTERS,
  type FeedbackResolution,
} from './feedback-utils';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type FeedbackRow = Tables<'feedback'>;

export type FeedbackItem = Omit<FeedbackRow, 'kind' | 'resolution'> & {
  kind: FeedbackKind;
  resolution: FeedbackResolution;
  sender: {
    displayName: string;
    email: string | null;
  };
};

function isFeedbackResolution(value: string): value is FeedbackResolution {
  return [...FEEDBACK_FILTERS, 'creating_linear'].includes(value as FeedbackResolution);
}

function toFeedbackItem(
  row: FeedbackRow,
  profile: Pick<Tables<'profiles'>, 'display_name' | 'email'> | undefined,
): FeedbackItem {
  if (!isFeedbackKind(row.kind) || !isFeedbackResolution(row.resolution)) {
    throw new Error(`Feedback ${row.id} has an unsupported kind or resolution.`);
  }

  return {
    ...row,
    kind: row.kind,
    resolution: row.resolution,
    sender: {
      displayName: profile?.display_name ?? 'Planazo user',
      email: profile?.email ?? null,
    },
  };
}

async function attachProfiles(supabase: SupabaseServerClient, rows: FeedbackRow[]) {
  const userIds = [...new Set(rows.map((row) => row.user_id))];

  if (userIds.length === 0) {
    return [];
  }

  const profiles = await supabase
    .from('profiles')
    .select('id, display_name, email')
    .in('id', userIds);

  if (profiles.error) {
    throw profiles.error;
  }

  const byId = new Map(profiles.data.map((profile) => [profile.id, profile]));
  return rows.map((row) => toFeedbackItem(row, byId.get(row.user_id)));
}

export async function loadFeedbackItems(supabase: SupabaseServerClient) {
  const result = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: true });

  if (result.error) {
    throw result.error;
  }

  return attachProfiles(supabase, result.data);
}

export async function createFeedbackScreenshotUrls(
  supabase: SupabaseServerClient,
  items: FeedbackItem[],
) {
  const attachments = items.flatMap((item) =>
    item.screenshot_path ? [{ feedbackId: item.id, path: item.screenshot_path }] : [],
  );

  if (attachments.length === 0) {
    return {};
  }

  const result = await supabase.storage
    .from('feedback-screenshots')
    .createSignedUrls([...new Set(attachments.map(({ path }) => path))], 15 * 60);

  if (result.error) {
    throw result.error;
  }

  const urlByPath = new Map(
    result.data.flatMap(({ path, signedUrl }) =>
      path && signedUrl ? [[path, signedUrl] as const] : [],
    ),
  );

  return Object.fromEntries(
    attachments.flatMap(({ feedbackId, path }) => {
      const url = urlByPath.get(path);
      return url ? [[feedbackId, url]] : [];
    }),
  );
}

function contentTypeFromFilename(filename: string) {
  const extension = filename.split('.').pop()?.toLowerCase();

  if (extension === 'jpg' || extension === 'jpeg') {
    return 'image/jpeg';
  }

  if (extension === 'webp') {
    return 'image/webp';
  }

  return 'image/png';
}

export async function downloadFeedbackScreenshot(
  supabase: SupabaseServerClient,
  screenshotPath: string | null,
) {
  if (!screenshotPath) {
    return null;
  }

  const result = await supabase.storage.from('feedback-screenshots').download(screenshotPath);

  if (result.error) {
    throw result.error;
  }

  const filename = screenshotPath.split('/').pop() || 'feedback-screenshot.png';

  return {
    bytes: await result.data.arrayBuffer(),
    contentType: result.data.type || contentTypeFromFilename(filename),
    filename,
  };
}
