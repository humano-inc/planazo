// The row shapes more than one plan topic reads: a date option, an
// availability row, an RSVP row. A shape only one module names lives with that
// module instead, which is why this file is short and stays short.

export interface DateOption {
  id: string;
  date: string;
}

/**
 * The joined profile every plan query already asks for. Optional because the
 * counting functions never need it — only the ones that name people do.
 */
export interface ProfileLike {
  display_name?: string | null;
}

export interface Availability {
  date_option_id: string;
  user_id: string;
  profile?: ProfileLike | null;
}

export interface RsvpLike {
  user_id?: string;
  response: string | null;
  /** Ordering key for the waiting list, non-null only while pending. */
  waitlist_seq?: number | null;
  profile?: ProfileLike | null;
}

export interface PlanDates {
  event_date?: string | null;
  locked_date?: string | null;
}
