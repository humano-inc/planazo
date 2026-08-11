import { requireUserId } from '../currentUser';

describe('requireUserId', () => {
  it('returns the id when there is one', () => {
    expect(requireUserId('u1')).toBe('u1');
  });

  it('throws when the user is signed out', () => {
    expect(() => requireUserId(undefined)).toThrow(/no user id/);
  });

  it('throws on null, which is what a cleared session leaves behind', () => {
    expect(() => requireUserId(null)).toThrow(/no user id/);
  });

  it('throws on an empty id rather than writing a row owned by nobody', () => {
    expect(() => requireUserId('')).toThrow(/no user id/);
  });
});
