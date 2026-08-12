import type { PlanStatus, PlanType } from '@planazo/shared';
import { supabase } from './supabase';

/**
 * The plan every plan screen reads. Called with no id it is the prefix a write
 * to any plan invalidates.
 */
export const planDetailKey = (id?: string) => (id ? ['plan', id] : ['plan']);

/**
 * The plan detail row, shared by the detail screen, Edit and Cancel (PLA-116).
 *
 * The same shape three times over, which is what the cache sharing depends on:
 * Edit and Cancel warm themselves from the detail screen's entry, so a slimmer
 * select in either would clobber the joins the detail screen renders from
 * (creator, canceller, groups). Both files carried a comment warning about
 * exactly that, which is a rule three copies had to remember; now there is one
 * copy and nothing to remember.
 *
 * Spread it and override what differs. The detail screen waits on the user as
 * well as the id and says why at its call site; the other two do not.
 */
export function planDetailQuery(id: string | undefined) {
  return {
    queryKey: planDetailKey(id),
    queryFn: async () => {
      // `enabled` below keeps this from running without an id; the guard is
      // what tells the typed client that.
      if (!id) throw new Error('planDetailQuery needs a plan id');
      const { data, error } = await supabase
        .from('plans')
        .select(
          '*, creator:profiles!plans_created_by_fkey(display_name), canceller:profiles!plans_cancelled_by_fkey(display_name), groups(id, name, color)'
        )
        .eq('id', id)
        .single();
      if (error) throw error;
      // `status` and `plan_type` are CHECK-constrained text, which the
      // generated types can only call `string`. Narrowing at the query means
      // the screens and their cards never see the widened columns.
      return { ...data, status: data.status as PlanStatus, plan_type: data.plan_type as PlanType };
    },
    enabled: !!id,
  };
}
