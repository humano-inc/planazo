import { describe, it, expect } from 'vitest';
import { isAlbumOpen, canAddPhotos } from './album';
import { isPlanPast } from './dates';

describe('album (PLA-32, PLA-55)', () => {
  const night = new Date(2026, 7, 8, 20, 0).toISOString();
  const duringTheNight = new Date(2026, 7, 8, 22, 0);
  const weekBefore = new Date(2026, 7, 1, 12, 0);

  it('opens when the night starts, and never closes again', () => {
    const plan = { event_date: night, locked_date: null };
    expect(isAlbumOpen(plan, weekBefore)).toBe(false);
    expect(isAlbumOpen(plan, duringTheNight)).toBe(true);
    expect(isAlbumOpen(plan, new Date(2027, 0, 1))).toBe(true);
  });

  it('opens on the evening itself, not at the end of the day', () => {
    // The distinction from isPlanPast, which deliberately runs to local
    // midnight. Photographing the night while it is happening is the point.
    const plan = { event_date: night, locked_date: null };
    expect(isAlbumOpen(plan, new Date(2026, 7, 8, 20, 1))).toBe(true);
    expect(isPlanPast(plan, [], new Date(2026, 7, 8, 20, 1))).toBe(false);
  });

  it('takes the locked date over the fixed one, and has no album without either', () => {
    expect(
      isAlbumOpen({ event_date: null, locked_date: night }, duringTheNight)
    ).toBe(true);
    // A flexible plan nobody locked: the night does not exist yet.
    expect(isAlbumOpen({ event_date: null, locked_date: null }, duringTheNight)).toBe(false);
  });

  it('adding belongs to the creator and the yeses, and to nobody else', () => {
    const plan = { event_date: night, locked_date: null, status: 'open', created_by: 'u-host' };
    const rsvps = [
      { user_id: 'u-yes', response: 'yes' },
      { user_id: 'u-no', response: 'no' },
      { user_id: 'u-unanswered', response: null },
    ];
    expect(canAddPhotos({ ...plan, rsvps }, 'u-host', duringTheNight)).toBe(true);
    expect(canAddPhotos({ ...plan, rsvps }, 'u-yes', duringTheNight)).toBe(true);
    expect(canAddPhotos({ ...plan, rsvps }, 'u-no', duringTheNight)).toBe(false);
    expect(canAddPhotos({ ...plan, rsvps }, 'u-unanswered', duringTheNight)).toBe(false);
    expect(canAddPhotos({ ...plan, rsvps }, null, duringTheNight)).toBe(false);
  });

  it('an admin who skipped the night may not add to its album', () => {
    // PLA-55 itself. Being an admin is power over the group, not evidence of
    // having been at the plan — and the client used to disagree with the SQL
    // about exactly this person. Nothing about the group's roles reaches this
    // function, which is what makes that impossible now.
    const plan = { event_date: night, locked_date: null, status: 'open', created_by: 'u-host' };
    expect(canAddPhotos(plan, 'u-admin', duringTheNight)).toBe(false);
    // Nor a member of the group who was never in the plan at all.
    expect(canAddPhotos(plan, 'u-bystander', duringTheNight)).toBe(false);
  });

  it('availability on a flexible plan is not a yes', () => {
    // The person marked themselves free but never got a seat at the lock.
    const plan = {
      event_date: null,
      locked_date: night,
      status: 'locked',
      created_by: 'u-host',
      rsvps: [{ user_id: 'u-avail', response: null }],
    };
    expect(canAddPhotos(plan, 'u-avail', duringTheNight)).toBe(false);
  });

  it('nobody adds before the night, or to a plan that was called off', () => {
    const upcoming = {
      event_date: night,
      locked_date: null,
      status: 'open',
      created_by: 'u-host',
      rsvps: [{ user_id: 'u-yes', response: 'yes' }],
    };
    expect(canAddPhotos(upcoming, 'u-yes', weekBefore)).toBe(false);
    expect(canAddPhotos(upcoming, 'u-host', weekBefore)).toBe(false);

    const calledOff = { ...upcoming, status: 'cancelled' };
    expect(canAddPhotos(calledOff, 'u-yes', duringTheNight)).toBe(false);
    expect(canAddPhotos(calledOff, 'u-host', duringTheNight)).toBe(false);
    // Looking survives a cancellation, so the album itself is still open.
    expect(isAlbumOpen(calledOff, duringTheNight)).toBe(true);
  });
});

