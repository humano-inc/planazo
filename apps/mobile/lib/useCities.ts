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
 * It never goes stale inside a session, because the only thing that adds a
 * city is a migration, and a migration arrives with a new build. No order
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
    refetchOnWindowFocus: false,
  });
}
