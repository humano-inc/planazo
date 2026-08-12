import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { keyFactory } from './queryKey';
import { useAuthStore } from '../stores/authStore';
import { deriveGroupRows } from './groupRows';

/**
 * Everything the Groups tab knows about your groups. `groupsKey()` is the
 * prefix every group-shaped write invalidates; `groupsKey(userId)` is this
 * tab's own row set. `myGroupsKey` hangs off the same prefix on purpose, and
 * builds itself from this factory so it cannot drift out from under it.
 */
export const groupsKey = keyFactory('groups');

/**
 * The Groups tab's fetch: memberships, per-group member counts, and the open
 * plans still waiting on this user, derived into render-ready rows
 * (lib/groupRows.ts). Overlaps useMyGroups on purpose — see the note on
 * myGroupsKey for why the lighter query stays a separate child of ['groups'].
 */
export function useGroupRows() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: groupsKey(user?.id),
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from('group_members')
        .select('group_id, role, groups:group_id(id, name, color, image_url, created_at)')
        .eq('user_id', user!.id);
      if (error) throw error;

      const groupIds = memberships.map((m) => m.group_id);
      if (groupIds.length === 0) return [];

      const [countsRes, plansRes] = await Promise.all([
        supabase.from('group_members').select('group_id').in('group_id', groupIds),
        supabase
          .from('plans')
          .select(
            `id, group_id, plan_type, status, min_people,
            rsvps(user_id, response),
            plan_date_options(id, date, date_availability(user_id))`
          )
          .in('group_id', groupIds)
          .eq('status', 'open'),
      ]);
      if (countsRes.error) throw countsRes.error;
      if (plansRes.error) throw plansRes.error;

      return deriveGroupRows({
        memberships,
        memberRows: countsRes.data,
        plans: plansRes.data,
        userId: user!.id,
      });
    },
    enabled: !!user,
  });
}
