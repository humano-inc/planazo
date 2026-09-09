import { useQuery } from '@tanstack/react-query';
import type { PlanAudience } from '@planazo/shared';
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
 * The feed's one fetch: every non-cancelled plan the user can see, with the
 * nested rows the cards derive from. Which plans that is belongs to the
 * database (can_view_plan, PLA-139): the plans of your groups, plus plans your
 * friends and their friends posted to you. The query lives here and the
 * screen derives from it (lib/feedDerived.ts), the same split as
 * usePlanDetail + planDerived.
 *
 * `plan_bridge` is a computed column: the mutual friend a friends-of-friends
 * plan reaches you through, null when there is nothing to say (PLA-140).
 */
export function useFeed() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: feedKey(user?.id),
    queryFn: async () => {
      if (!user?.id) throw new Error('the feed needs a signed-in user');
      const { data, error } = await supabase
        .from('plans')
        .select(
          // lib/pollVoteCache.ts patches the plan_polls embed optimistically
          // on a vote. The current vote makes its poll item disappear before
          // the receipt trigger and settle-time refetch arrive, so keep this
          // nested shape in step with that cache edit.
          `*, plan_bridge,
          groups(id, name, color),
          rsvps(user_id, response, waitlist_seq, profile:profiles(display_name)),
          plan_date_options(id, date, date_availability(user_id, profile:profiles(display_name))),
          plan_polls(id, question, created_at, plan_poll_options!plan_poll_options_poll_id_plan_id_fkey(id, label, position), plan_poll_votes(option_id, user_id), plan_poll_vote_receipts(user_id))`
        )
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (error) throw error;
      // `audience` is CHECK-constrained text the generated types can only
      // call `string`; narrowed here so the cards never see it widened.
      return data.map((plan) => ({ ...plan, audience: plan.audience as PlanAudience }));
    },
    enabled: !!user,
  });
}
