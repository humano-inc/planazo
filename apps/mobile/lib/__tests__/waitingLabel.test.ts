import { waitingLabel } from '../rsvp';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

describe('waitingLabel', () => {
  it('says "next" rather than "1st", which is what a person would say', () => {
    expect(waitingLabel(1)).toBe("You're next in line");
  });

  it.each([
    [2, "You're 2nd in line"],
    [3, "You're 3rd in line"],
    [4, "You're 4th in line"],
    [21, "You're 21st in line"],
    [22, "You're 22nd in line"],
    [23, "You're 23rd in line"],
  ])('renders position %i as "%s"', (position, expected) => {
    expect(waitingLabel(position)).toBe(expected);
  });

  it.each([
    [11, "You're 11th in line"],
    [12, "You're 12th in line"],
    [13, "You're 13th in line"],
  ])('keeps the teens on "th" rather than the last digit (%i)', (position, expected) => {
    expect(waitingLabel(position)).toBe(expected);
  });

  it('treats an unknown position as the front of the queue', () => {
    // A pending row whose place has not reached this client yet. The front is
    // where a fresh waiter on an empty list actually is, so it is the honest
    // fallback rather than a guess.
    expect(waitingLabel(null)).toBe("You're next in line");
  });
});
