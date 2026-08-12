import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { groupsKey } from './useGroupRows';
import { useAuthStore } from '../stores/authStore';

export interface MyGroup {
  id: string;
  name: string;
  color: string | null;
}

/**
 * Deliberately a child of `['groups']`, not a key of its own.
 *
 * Caching this query at all (see below) means something has to say when it is
 * wrong, and the honest list of writes that make it wrong is longer than it
 * looks: create, join by code, join by link, accept an invite, leave — and
 * renaming or recolouring a group, which changes the `name` and `color` cached
 * right here and reaches no realtime listener at all, because `groups` is not
 * in SUBSCRIBED_TABLES.
 *
 * Every one of those already invalidates `['groups']` for the Groups tab. Being
 * a child means they invalidate this too, without knowing it exists. The
 * alternative — a key of its own plus a helper each of those sites has to
 * remember — was written first and had already missed the rename by the time it
 * was reviewed, which is the argument against it.
 *
 * The cost is a handful of extra refetches on manage-screen actions that do not
 * touch your own membership (promoting an admin, toggling notifications). The
 * sibling under this prefix, `['groups', userId]` in the Groups tab, is heavier
 * and already pays exactly that.
 */
const myGroupsKey = (userId: string | undefined) => [...groupsKey(), 'mine', userId];

/**
 * How long "which groups am I in" is trusted without asking again.
 *
 * Staleness is pushed here, not polled for: the key above rides every
 * `['groups']` invalidation. Five minutes is the backstop for a path none of
 * those reach, not the mechanism.
 */
export const MY_GROUPS_STALE_MS = 5 * 60_000;

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
    queryKey: myGroupsKey(user?.id),
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
