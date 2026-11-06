import { useQuery } from '@tanstack/react-query';
import type { City } from '@planazo/shared';
import { supabase } from './supabase';
import { keyFactory } from './queryKey';

// Not exported, unlike the other key factories (PLA-116): the seeded list has
// nothing to invalidate it, so no second file has any reason to spell the key.
const citiesKey = keyFactory('cities');

/**
 * The whole seeded city list, for the picker to search locally (PLA-88).
 *
 * All of it in one read rather than a server-side search per keystroke: the
 * list is bounded by a migration and small enough to hold, and a filter that
 * runs in memory answers while the keyboard is still moving.
 *
 * It is held for the whole session, because only a migration changes the list
 * and that is too rare to refetch for. A session that loaded the list before a
 * migration removed a city still offers that city until the next launch: the
 * foreign key refuses it, and the caller reports a failed write. No order
 * clause either: `filterCities` sorts what it returns, and a second opinion
 * about the order here would just be one that never wins.
 */
export function useCities() {
  return useQuery({
    queryKey: citiesKey(),
    queryFn: async (): Promise<City[]> => {
      const { data, error } = await supabase.from('cities').select('*');
      if (error) throw error;
      return data;
    },
    staleTime: Infinity,
    // Kept past the last screen that wanted it, too. With the default gcTime
    // the list is dropped five minutes after the picker closes and refetched
    // on the next group, which is not what "never goes stale" means.
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
