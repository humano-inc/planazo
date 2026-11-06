import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { PlaceSuggestion } from './placeDraft';
import { useDebouncedValue } from './useDebouncedValue';

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 300;

/**
 * Real places matching what is being typed (PLA-156).
 *
 * Every request costs money, so it waits for three characters and a pause. It
 * never refetches by itself, and it keeps no results around once they stop being
 * on screen: Google's terms do not allow caching them.
 *
 * A failure is deliberately silent. The field works as plain text without this,
 * so an error here costs the host a suggestion and never a plan.
 */
export function usePlaceSearch(text: string, cityId: string | null) {
  const q = useDebouncedValue(text.trim(), DEBOUNCE_MS);
  const enabled = q.length >= MIN_QUERY_LENGTH && text.trim().length >= MIN_QUERY_LENGTH;
  const query = useQuery({
    queryKey: ['place-search', cityId, q],
    queryFn: async (): Promise<PlaceSuggestion[]> => {
      const { data, error } = await supabase.functions.invoke('place-search', {
        body: { q, cityId },
      });
      if (error) throw error;
      return data.suggestions;
    },
    enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // The list stays put while the next keystroke's answer is on its way.
    placeholderData: keepPreviousData,
  });

  return { ...query, suggestions: enabled ? (query.data ?? []) : [] };
}
