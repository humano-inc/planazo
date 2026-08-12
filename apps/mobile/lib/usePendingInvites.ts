import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from '../stores/authStore';

export interface PendingGroupInvite {
  id: string;
  createdAt: string;
  groupId: string;
  groupName: string;
  groupColor: string | null;
  groupImageUrl: string | null;
  inviterName: string;
  memberNames: string[];
}

export interface PendingFriendRequest {
  id: string;
  createdAt: string;
  personId: string;
  personName: string;
  personHandle: string | null;
  personAvatarUrl: string | null;
  sharedGroup: string | null;
}

/**
 * The two embeds the generated types call ambiguous: `group_invites` and
 * `friendships` each hold more than one foreign key into `profiles`, so
 * inference asks for a constraint hint. PostgREST resolves the
 * `alias:column(...)` form the selects below use, so the queries themselves
 * are fine; only the inference cannot follow them.
 */
interface InviterEnd {
  inviter: { display_name: string };
}
interface RequesterEnd {
  requester: { id: string; display_name: string; handle: string | null; avatar_url: string | null };
}

/**
 * Everything waiting on the user. Called with no id it is the prefix a write
 * to any invite or join request invalidates.
 */
export const invitesKey = (userId?: string) => (userId ? ['invites', userId] : ['invites']);

/**
 * Everything waiting on the user (18a row, 18b sheet, tab badge) reads this
 * one cache entry, so answering in the sheet drops the row and badge live.
 */
export function usePendingInvites() {
  const { user } = useAuthStore();

  const query = useQuery({
    queryKey: invitesKey(user?.id),
    queryFn: async () => {
      const [invitesRes, requestsRes, myGroupsRes] = await Promise.all([
        supabase
          .from('group_invites')
          .select(
            `id, created_at, group_id,
            groups:group_id(id, name, color, image_url, group_members(profile:profiles(display_name))),
            inviter:invited_by(display_name)`
          )
          .eq('invitee_id', user!.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('friendships')
          .select(
            `id, created_at,
            requester:requester_id(id, display_name, handle, avatar_url)`
          )
          .eq('addressee_id', user!.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('group_members')
          .select('group_id, groups:group_id(name, group_members(user_id))')
          .eq('user_id', user!.id),
      ]);
      if (invitesRes.error) throw invitesRes.error;
      if (requestsRes.error) throw requestsRes.error;
      if (myGroupsRes.error) throw myGroupsRes.error;

      // person id -> name of a group we share, for "both in X" on requests
      const sharedGroupOf: Record<string, string> = {};
      myGroupsRes.data.forEach((row) => {
        row.groups.group_members.forEach((m) => {
          if (m.user_id !== user!.id && !sharedGroupOf[m.user_id]) {
            sharedGroupOf[m.user_id] = row.groups.name;
          }
        });
      });

      const groupInvites: PendingGroupInvite[] = invitesRes.data.map((i) => ({
        id: i.id,
        createdAt: i.created_at ?? '',
        groupId: i.group_id,
        groupName: i.groups.name,
        groupColor: i.groups.color,
        groupImageUrl: i.groups.image_url,
        inviterName: (i as unknown as InviterEnd).inviter.display_name,
        memberNames: i.groups.group_members.map((m) => m.profile.display_name),
      }));

      const friendRequests: PendingFriendRequest[] = requestsRes.data.map((row) => {
        const r = row as unknown as RequesterEnd;
        return {
          id: row.id,
          createdAt: row.created_at ?? '',
          personId: r.requester.id,
          personName: r.requester.display_name,
          personHandle: r.requester.handle,
          personAvatarUrl: r.requester.avatar_url,
          sharedGroup: sharedGroupOf[r.requester.id] ?? null,
        };
      });

      return { groupInvites, friendRequests };
    },
    enabled: !!user,
  });

  const groupInvites = query.data?.groupInvites ?? [];
  const friendRequests = query.data?.friendRequests ?? [];
  return { ...query, groupInvites, friendRequests, count: groupInvites.length + friendRequests.length };
}
