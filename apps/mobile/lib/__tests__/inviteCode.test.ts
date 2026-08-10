import { inviteCodeFrom } from '../inviteCode';

/**
 * Reading a code back out of whatever somebody pasted.
 *
 * These used to live in the Groups screen's test file, because the paste field
 * did too. The field is its own component now (PLA-80) and the parsing is its
 * own module, so the unit test sits next to the unit.
 */
describe('inviteCodeFrom', () => {
  it('takes a bare code, in any case', () => {
    expect(inviteCodeFrom('ABCD2345')).toBe('ABCD2345');
    expect(inviteCodeFrom('abcd2345')).toBe('ABCD2345');
    expect(inviteCodeFrom('AbCd2345')).toBe('ABCD2345');
  });

  it('finds the code inside a link, in either scheme', () => {
    expect(inviteCodeFrom('planazo://join/ABCD2345')).toBe('ABCD2345');
    expect(inviteCodeFrom('https://planazo.me/join/ABCD2345')).toBe('ABCD2345');
  });

  it('finds it inside a sentence somebody typed around it', () => {
    expect(inviteCodeFrom('here you go: ABCD2345 see you sunday')).toBe('ABCD2345');
  });

  it('has nothing to say about text with no code in it', () => {
    expect(inviteCodeFrom('')).toBeNull();
    expect(inviteCodeFrom('join my group!')).toBeNull();
    expect(inviteCodeFrom('https://planazo.me/join/')).toBeNull();
  });

  // 0, 1, I and O are not in the code alphabet, so length alone is not enough.
  it('rejects eight characters that could not be a code', () => {
    expect(inviteCodeFrom('ABC10OI2')).toBeNull();
    expect(inviteCodeFrom('OOOOOOOO')).toBeNull();
  });

  it('needs the full eight', () => {
    expect(inviteCodeFrom('ABCD234')).toBeNull();
  });

  // Nine valid characters contain an eight-character code, and this takes the
  // first eight rather than refusing. Pinned as the current rule, not as a
  // decision anybody defended.
  it('reads the first eight of a longer run', () => {
    expect(inviteCodeFrom('ABCD23456')).toBe('ABCD2345');
  });
});
