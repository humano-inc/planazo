import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { alertActionError } from './queryErrors';
import { groupManageQuery, invalidateGroup } from './groupManageQuery';

/**
 * Where a group meets, and moving it (PLA-88).
 *
 * The read is `groupManageQuery`, the same one Manage is already holding when
 * the sheet opens over it: one cache entry rather than a second select of the
 * same row that could disagree with it.
 *
 * The write is a plain update rather than an RPC. The `groups` UPDATE policy is
 * already `is_group_admin(id)` and the foreign key is already the value check,
 * so an RPC here would restate both in plpgsql and add a signature to keep in
 * step. It lives in this hook rather than in the sheet for the same reason the
 * other five group writes live in `useGroupManage`: they all go stale through
 * `invalidateGroup`, and a copy in a screen is the one that forgets a key.
 */
export function useGroupCity(id: string) {
  const queryClient = useQueryClient();
  const query = useQuery(groupManageQuery(id));

  const save = useMutation({
    mutationFn: async (cityId: string) => {
      const { error } = await supabase.from('groups').update({ city_id: cityId }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateGroup(queryClient, id),
    onError: alertActionError,
  });

  return { ...query, save };
}
