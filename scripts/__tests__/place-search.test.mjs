// The logic inside the place-search edge function. No network and no Google key.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  autocompleteBody,
  toSuggestions,
  validQuery,
} from '../../supabase/functions/place-search/suggestions.ts';

describe('validQuery', () => {
  test('trims what it accepts', () => {
    assert.equal(validQuery('  Arena  '), 'Arena');
  });

  test('accepts the shortest and longest queries', () => {
    assert.equal(validQuery('bar'), 'bar');
    assert.equal(validQuery('x'.repeat(120)), 'x'.repeat(120));
  });

  test('refuses what is too short once trimmed, too long, or not text', () => {
    for (const q of ['ba', '  a  ', '', 'x'.repeat(121), undefined, null, 42, {}]) {
      assert.equal(validQuery(q), null);
    }
  });
});

describe('autocompleteBody', () => {
  const city = { lat: -32.8895, lon: -68.8458, country_code: 'AR' };

  test('limits the search to the country and biases it to the city', () => {
    assert.deepEqual(autocompleteBody('Arena', city), {
      input: 'Arena',
      languageCode: 'es',
      includedRegionCodes: ['ar'],
      locationBias: {
        circle: { center: { latitude: -32.8895, longitude: -68.8458 }, radius: 50000 },
      },
    });
  });
});

describe('toSuggestions', () => {
  const prediction = (placeId, main, secondary) => ({
    placePrediction: {
      placeId,
      structuredFormat: {
        mainText: { text: main },
        ...(secondary ? { secondaryText: { text: secondary } } : {}),
      },
    },
  });

  test('puts Google\'s answer in our own words', () => {
    assert.deepEqual(toSuggestions({ suggestions: [prediction('p1', 'Bar Latina', 'Mendoza')] }), [
      { id: 'p1', title: 'Bar Latina', subtitle: 'Mendoza' },
    ]);
  });

  test('a place with no second line still counts', () => {
    assert.deepEqual(toSuggestions({ suggestions: [prediction('p1', 'Mendoza')] }), [
      { id: 'p1', title: 'Mendoza', subtitle: '' },
    ]);
  });

  test('drops anything that is not a place it can name', () => {
    const suggestions = [
      { queryPrediction: { text: { text: 'bars near me' } } },
      { placePrediction: { placeId: 'no-name' } },
      { placePrediction: { structuredFormat: { mainText: { text: 'No id' } } } },
      prediction('p1', 'Bar Latina', 'Mendoza'),
    ];
    assert.deepEqual(toSuggestions({ suggestions }), [
      { id: 'p1', title: 'Bar Latina', subtitle: 'Mendoza' },
    ]);
  });

  test('an empty answer is an empty list', () => {
    assert.deepEqual(toSuggestions({}), []);
  });

  test('shows at most three, keeping Google\'s order', () => {
    const suggestions = ['a', 'b', 'c', 'd', 'e'].map((id) => prediction(id, id, 'x'));
    assert.deepEqual(toSuggestions({ suggestions }).map((s) => s.id), ['a', 'b', 'c']);
  });
});
