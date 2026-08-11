import { spellCount } from '../words';

describe('spellCount', () => {
  it.each([
    [0, 'no one'],
    [1, 'one'],
    [2, 'two'],
    [5, 'five'],
    [9, 'nine'],
    [10, 'ten'],
  ])('spells %i as "%s"', (n, expected) => {
    expect(spellCount(n)).toBe(expected);
  });

  it('switches to digits past ten, where the word stops helping', () => {
    expect(spellCount(11)).toBe('11');
    expect(spellCount(35)).toBe('35');
  });

  it('reads as a sentence mid-clause, which is what it is for', () => {
    expect(`35 photos from ${spellCount(5)} people`).toBe('35 photos from five people');
  });

  it('stays lower case, leaving capitalisation to the caller', () => {
    // Plan detail opens sentences with these ("Two short on the night") and
    // capitalises at the call site, so the word itself must not.
    expect(spellCount(2)).toBe('two');
  });

  it('falls back to digits rather than undefined outside the table', () => {
    expect(spellCount(-1)).toBe('-1');
    expect(spellCount(1000)).toBe('1000');
  });
});
