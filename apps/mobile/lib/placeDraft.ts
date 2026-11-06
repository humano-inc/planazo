/** A real place from the search, as place-search describes it. */
export interface PlaceSuggestion {
  id: string;
  title: string;
  subtitle: string;
}

/**
 * The place field while someone is filling it in (PLA-156).
 *
 * `words` are the host's own and they are what gets saved and shown. A pick adds
 * the id of the real place they mean and never writes into them, because a place
 * id is all Google's terms let us keep.
 */
export interface PlaceDraft {
  words: string;
  placeId: string | null;
  /** What the words said when the place was picked. Decides if a later edit keeps it. */
  wordsAtPick: string;
  /** Name and address to confirm the pick. Null for one saved earlier: we keep neither. */
  picked: PlaceSuggestion | null;
}

const normalize = (words: string) => words.trim().toLowerCase();

export function placeDraftFrom(words: string, placeId: string | null): PlaceDraft {
  return { words, placeId, wordsAtPick: placeId ? words : '', picked: null };
}

/**
 * New words keep a pick only while they still start with the words it was made
 * on. "Arena Pad" becoming "Arena Padel Mendoza" is someone finishing their
 * sentence. Becoming "Club Libertad" is a moved venue, and keeping the id would
 * send everyone to the old one.
 */
export function typeWords(draft: PlaceDraft, words: string): PlaceDraft {
  const normalized = normalize(words);
  const keeps = normalized.length > 0 && normalized.startsWith(normalize(draft.wordsAtPick));
  if (draft.placeId && keeps) return { ...draft, words };
  return { words, placeId: null, wordsAtPick: '', picked: null };
}

export function pickPlace(draft: PlaceDraft, suggestion: PlaceSuggestion): PlaceDraft {
  return { ...draft, placeId: suggestion.id, wordsAtPick: draft.words, picked: suggestion };
}

export function removePlace(draft: PlaceDraft): PlaceDraft {
  return placeDraftFrom(draft.words, null);
}

/** The id to save, which needs words to go with it (plans_place_id_needs_location). */
export function placeIdToSave(draft: PlaceDraft): string | null {
  return draft.words.trim() ? draft.placeId : null;
}
