import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { supabase } from './supabase';
import { alertActionError } from './queryErrors';
import { groupManageQuery, invalidateGroup } from './groupManageQuery';
import { groupInviteKey } from './useGroupInvite';
import { usePendingRemoval } from './usePendingRemoval';
import { BLOCKED_QUERY_KEY, blockUser, fetchBlockedIds, unblockUser } from './moderation';
import { useAuthStore } from '../stores/authStore';

/**
 * Everything the Manage screen reads and writes about one group.
 *
 * The query already lived in `groupManageQuery` while its five mutations sat
 * inline in the screen, which is the half-extracted shape PLA-110 is about:
 * every one of those writes goes stale through the same caches, and
 * `invalidateGroup` can only keep Manage and Admins agreeing if the writes are
 * beside it. Leaving is routed here for the same reason it is in
 * `useCreatePlan` — the navigation is part of the action, not of the layout.
 *
 * What stays with the screen is what the screen alone knows: which row is
 * swiped open, and which confirmation sheet is up.
 */
export function useGroupManage(id: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const group = useQuery(groupManageQuery(id));

  const invalidate = () => invalidateGroup(queryClient, id);

  // Who this user has shut out (the shield rule: those people no longer see
  // this user's plans). Only ever their own list — RLS on blocked_users makes
  // any other answer impossible.
  const { data: blockedIds } = useQuery({
    queryKey: BLOCKED_QUERY_KEY,
    queryFn: fetchBlockedIds,
    enabled: !!user,
  });

  const setBlocked = useMutation({
    mutationFn: async ({ userId, blocked }: { userId: string; blocked: boolean }) => {
      if (!user) throw new Error('Not signed in');
      if (blocked) {
        await blockUser(user.id, userId);
      } else {
        await unblockUser(user.id, userId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BLOCKED_QUERY_KEY });
      // The block dissolves ties server-side (friendship, their place in this
      // user's upcoming plans), so anything derived from those refetches.
      queryClient.invalidateQueries({ queryKey: ['home-plans'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      invalidate();
    },
    onError: alertActionError,
  });

  // The RPC, not a delete: removing somebody also withdraws the invites they
  // sent and resets the link, so the way back in goes with them (PLA-49).
  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('remove_group_member', {
        p_group_id: id,
        p_user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupInviteKey(id) });
      invalidate();
    },
    onError: alertActionError,
  });

  const setAnyoneCanPost = useMutation({
    mutationFn: async (on: boolean) => {
      const { error } = await supabase.from('groups').update({ anyone_can_post: on }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: alertActionError,
  });

  const setNotify = useMutation({
    mutationFn: async (on: boolean) => {
      const { error } = await supabase.rpc('set_group_notify', {
        p_group_id: id,
        p_notify: on,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: alertActionError,
  });

  const leaveGroup = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('leave_group', { p_group_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['home-plans'] });
      router.navigate('/(app)/(tabs)/groups');
    },
    onError: alertActionError,
  });

  // The row leaves the list at once and the delete waits out the undo window,
  // so this is the removal the screen calls rather than the mutation above.
  const { pendingRemovalId, startRemoval } = usePendingRemoval(removeMember.mutate);

  return {
    group: group.data,
    isLoading: group.isLoading,
    isError: group.isError,
    error: group.error,
    refetch: group.refetch,
    blocked: new Set(blockedIds ?? []),
    setBlocked,
    setAnyoneCanPost,
    setNotify,
    leaveGroup,
    pendingRemovalId,
    startRemoval,
  };
}
