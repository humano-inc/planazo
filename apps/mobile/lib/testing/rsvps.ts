import type { RsvpLike } from '@planazo/shared';

/**
 * RSVP-row builders shared by the derivation suites, shaped like the rows the
 * plan queries embed: user_id required, profile carried, waitlist_seq only
 * meaningful while pending. Lives beside dates.ts, and outside `__tests__/`,
 * for the same reason it does.
 */
export type TestRsvp = RsvpLike & { user_id: string };

export const rsvp = (
  user_id: string,
  response: string | null,
  name: string | null = null,
  waitlist_seq: number | null = null
): TestRsvp => ({ user_id, response, waitlist_seq, profile: { display_name: name } });

export const yes = (id: string, name: string | null = null) => rsvp(id, 'yes', name);
export const no = (id: string, name: string | null = null) => rsvp(id, 'no', name);
export const waiting = (id: string, seq: number) => rsvp(id, 'pending', null, seq);
