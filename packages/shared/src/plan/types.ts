// The row shapes every plan topic reads. They live together because they are
// what the modules beside this one have in common: a date option, an
// availability row, an RSVP row. Shapes assembled for one topic (capacity,
// confirmation, album) live with that topic instead.

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

export interface DateCount {
  count: number;
  date: string;
}

/** The nested shape returned by Supabase selects like
 *  `plan_date_options(id, date, date_availability(user_id))` */
export interface NestedDateOption extends DateOption {
  date_availability?: { user_id: string; profile?: ProfileLike | null }[] | null;
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
