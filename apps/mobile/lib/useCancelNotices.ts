import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@planazo/shared';
import { supabase } from './supabase';
import { alertActionError } from './queryErrors';
import { useAuthStore } from '../stores/authStore';

type Json = Database['public']['Tables']['notifications']['Row']['data'];

/** The cancelled plan a notice names, as the notice renders it. */
interface CancelledPlan {
  id: string;
  title: string;
  status: string;
  event_date: string | null;
  locked_date: string | null;
  cancel_reason: string | null;
  /** Null once the canceller deletes their account. */
  canceller: { display_name: string } | null;
}

export interface CancelNotice {
  noticeId: string;
  plan: CancelledPlan;
}

/**
 * The notices waiting above someone's feed. Called with no id it is the
 * prefix a cancellation invalidates, wherever it happened.
 */
export const cancelNoticesKey = (userId?: string) =>
  userId ? ['cancel-notices', userId] : ['cancel-notices'];

/**
 * 19e: a cancellation of a plan you'd said yes to earns one dismissable
 * notice above the feed. The unread plan_cancelled row *is* the pin — the
 * RPC only writes them for people who were in, and 24h clears it either way.
 *
 * Called by the feed screen, not the notices component, so the fetch starts
 * alongside the plans query instead of waiting behind it.
 */
export function useCancelNotices() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: cancelNoticesKey(user?.id),
    queryFn: async (): Promise<CancelNotice[]> => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: notes, error } = await supabase
        .from('notifications')
        .select('id, data, created_at')
        .eq('user_id', user!.id)
        .eq('type', 'plan_cancelled')
        .eq('read', false)
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // `notifications.data` is a jsonb bag the generated types can only call
      // `Json`. A plan_cancelled row always carries the plan it is about.
      const planIdOf = (note: { data: Json }) =>
        (note.data as { plan_id?: string } | null)?.plan_id;
      const planIds = [...new Set(notes.map(planIdOf).filter((id): id is string => !!id))];
      if (planIds.length === 0) return [];
      const { data: cancelledPlans, error: planError } = await supabase
        .from('plans')
        .select(
          'id, title, status, event_date, locked_date, cancel_reason, canceller:profiles!plans_cancelled_by_fkey(display_name)'
        )
        .in('id', planIds);
      if (planError) throw planError;
      const byId = new Map(cancelledPlans.map((p) => [p.id, p]));
      return notes
        .map((n) => ({ noticeId: n.id, plan: byId.get(planIdOf(n) ?? '') }))
        // A restored plan takes its notice with it
        .filter((n): n is CancelNotice => n.plan?.status === 'cancelled');
    },
    enabled: !!user,
  });

  const dismissNotice = useMutation({
    mutationFn: async (noticeId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', noticeId);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: cancelNoticesKey() }),
    onError: alertActionError,
  });

  return {
    notices: data ?? [],
    dismiss: (noticeId: string) => dismissNotice.mutate(noticeId),
  };
}
