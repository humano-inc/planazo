import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GroupRole } from '@planazo/shared';
import { supabase } from './supabase';
import { alertActionError } from './queryErrors';
import { useDismissTo } from './navigation';

/**
 * The invite sheet's cache entry, exported because two hooks write to it: this
 * one after sending invites, and `useGroupManage` after a removal, which
 * withdraws the invites that person sent. A key spelled out twice is a shared
 * cache entry only until one copy changes.
 */
export const groupInviteKey = (id: string) => ['group-invite-sheet', id];

/**
 * The group, who already has an invite pending, and the link, in one round.
 *
 * The code is no longer a column this client may read (PLA-49), so it arrives
 * from the RPC that checks membership and the who_can_invite dial. A refusal is
 * not thrown: the rest of the sheet, naming friends you can invite, still works
 * without a link to show. What it refused with is dropped on the floor — the
 * sheet says why in its own words.
 */
async function fetchInviteSheet(id: string) {
  const [groupRes, invitesRes, codeRes] = await Promise.all([
    supabase
      .from('groups')
      .select('id, name, join_mode, who_can_invite, group_members(user_id, role)')
      .eq('id', id)
      .single(),
    supabase.from('group_invites').select('invitee_id').eq('group_id', id).eq('status', 'pending'),
    supabase.rpc('get_group_invite_code', { p_group_id: id }),
  ]);
  if (groupRes.error) throw groupRes.error;
  if (invitesRes.error) throw invitesRes.error;
  return {
    ...groupRes.data,
    // `role` is CHECK-constrained text, which the generated types can only
    // call `string`. Narrowing here rather than at the call site is what keeps
    // the sheet from casting a shape this query already knows (usePlanDetail
    // does the same with `status` and `plan_type`).
    group_members: groupRes.data.group_members.map((m) => ({
      ...m,
      role: m.role as GroupRole,
    })),
    pendingInviteeIds: invitesRes.data.map((i) => i.invitee_id),
    inviteCode: codeRes.data,
  };
}

type InviteSheetData = Awaited<ReturnType<typeof fetchInviteSheet>>;

/**
 * What the invite sheet reads and writes: the group with its pending invites
 * and its link, resetting that link, and sending the invites the user picked.
 *
 * The picks stay with the screen — they are a selection, not a fetch — and
 * arrive at `sendInvites.mutate()` as its variables, the way useCreatePlan
 * takes the form's values.
 */
export function useGroupInvite(id: string) {
  const queryClient = useQueryClient();
  const leave = useDismissTo(`/(app)/group/${id}`);

  const { data: group } = useQuery({
    queryKey: groupInviteKey(id),
    queryFn: () => fetchInviteSheet(id),
    enabled: !!id,
  });

  const rotate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('rotate_invite_code', { p_group_id: id });
      if (error) throw error;
      return data;
    },
    // The RPC hands back the code it just minted, so the card can show it at
    // once. Invalidating instead would re-run all three calls in the queryFn,
    // and leave the link the admin is about to share blank until they land.
    onSuccess: (code) => {
      queryClient.setQueryData(groupInviteKey(id), (old: InviteSheetData | undefined) =>
        old ? { ...old, inviteCode: code } : old
      );
    },
    onError: alertActionError,
  });

  const sendInvites = useMutation({
    mutationFn: async (picks: string[]) => {
      await Promise.all(
        picks.map((invitee) =>
          supabase.rpc('invite_to_group', { p_group_id: id, p_invitee: invitee })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupInviteKey(id) });
      leave();
    },
    onError: alertActionError,
  });

  return { group, rotate, sendInvites };
}
