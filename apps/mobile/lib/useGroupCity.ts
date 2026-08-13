import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { alertActionError, UserFacingError } from './queryErrors';
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
 *
 * It ends in a `select` because an UPDATE the policy filters to no rows is not
 * an error. PostgREST reports zero rows and `error: null`, so a bare update
 * would report a move that never happened: the caches would refetch, the sheet
 * would close, and the group would still be where it was.
 * `group-city.test.ts` drives exactly that write against a live database.
 */
export function useGroupCity(id: string) {
  const queryClient = useQueryClient();
  const query = useQuery(groupManageQuery(id));

  const save = useMutation({
    mutationFn: async (cityId: string) => {
      const { data, error } = await supabase
        .from('groups')
        .update({ city_id: cityId })
        .eq('id', id)
        .select('id');
      if (error) throw error;
      // `id` is readable: 20260807000000 revoked table-level SELECT on groups
      // and re-granted a column list that names it.
      if (data.length === 0) {
        throw new UserFacingError('Only an admin can move this group to another city.');
      }
    },
    onSuccess: () => invalidateGroup(queryClient, id),
    onError: alertActionError,
  });

  return { ...query, save };
}
