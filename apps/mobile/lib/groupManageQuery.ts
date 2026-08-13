import type { QueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { keyFactory } from './queryKey';
import { groupsKey } from './useGroupRows';

/**
 * The heavy group read behind Manage and Admins. Called with no id it is the
 * prefix a write to any group invalidates.
 */
export const groupManageKey = keyFactory('group-manage');

/**
 * The group detail screen's own read: a different shape from the one above,
 * with the group's plans embedded. It lives here rather than beside that
 * screen because the query is declared inline in the screen and `lib/` may
 * not import a screen, and because `invalidateGroup` below already has to
 * name all three group caches in one place.
 */
export const groupDetailKey = keyFactory('group');

/**
 * The Manage screen's group query, shared with the Admins screen (PLA-50).
 *
 * One definition on purpose: both screens read `groupManageKey(id)`, and the
 * cache is only actually shared while the key and the select stay identical.
 * Two hand-maintained copies of this select would drift apart silently.
 */
export function groupManageQuery(id: string | undefined) {
  return {
    queryKey: groupManageKey(id),
    queryFn: async () => {
      // `enabled` below keeps this from running without an id; the guard is
      // what tells the typed client that.
      if (!id) throw new Error('groupManageQuery needs a group id');
      const { data, error } = await supabase
        .from('groups')
        .select(
          `id, name, color, anyone_can_post, who_can_invite, join_mode, created_by, city_id,
          city:cities(id, name),
          group_members(user_id, role, notify_new_plans, joined_at,
            profile:profiles(display_name, avatar_url))`
        )
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  };
}

/**
 * Every cache a membership or settings write goes stale through, in one place
 * for the same reason as the query above: Manage and Admins both mutate this
 * group, and a fourth key added to one screen must reach the other.
 */
export function invalidateGroup(queryClient: QueryClient, id: string | undefined): void {
  queryClient.invalidateQueries({ queryKey: groupManageKey(id) });
  queryClient.invalidateQueries({ queryKey: groupDetailKey(id) });
  queryClient.invalidateQueries({ queryKey: groupsKey() });
}
