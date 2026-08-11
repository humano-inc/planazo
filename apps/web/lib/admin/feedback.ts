import 'server-only';

import type { Tables } from '@planazo/shared';

import type { createSupabaseServerClient } from '@/lib/supabase/server';

import { isFeedbackKind, type FeedbackKind } from './linear-issue';
import { FEEDBACK_FILTERS, type FeedbackFilter } from './feedback-utils';

type FeedbackResolution = FeedbackFilter | 'creating_linear';

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

export type FeedbackCounts = Record<FeedbackFilter, number>;

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

export async function loadFeedbackItems(
  supabase: SupabaseServerClient,
  filter: FeedbackFilter,
) {
  let query = supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: true });

  if (filter === 'unresolved') {
    query = query.in('resolution', ['unresolved', 'creating_linear']);
  } else {
    query = query.eq('resolution', filter);
  }

  const result = await query;

  if (result.error) {
    throw result.error;
  }

  return attachProfiles(supabase, result.data);
}

export async function loadFeedbackItem(supabase: SupabaseServerClient, id: string) {
  const result = await supabase.from('feedback').select('*').eq('id', id).maybeSingle();

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    return null;
  }

  const [item] = await attachProfiles(supabase, [result.data]);
  return item;
}

async function countFeedback(
  supabase: SupabaseServerClient,
  filter: FeedbackFilter,
) {
  let query = supabase.from('feedback').select('id', { count: 'exact', head: true });

  if (filter === 'unresolved') {
    query = query.in('resolution', ['unresolved', 'creating_linear']);
  } else {
    query = query.eq('resolution', filter);
  }

  const result = await query;

  if (result.error) {
    throw result.error;
  }

  return result.count ?? 0;
}

export async function loadFeedbackCounts(supabase: SupabaseServerClient) {
  const [unresolved, linearIssue, dismissed] = await Promise.all([
    countFeedback(supabase, 'unresolved'),
    countFeedback(supabase, 'linear_issue'),
    countFeedback(supabase, 'dismissed'),
  ]);

  return {
    unresolved,
    linear_issue: linearIssue,
    dismissed,
  } satisfies FeedbackCounts;
}

export async function createFeedbackScreenshotUrl(
  supabase: SupabaseServerClient,
  screenshotPath: string | null,
) {
  if (!screenshotPath) {
    return null;
  }

  const result = await supabase.storage
    .from('feedback-screenshots')
    .createSignedUrl(screenshotPath, 15 * 60);

  if (result.error) {
    throw result.error;
  }

  return result.data.signedUrl;
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
