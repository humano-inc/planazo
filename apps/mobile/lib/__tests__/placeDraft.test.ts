import {
  pickPlace,
  placeDraftFrom,
  placeIdToSave,
  removePlace,
  typeWords,
} from '../placeDraft';

const ARENA = { id: 'place-1', title: 'Arena Padel Mendoza', subtitle: 'Pedro del Castillo' };

const picked = (words = 'Arena Pad') => pickPlace(placeDraftFrom(words, null), ARENA);

describe('placeDraftFrom', () => {
  it('starts free text with nothing picked', () => {
    expect(placeDraftFrom('casa de Juan', null)).toEqual({
      words: 'casa de Juan',
      placeId: null,
      wordsAtPick: '',
      picked: null,
    });
  });

  it('treats a saved pick as made on the saved words, with no name to show', () => {
    expect(placeDraftFrom('Arena', 'place-1')).toEqual({
      words: 'Arena',
      placeId: 'place-1',
      wordsAtPick: 'Arena',
      picked: null,
    });
  });
});

describe('pickPlace', () => {
  it('never writes into the host\'s words', () => {
    expect(picked().words).toBe('Arena Pad');
  });

  it('records the id, the words it was made on, and the place to confirm', () => {
    expect(picked()).toMatchObject({ placeId: 'place-1', wordsAtPick: 'Arena Pad', picked: ARENA });
  });

  it('replaces an earlier pick', () => {
    const next = { id: 'place-2', title: 'Bar Latina', subtitle: 'Arístides' };
    expect(pickPlace(picked(), next)).toMatchObject({ placeId: 'place-2', picked: next });
  });
});

describe('typeWords', () => {
  it('just takes the words when nothing is picked', () => {
    expect(typeWords(placeDraftFrom('Are', null), 'Aren')).toEqual(placeDraftFrom('Aren', null));
  });

  it('keeps the pick while someone finishes their sentence', () => {
    expect(typeWords(picked(), 'Arena Padel Mendoza')).toMatchObject({
      words: 'Arena Padel Mendoza',
      placeId: 'place-1',
      wordsAtPick: 'Arena Pad',
      picked: ARENA,
    });
  });

  it('ignores case and surrounding spaces when comparing', () => {
    expect(typeWords(picked(), '  arena pad cancha 3').placeId).toBe('place-1');
  });

  it('drops the pick when the words are replaced, so a moved venue loses the old link', () => {
    expect(typeWords(picked(), 'Club Libertad')).toEqual(placeDraftFrom('Club Libertad', null));
  });

  it('drops the pick when a word is cut short', () => {
    expect(typeWords(picked(), 'Arena').placeId).toBeNull();
  });

  it.each(['', '   '])('drops the pick when the field is emptied (%j)', (words) => {
    expect(typeWords(picked(), words).placeId).toBeNull();
  });

  it('applies the same rule to a pick saved earlier', () => {
    const saved = placeDraftFrom('Arena', 'place-1');
    expect(typeWords(saved, 'Arena Padel').placeId).toBe('place-1');
    expect(typeWords(saved, 'Club Libertad').placeId).toBeNull();
  });
});

describe('removePlace', () => {
  it('keeps the words and forgets the place', () => {
    expect(removePlace(picked())).toEqual(placeDraftFrom('Arena Pad', null));
  });
});

describe('placeIdToSave', () => {
  it('saves a picked id', () => {
    expect(placeIdToSave(picked())).toBe('place-1');
  });

  it('saves nothing for free text', () => {
    expect(placeIdToSave(placeDraftFrom('casa de Juan', null))).toBeNull();
  });

  it('never saves an id without words, which the database refuses', () => {
    expect(placeIdToSave({ ...picked(), words: '   ' })).toBeNull();
  });
});
