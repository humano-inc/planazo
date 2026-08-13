import {
  foldAccents,
  filterCities,
  citiesEmptyLine,
  cityCaption,
  cityMoveNote,
} from '../cities';

const cities = [
  { name: 'Rosario' },
  { name: 'Córdoba' },
  { name: 'Buenos Aires' },
  { name: 'Rosario de la Frontera' },
  { name: 'Villa María' },
  { name: 'Río Cuarto' },
];

describe('foldAccents', () => {
  it('lowercases and takes the accents off', () => {
    expect(foldAccents('Córdoba')).toBe('cordoba');
    expect(foldAccents('Río Gallegos')).toBe('rio gallegos');
    expect(foldAccents('SAN LUIS')).toBe('san luis');
  });

  /** ñ decomposes to n plus a combining tilde, so it folds like any other accent. */
  it('folds ñ to n', () => {
    expect(foldAccents('Núñez')).toBe('nunez');
  });

  it('leaves an already-plain name alone', () => {
    expect(foldAccents('rosario')).toBe('rosario');
  });
});

describe('filterCities', () => {
  const names = (query: string) => filterCities(cities, query).map((c) => c.name);

  it('lists everything alphabetically when nothing is typed', () => {
    expect(names('')).toEqual([
      'Buenos Aires',
      'Córdoba',
      'Río Cuarto',
      'Rosario',
      'Rosario de la Frontera',
      'Villa María',
    ]);
  });

  it('treats whitespace as nothing typed', () => {
    expect(names('   ')).toEqual(names(''));
  });

  /** The headline case: an accent nobody types on a phone keyboard. */
  it('finds Córdoba from "cordoba", and the other way round', () => {
    expect(names('cordoba')).toEqual(['Córdoba']);
    expect(names('Córdoba')).toEqual(['Córdoba']);
  });

  it('ranks a name that starts with the query above one that merely contains it', () => {
    expect(names('rosario')).toEqual(['Rosario', 'Rosario de la Frontera']);
    // "maria" starts nothing and sits inside Villa María.
    expect(names('maria')).toEqual(['Villa María']);
  });

  /**
   * Every one of these contains an "r" somewhere, so the query splits the whole
   * list into the two bands and each stays alphabetical inside its own.
   */
  it('keeps alphabetical order inside each band', () => {
    expect(names('r')).toEqual([
      'Río Cuarto',
      'Rosario',
      'Rosario de la Frontera',
      'Buenos Aires',
      'Córdoba',
      'Villa María',
    ]);
  });

  it('ignores case and surrounding space in the query', () => {
    expect(names('  ROSARIO  ')).toEqual(['Rosario', 'Rosario de la Frontera']);
  });

  it('returns nothing for a city that is not on the list', () => {
    expect(names('lisbon')).toEqual([]);
  });

  it('does not reorder the caller’s array', () => {
    const original = [...cities];
    filterCities(cities, 'r');
    expect(cities).toEqual(original);
  });
});

describe('citiesEmptyLine', () => {
  it('echoes the search that emptied the list', () => {
    expect(citiesEmptyLine('lisbon')).toBe('No city called “lisbon” on the list.');
    expect(citiesEmptyLine('  lisbon  ')).toBe('No city called “lisbon” on the list.');
  });

  it('says something else when nothing was typed, because then the list itself is empty', () => {
    expect(citiesEmptyLine('')).toBe('No cities to choose from.');
  });
});

describe('cityCaption', () => {
  it('says what picking the city does', () => {
    expect(cityCaption('Mar del Plata')).toBe("Ideas will come from what's on in Mar del Plata.");
  });
});

describe('cityMoveNote', () => {
  it('names both ends of the move', () => {
    expect(cityMoveNote('Buenos Aires', 'Rosario')).toEqual({
      title: 'Moving from Buenos Aires to Rosario',
      body: 'Ideas will come from Rosario from next week.',
    });
  });
});
