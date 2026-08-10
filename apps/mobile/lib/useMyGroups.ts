import { useQuery, type QueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from '../stores/authStore';

export interface MyGroup {
  id: string;
  name: string;
  color: string | null;
}

/**
 * Every read of this cache, under one name.
 *
 * The hook keys on `['my-groups', userId]`; this prefix matches every user's
 * entry, which is what an invalidation wants — the signed-in user is the only
 * one with an observer, and a stale entry for a signed-out account is worth
 * nothing anyway.
 */
export const MY_GROUPS_KEY = ['my-groups'] as const;

/**
 * How long "which groups am I in" is trusted without asking again.
 *
 * Membership changes are pushed here, not polled for: {@link
 * invalidateMyGroups} covers everything you do yourself, and `lib/realtime.ts`
 * covers what other people do to you. Five minutes is the backstop for a path
 * neither of those reaches, not the mechanism.
 */
export const MY_GROUPS_STALE_MS = 5 * 60_000;

/**
 * Say that your membership just changed.
 *
 * Call this next to the `['groups']` invalidation at every write that adds or
 * removes *you* from a group. It lives here because the key does: five call
 * sites spread across create, join-by-code, join-by-link, invite-accept and
 * leave already drifted apart once, which is the whole of PLA-78.
 *
 * Not needed for a write that changes somebody *else's* membership (removing a
 * member, approving a request). Their client hears it over realtime, and yours
 * has nothing to update.
 */
export function invalidateMyGroups(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: MY_GROUPS_KEY });
}

/**
 * The groups you're in, and whether we know yet.
 *
 * Three surfaces ask the same question and have to give the same answer: the
 * feed decides which empty state to show, the tab bar decides where "+" goes,
 * and the create sheet decides whether there is a plan to compose at all. A
 * plan can only go to a group, so "you're in none" is a state each of them has
 * to handle rather than a case that cannot happen (PLA-68). One query key
 * means they cannot disagree, and a screen that already warmed the cache does
 * not refetch.
 *
 * The tab bar mounts for the whole signed-in session, so this query always has
 * an observer. Under the app-wide `refetchOnWindowFocus: 'always'` (see
 * app/_layout.tsx) that meant one fetch per foreground, forever, for the most
 * static thing the app knows. Both settings below exist to undo that, and
 * neither works alone: `'always'` ignores staleTime by design, so dropping to
 * `true` is what lets the staleTime below be read at all (PLA-78).
 */
export function useMyGroups() {
  const { user } = useAuthStore();

  const { data, isPending } = useQuery({
    queryKey: ['my-groups', user?.id],
    staleTime: MY_GROUPS_STALE_MS,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<MyGroup[]> => {
      const { data: rows, error } = await supabase
        .from('group_members')
        .select('groups:group_id (id, name, color)')
        .eq('user_id', user!.id);
      if (error) throw error;
      return rows
        .map((row) => row.groups as unknown as MyGroup | null)
        .filter(Boolean) as MyGroup[];
    },
    enabled: !!user,
  });

  const groups = data ?? [];

  return {
    groups,
    hasGroups: groups.length > 0,
    // A disabled query stays `isPending` forever, so a signed-out user would
    // read as "still loading" rather than "no groups". Callers use this to
    // hold off on the no-groups copy, and a permanent hold is worse than the
    // dead end it replaces.
    loading: !!user && isPending,
  };
}
