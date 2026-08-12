import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { keyFactory } from './queryKey';
import { useAuthStore } from '../stores/authStore';

/**
 * The feed's cache key. `feedKey()` is every feed there is, which is what a
 * write to any plan invalidates; `feedKey(userId)` is one person's. Thirteen
 * files reached for the string before this existed — see lib/queryKey.ts.
 */
export const feedKey = keyFactory('home-plans');

/**
 * The feed's one fetch: every non-cancelled plan across the user's groups,
 * with the nested rows the cards derive from. The query lives here and the
 * screen derives from it (lib/feedDerived.ts), the same split as
 * usePlanDetail + planDerived.
 */
export function useFeed() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: feedKey(user?.id),
    queryFn: async () => {
      if (!user?.id) throw new Error('the feed needs a signed-in user');
      const { data: memberships, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;
      const groupIds = memberships.map((m) => m.group_id);
      if (groupIds.length === 0) return [];

      const { data, error } = await supabase
        .from('plans')
        .select(
          // lib/pollVoteCache.ts patches the plan_polls embed optimistically
          // on a vote. The current vote makes its poll item disappear before
          // the receipt trigger and settle-time refetch arrive, so keep this
          // nested shape in step with that cache edit.
          `*,
          groups(id, name, color),
          rsvps(user_id, response, waitlist_seq, profile:profiles(display_name)),
          plan_date_options(id, date, date_availability(user_id, profile:profiles(display_name))),
          plan_polls(id, question, created_at, plan_poll_options!plan_poll_options_poll_id_plan_id_fkey(id, label, position), plan_poll_votes(option_id, user_id), plan_poll_vote_receipts(user_id))`
        )
        .in('group_id', groupIds)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}
