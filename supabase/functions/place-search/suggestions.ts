// The parts of place-search with logic in them, free of Deno so that
// scripts/__tests__/place-search.test.mjs can run them.

const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 120;
// What fits between the header and a raised keyboard along with the field. A
// drag to see more would dismiss the keyboard, and the list closes with it.
const MAX_SUGGESTIONS = 3;
/** The largest circle Places Autocomplete accepts. */
const BIAS_RADIUS_METERS = 50000;

export const AUTOCOMPLETE_FIELD_MASK =
  'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat';

export interface SearchCity {
  lat: number;
  lon: number;
  country_code: string;
}

export interface PlaceSuggestion {
  id: string;
  title: string;
  subtitle: string;
}

/** The trimmed query if it is one we will pay Google for, otherwise null. */
export function validQuery(q: unknown): string | null {
  if (typeof q !== 'string') return null;
  const trimmed = q.trim();
  return trimmed.length >= MIN_QUERY_LENGTH && trimmed.length <= MAX_QUERY_LENGTH ? trimmed : null;
}

/**
 * Always limited to the city's country and biased to the city. Left to itself
 * Google biases by the caller's IP, and the caller here is our own server.
 */
export function autocompleteBody(q: string, city: SearchCity) {
  return {
    input: q,
    languageCode: 'es',
    includedRegionCodes: [city.country_code.toLowerCase()],
    locationBias: {
      circle: {
        center: { latitude: city.lat, longitude: city.lon },
        radius: BIAS_RADIUS_METERS,
      },
    },
  };
}

interface AutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }[];
}

/** Google's response in our own words, so the app never learns its field names. */
export function toSuggestions(response: AutocompleteResponse): PlaceSuggestion[] {
  const suggestions: PlaceSuggestion[] = [];
  for (const { placePrediction } of response.suggestions ?? []) {
    const id = placePrediction?.placeId;
    const title = placePrediction?.structuredFormat?.mainText?.text;
    if (!id || !title) continue;
    suggestions.push({
      id,
      title,
      subtitle: placePrediction?.structuredFormat?.secondaryText?.text ?? '',
    });
  }
  return suggestions.slice(0, MAX_SUGGESTIONS);
}
