import { describe, it, expect } from 'vitest';
import {
  getYesCount,
  seatsLeft,
  isPlanFull,
  getWaitingCount,
  waitlistPosition,
} from './capacity';

describe('getYesCount', () => {
  it('counts only yes responses', () => {
    expect(
      getYesCount([
        { response: 'yes' },
        { response: 'no' },
        { response: 'yes' },
        { response: 'pending' },
        { response: null },
      ])
    ).toBe(2);
  });

  it('handles null/undefined rsvps', () => {
    expect(getYesCount(null)).toBe(0);
    expect(getYesCount(undefined)).toBe(0);
  });
});

describe('seatsLeft / isPlanFull', () => {
  const yes = (n: number) => Array.from({ length: n }, () => ({ response: 'yes' }));

  it('counts places left against the cap', () => {
    expect(seatsLeft({ max_people: 6, rsvps: yes(4) })).toBe(2);
    expect(isPlanFull({ max_people: 6, rsvps: yes(4) })).toBe(false);
  });

  it('is full at exactly the cap', () => {
    expect(seatsLeft({ max_people: 6, rsvps: yes(6) })).toBe(0);
    expect(isPlanFull({ max_people: 6, rsvps: yes(6) })).toBe(true);
  });

  it('never reports negative room for a plan that predates enforcement', () => {
    expect(seatsLeft({ max_people: 6, rsvps: yes(8) })).toBe(0);
    expect(isPlanFull({ max_people: 6, rsvps: yes(8) })).toBe(true);
  });

  it('treats a null cap as no limit, not as zero', () => {
    expect(seatsLeft({ max_people: null, rsvps: yes(99) })).toBeNull();
    expect(seatsLeft({ rsvps: yes(99) })).toBeNull();
    expect(isPlanFull({ max_people: null, rsvps: yes(99) })).toBe(false);
  });

  it('only counts a yes as taking a place', () => {
    const rsvps = [
      { response: 'yes' },
      { response: 'no' },
      { response: 'pending' },
      { response: null },
    ];
    expect(seatsLeft({ max_people: 2, rsvps })).toBe(1);
    expect(isPlanFull({ max_people: 2, rsvps })).toBe(false);
  });

  it('is empty-safe', () => {
    expect(seatsLeft({ max_people: 4, rsvps: null })).toBe(4);
    expect(isPlanFull({ max_people: 4, rsvps: undefined })).toBe(false);
  });
});

// PLA-37. The numbers are an ordering key with gaps in it, so position is
// counted rather than read: what is honest is how many people are ahead.
describe('getWaitingCount / waitlistPosition', () => {
  const queue = [
    { user_id: 'a', response: 'yes', waitlist_seq: null },
    { user_id: 'b', response: 'pending', waitlist_seq: 3 },
    { user_id: 'c', response: 'pending', waitlist_seq: 7 },
    { user_id: 'd', response: 'pending', waitlist_seq: 12 },
    { user_id: 'e', response: 'no', waitlist_seq: null },
  ];

  it('counts only the people waiting', () => {
    expect(getWaitingCount(queue)).toBe(3);
    expect(getWaitingCount(null)).toBe(0);
    expect(getWaitingCount(undefined)).toBe(0);
  });

  it('reads position off the order, not off the number', () => {
    expect(waitlistPosition(queue, 'b')).toBe(1);
    expect(waitlistPosition(queue, 'c')).toBe(2);
    expect(waitlistPosition(queue, 'd')).toBe(3);
  });

  it('survives the gaps a promotion and a withdrawal leave behind', () => {
    // b was promoted (number cleared), c left. d is now at the front.
    const after = [
      { user_id: 'a', response: 'yes', waitlist_seq: null },
      { user_id: 'b', response: 'yes', waitlist_seq: null },
      { user_id: 'd', response: 'pending', waitlist_seq: 12 },
    ];
    expect(waitlistPosition(after, 'd')).toBe(1);
  });

  it('has no position for someone who is in, out, or absent', () => {
    expect(waitlistPosition(queue, 'a')).toBeNull();
    expect(waitlistPosition(queue, 'e')).toBeNull();
    expect(waitlistPosition(queue, 'nobody')).toBeNull();
    expect(waitlistPosition(queue, null)).toBeNull();
    expect(waitlistPosition(null, 'b')).toBeNull();
  });
});

// A pending row is a third state the rest of the logic predates. These pin the
// behaviour it already has rather than changing it: waiting means you have
// answered, and it does not mean you are in.
