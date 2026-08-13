/**
 * Everything the city picker works out without touching the network (PLA-88).
 *
 * A group's city is chosen once at creation and rarely again, so the whole
 * seeded list is in memory and the search is a local filter. Nothing here
 * queries; `useCities` fetches and these shape what it returned.
 */

/** The slice of a city row this module reads. Anything with a name can search. */
export interface NamedCity {
  name: string;
}

/**
 * Lowercase, with the accents taken off: "Córdoba" and "cordoba" fold to the
 * same string, and so do "Núñez" and "nunez".
 *
 * `lib/moderation.ts` has a normaliser of its own and it is not this one. That
 * one also folds leetspeak (`$` to `s`, `0` to `o`) so a slur cannot be spelled
 * around, which is exactly wrong for a search box: it would make "s4lta" find
 * Salta and teach nobody anything.
 */
export function foldAccents(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Alphabetical, on the folded name.
 *
 * Folded rather than `localeCompare`, because the comparison then depends only
 * on this file: a device without Spanish collation data and a node test runner
 * agree, and the order a test pins is the order a phone draws.
 */
function byFoldedName(a: NamedCity, b: NamedCity): number {
  const left = foldAccents(a.name);
  const right = foldAccents(b.name);
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * The picker's list for a given search box.
 *
 * No query is the whole list, alphabetically: with nothing typed there is no
 * signal to rank by, and A-to-Z is the order someone can skim for a place they
 * already know the name of.
 *
 * With a query, a name that *starts* with it comes before a name that merely
 * contains it. That is the difference between typing "rosar" and getting
 * Rosario first rather than Rosario de la Frontera, and between "cordoba"
 * landing on Córdoba rather than somewhere with the letters buried in it.
 * Within each band the alphabetical order holds, so the list never reshuffles
 * for a reason the person typing cannot see.
 */
export function filterCities<T extends NamedCity>(cities: T[], query: string): T[] {
  const sorted = [...cities].sort(byFoldedName);
  const q = foldAccents(query.trim());
  if (!q) return sorted;

  const prefix: T[] = [];
  const contains: T[] = [];
  for (const city of sorted) {
    const name = foldAccents(city.name);
    if (name.startsWith(q)) prefix.push(city);
    else if (name.includes(q)) contains.push(city);
  }
  return [...prefix, ...contains];
}

/**
 * What the empty results card says, echoing the search that emptied it.
 *
 * Only a search can empty the card: `CityPicker` says "Loading cities…" or the
 * failure line for the other two ways it can have no rows, so there is no
 * branch here for a list that simply is not there.
 */
export function citiesEmptyLine(query: string): string {
  return `No city called “${query.trim()}” on the list.`;
}

/** The line under a city once it is picked, saying what picking it does. */
export function cityCaption(name: string): string {
  return `Ideas will come from what's on in ${name}.`;
}

/**
 * The note on the change-city sheet, once a different city is selected.
 *
 * It names both ends because the destructive-sounding half is the one being
 * left: somebody changing this wants to see that they read the old city right
 * before they commit to the new one.
 */
export function cityMoveNote(from: string, to: string): { title: string; body: string } {
  return {
    title: `Moving from ${from} to ${to}`,
    body: `Ideas will come from ${to} from next week.`,
  };
}
