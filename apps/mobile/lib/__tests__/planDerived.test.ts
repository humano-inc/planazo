import type { Availability, DateOption, RsvpLike } from '@planazo/shared';
import { fmtDay } from '../dates';
import { derivePlanDetail, type PlanDetailRow } from '../planDerived';
import { iso } from '../testing/dates';

/**
 * Every branch of the plan detail screen's derivation, reached by input rather
 * than by rendering the screen. The screen keeps its own RTL tests for what it
 * draws; this file owns what it decides.
 */

const ME = 'u-me';
const HOST = 'u-host';

type Rsvp = RsvpLike & { user_id: string };

const rsvp = (
  user_id: string,
  response: string | null,
  name: string | null = null,
  waitlist_seq: number | null = null
): Rsvp => ({ user_id, response, waitlist_seq, profile: { display_name: name } });

const yes = (id: string, name: string | null = null) => rsvp(id, 'yes', name);
const no = (id: string, name: string | null = null) => rsvp(id, 'no', name);
const waiting = (id: string, seq: number) => rsvp(id, 'pending', null, seq);

const opt = (id: string, daysFromNow: number): DateOption => ({
  id,
  date: iso(daysFromNow),
});

const avail = (option: DateOption, user_id: string, name: string | null = null): Availability => ({
  date_option_id: option.id,
  user_id,
  profile: { display_name: name },
});

const plan = (over: Partial<PlanDetailRow> = {}): PlanDetailRow => ({
  status: 'open',
  plan_type: 'fixed',
  min_people: 3,
  max_people: null,
  cancelled_at: null,
  cancelled_by: null,
  cancel_reason: null,
  created_by: HOST,
  event_date: iso(3),
  locked_date: null,
  ...over,
});

/** A flexible plan carries its dates as options, so it has neither column set. */
const flexible = (over: Partial<PlanDetailRow> = {}) =>
  plan({ plan_type: 'flexible', event_date: null, locked_date: null, ...over });

const derive = (input: Parameters<typeof derivePlanDetail>[0]) => {
  const derived = derivePlanDetail(input);
  if (!derived) throw new Error('expected a derived plan');
  return derived;
};

describe('while the query is in flight', () => {
  it('derives nothing at all rather than a plan of defaults', () => {
    expect(derivePlanDetail({ plan: undefined })).toBeNull();
  });
});

describe('status flags', () => {
  it('reads plan_type and status straight through', () => {
    const d = derive({ plan: plan({ plan_type: 'fixed', status: 'open' }) });
    expect(d.isFlexible).toBe(false);
    expect(d.isOpen).toBe(true);
    expect(d.isLocked).toBe(false);
    expect(d.isCancelled).toBe(false);
  });

  it.each([
    ['locked', { isOpen: false, isLocked: true, isCancelled: false }],
    ['cancelled', { isOpen: false, isLocked: false, isCancelled: true }],
  ] as const)('marks a %s plan', (status, expected) => {
    expect(derive({ plan: plan({ status }) })).toMatchObject(expected);
  });

  it('runs the date vote only on a flexible plan that is still open', () => {
    expect(derive({ plan: flexible() }).isOpenFlexible).toBe(true);
    expect(derive({ plan: flexible({ status: 'locked' }) }).isOpenFlexible).toBe(false);
    expect(derive({ plan: flexible({ status: 'cancelled' }) }).isOpenFlexible).toBe(false);
    expect(derive({ plan: plan() }).isOpenFlexible).toBe(false);
  });
});

describe('the leading date option', () => {
  const soon = opt('o-soon', 3);
  const later = opt('o-later', 5);

  it('is the option the most people can make', () => {
    const d = derive({
      plan: flexible(),
      dateOptions: [soon, later],
      availabilities: [avail(later, 'u1'), avail(soon, 'u1'), avail(soon, 'u2')],
    });
    expect(d.leadId).toBe(soon.id);
  });

  it('breaks a tie toward the earlier date, not the row order', () => {
    // The later option is listed first on purpose: without the date tiebreak a
    // stable sort would leave it in front.
    const d = derive({
      plan: flexible(),
      dateOptions: [later, soon],
      availabilities: [avail(later, 'u1'), avail(soon, 'u2')],
    });
    expect(d.leadId).toBe(soon.id);
  });

  it('counts every option, including the ones nobody picked', () => {
    const d = derive({
      plan: flexible(),
      dateOptions: [soon, later],
      availabilities: [avail(soon, 'u1')],
    });
    expect(d.countByDate).toEqual({
      [soon.id]: { count: 1, date: soon.date },
      [later.id]: { count: 0, date: later.date },
    });
  });

  it('has no lead when the plan carries no options', () => {
    expect(derive({ plan: plan() }).leadId).toBeNull();
  });

  it('names a viable lead only once an option clears the minimum', () => {
    const input = {
      plan: flexible({ min_people: 2 }),
      dateOptions: [soon, later],
      availabilities: [avail(soon, 'u1'), avail(soon, 'u2'), avail(later, 'u3')],
    };
    expect(derive(input).viableLead).toEqual({ id: soon.id, date: soon.date, count: 2 });
    expect(derive({ ...input, plan: flexible({ min_people: 3 }) }).viableLead).toBeNull();
  });
});

describe('headline', () => {
  it('says a cancelled plan was called off, whatever the numbers say', () => {
    const d = derive({
      plan: plan({ status: 'cancelled', min_people: 1 }),
      rsvps: [yes('u1'), yes('u2')],
    });
    expect(d.headline).toBe('Called off');
  });

  it.each([
    [1, 2, 'One short on the night'],
    [0, 2, 'Two short on the night'],
  ])('spells the shortfall out when the date passed (%i of %i)', (going, min, expected) => {
    const d = derive({
      plan: plan({ min_people: min, event_date: iso(-1) }),
      rsvps: Array.from({ length: going }, (_, i) => yes(`u${i}`)),
    });
    expect(d.headline).toBe(expected);
  });

  it('switches to digits past ten, where the word stops helping', () => {
    const d = derive({ plan: plan({ min_people: 12, event_date: iso(-1) }) });
    expect(d.headline).toBe('12 short on the night');
  });

  it("says it's on once the plan reaches its minimum", () => {
    const d = derive({ plan: plan({ min_people: 2 }), rsvps: [yes('u1'), yes('u2')] });
    expect(d.headline).toBe("It's on");
  });

  it('names the leading date while the vote is running', () => {
    const soon = opt('o-soon', 3);
    const d = derive({
      plan: flexible({ min_people: 3 }),
      dateOptions: [soon, opt('o-later', 5)],
      availabilities: [avail(soon, 'u1'), avail(soon, 'u2')],
    });
    expect(d.headline).toBe(`1 more on ${fmtDay(soon.date)}`);
  });

  it('drops the date once nobody has picked one, rather than naming an empty option', () => {
    const d = derive({
      plan: flexible({ min_people: 3 }),
      dateOptions: [opt('o-soon', 3)],
    });
    expect(d.headline).toBe("3 more and it's on");
  });

  it('counts up without a date on a fixed plan', () => {
    const d = derive({ plan: plan({ min_people: 3 }), rsvps: [yes('u1')] });
    expect(d.headline).toBe("2 more and it's on");
  });

  it('treats a locked plan as on even below its minimum', () => {
    // Locking is the host saying it is happening. The count stops deciding.
    const d = derive({ plan: plan({ status: 'locked', min_people: 5 }), rsvps: [yes('u1')] });
    expect(d.headline).toBe("It's on");
  });
});

describe('capLine', () => {
  it('explains an uncapped plan with its minimum alone', () => {
    expect(derive({ plan: plan({ min_people: 4 }) }).capLine).toBe('Happens with 4');
  });

  it('names both numbers while a capped plan is still short', () => {
    const d = derive({ plan: plan({ min_people: 3, max_people: 6 }), rsvps: [yes('u1')] });
    expect(d.capLine).toBe('Happens with 3 · caps at 6');
  });

  it('switches to who is in once the plan is on', () => {
    const d = derive({
      plan: plan({ min_people: 2, max_people: 6 }),
      rsvps: [yes('u1'), yes('u2'), yes('u3')],
    });
    expect(d.capLine).toBe('3 in · room for 3 more');
  });

  it('shuts the door in words rather than saying room for 0 more', () => {
    const d = derive({
      plan: plan({ min_people: 2, max_people: 3 }),
      rsvps: [yes('u1'), yes('u2'), yes('u3')],
    });
    expect(d.capLine).toBe("3 in · that's everyone");
  });

  it('never reads as over capacity on a plan that predates the cap', () => {
    const d = derive({
      plan: plan({ min_people: 2, max_people: 2 }),
      rsvps: [yes('u1'), yes('u2'), yes('u3')],
    });
    expect(d.capLine).toBe("3 in · that's everyone");
  });

  it('replaces the whole line once the date has passed', () => {
    const d = derive({ plan: plan({ min_people: 3, max_people: 6, event_date: iso(-1) }) });
    expect(d.capLine).toBe('The date passed before it reached its minimum');
  });
});

describe('who counts as going', () => {
  it('counts yes-RSVPs on a fixed plan', () => {
    const d = derive({ plan: plan(), rsvps: [yes('u1'), no('u2'), yes('u3')] });
    expect(d.going).toBe(2);
    expect(d.yesCount).toBe(2);
  });

  it('counts the best single date while the vote runs, not everyone interested', () => {
    const soon = opt('o-soon', 3);
    const later = opt('o-later', 5);
    const d = derive({
      plan: flexible(),
      dateOptions: [soon, later],
      availabilities: [avail(soon, 'u1'), avail(later, 'u2'), avail(later, 'u3')],
    });
    expect(d.going).toBe(2);
    // The faces row is the wider question, so all three appear under it.
    expect(d.goingPeople.map((p) => p.id)).toEqual(['u1', 'u2', 'u3']);
  });

  it('pulls you out of the list, because you get your own chip', () => {
    const d = derive({
      plan: plan(),
      rsvps: [yes('u1', 'Ana'), yes(ME, 'Me'), yes('u2')],
      userId: ME,
    });
    expect(d.goingPeople).toEqual([
      { id: 'u1', name: 'Ana' },
      { id: 'u2', name: '?' },
    ]);
  });

  it('reads you as in from availability while the vote runs, and from a yes after', () => {
    const soon = opt('o-soon', 3);
    const rsvps = [yes(ME)];
    const availabilities = [avail(soon, ME)];

    expect(
      derive({ plan: flexible(), dateOptions: [soon], availabilities, userId: ME }).youIn
    ).toBe(true);
    expect(derive({ plan: flexible(), dateOptions: [soon], rsvps, userId: ME }).youIn).toBe(
      false
    );
    expect(
      derive({
        plan: flexible({ status: 'locked' }),
        dateOptions: [soon],
        availabilities,
        userId: ME,
      }).youIn
    ).toBe(false);
    expect(
      derive({ plan: flexible({ status: 'locked' }), dateOptions: [soon], rsvps, userId: ME })
        .youIn
    ).toBe(true);
  });

  it('keeps your own picks and your own row to hand', () => {
    const soon = opt('o-soon', 3);
    const later = opt('o-later', 5);
    const d = derive({
      plan: flexible(),
      dateOptions: [soon, later],
      availabilities: [avail(soon, ME), avail(later, 'u1'), avail(later, ME)],
      rsvps: [yes(ME, 'Me')],
      userId: ME,
    });
    expect(d.myPickIds).toEqual([soon.id, later.id]);
    expect(d.userRsvp?.user_id).toBe(ME);
  });

  it('has no picks and no row for a signed-out viewer', () => {
    const soon = opt('o-soon', 3);
    const d = derive({
      plan: flexible(),
      dateOptions: [soon],
      availabilities: [avail(soon, 'u1')],
      rsvps: [yes('u1')],
    });
    expect(d.myPickIds).toEqual([]);
    expect(d.userRsvp).toBeUndefined();
    expect(d.youIn).toBe(false);
  });
});

describe('who said no', () => {
  it('counts every no but names each person once', () => {
    const d = derive({
      plan: plan(),
      rsvps: [no('u1', 'Marta'), no('u1', 'Marta'), no(ME, 'Me'), no('u2')],
      userId: ME,
    });
    expect(d.outCount).toBe(4);
    expect(d.notGoingPeople).toEqual([
      { id: 'u1', name: 'Marta' },
      { id: 'u2', name: '?' },
    ]);
    expect(d.youOut).toBe(true);
  });

  it('leaves youOut false for a yes, a pending row and no row at all', () => {
    expect(derive({ plan: plan(), rsvps: [yes(ME)], userId: ME }).youOut).toBe(false);
    expect(derive({ plan: plan(), rsvps: [waiting(ME, 1)], userId: ME }).youOut).toBe(false);
    expect(derive({ plan: plan(), userId: ME }).youOut).toBe(false);
  });
});

describe('unanswered members', () => {
  it('counts only the members who did nothing at all', () => {
    const soon = opt('o-soon', 3);
    const d = derive({
      plan: flexible(),
      dateOptions: [soon],
      // A row with a null response is a seat, not an answer.
      rsvps: [yes('u1'), rsvp('u2', null), waiting('u3', 1)],
      availabilities: [avail(soon, 'u4')],
      memberIds: ['u1', 'u2', 'u3', 'u4', 'u5'],
      userId: ME,
    });
    expect(d.unanswered).toBe(2);
  });

  it('is zero when the member list has not loaded, rather than the whole group', () => {
    expect(derive({ plan: plan(), rsvps: [yes('u1')] }).unanswered).toBe(0);
  });
});

describe('host powers versus having hosted', () => {
  it('gives the creator both', () => {
    const d = derive({ plan: plan({ created_by: ME }), userId: ME });
    expect(d.isHost).toBe(true);
    expect(d.youCreated).toBe(true);
  });

  it('gives a group admin the powers but never the credit (PLA-55)', () => {
    const d = derive({ plan: plan(), membership: { role: 'admin' }, userId: ME });
    expect(d.isHost).toBe(true);
    expect(d.youCreated).toBe(false);
  });

  it('gives a plain member neither', () => {
    const d = derive({ plan: plan(), membership: { role: 'member' }, userId: ME });
    expect(d.isHost).toBe(false);
    expect(d.youCreated).toBe(false);
  });

  it('says who called it off only when that was you', () => {
    expect(derive({ plan: plan({ cancelled_by: ME }), userId: ME }).youCancelled).toBe(true);
    expect(derive({ plan: plan({ cancelled_by: HOST }), userId: ME }).youCancelled).toBe(false);
    expect(derive({ plan: plan(), userId: ME }).youCancelled).toBe(false);
  });
});

describe('capacity and the waiting list', () => {
  it('is full once the yes-RSVPs reach the cap', () => {
    const d = derive({ plan: plan({ max_people: 2 }), rsvps: [yes('u1'), yes('u2')] });
    expect(d.isFull).toBe(true);
  });

  it('is never full while the vote runs, because seats are handed out at the lock', () => {
    const full = { max_people: 2 };
    const rsvps = [yes('u1'), yes('u2')];
    expect(derive({ plan: flexible(full), rsvps }).isFull).toBe(false);
    expect(derive({ plan: flexible({ ...full, status: 'locked' }), rsvps }).isFull).toBe(true);
  });

  it('is never full without a cap', () => {
    expect(derive({ plan: plan(), rsvps: [yes('u1'), yes('u2')] }).isFull).toBe(false);
  });

  it('counts how many people are ahead of you, and nobody else', () => {
    const rsvps = [waiting('u1', 10), waiting(ME, 20), waiting('u2', 30)];
    expect(derive({ plan: plan(), rsvps, userId: ME }).waitPosition).toBe(2);
    expect(derive({ plan: plan(), rsvps, userId: 'u1' }).waitPosition).toBe(1);
    expect(derive({ plan: plan(), rsvps: [yes(ME)], userId: ME }).waitPosition).toBeNull();
    expect(derive({ plan: plan(), rsvps }).waitPosition).toBeNull();
  });
});

describe('endings', () => {
  it('is past once the end of the last possible day has gone by', () => {
    expect(derive({ plan: plan({ event_date: iso(-1) }) }).isPast).toBe(true);
    expect(derive({ plan: plan({ event_date: iso(3) }) }).isPast).toBe(false);
  });

  it('reads a flexible plan from its latest option', () => {
    const d = derive({
      plan: flexible(),
      dateOptions: [opt('o-gone', -3), opt('o-still', 2)],
    });
    expect(d.isPast).toBe(false);
    expect(d.lastDate).toBe(iso(2));
  });

  it('never expires an undated plan', () => {
    const d = derive({ plan: flexible() });
    expect(d.isPast).toBe(false);
    expect(d.lastDate).toBeNull();
    expect(d.isEnded).toBe(false);
  });

  it('expires a plan that ran out of days short of its minimum', () => {
    const d = derive({ plan: plan({ min_people: 3, event_date: iso(-1) }), rsvps: [yes('u1')] });
    expect(d.isExpired).toBe(true);
    expect(d.isEnded).toBe(true);
  });

  it('leaves a past plan that filled up alone: it simply happened', () => {
    const d = derive({
      plan: plan({ min_people: 2, event_date: iso(-1) }),
      rsvps: [yes('u1'), yes('u2')],
    });
    expect(d.isPast).toBe(true);
    expect(d.isExpired).toBe(false);
    expect(d.isEnded).toBe(false);
  });

  it('calls a cancelled plan ended without ever calling it expired', () => {
    const d = derive({ plan: plan({ status: 'cancelled', event_date: iso(-1) }) });
    expect(d.isExpired).toBe(false);
    expect(d.isEnded).toBe(true);
  });

  it('takes the locked date over the fixed one', () => {
    const d = derive({ plan: flexible({ locked_date: iso(2), event_date: iso(6) }) });
    expect(d.lastDate).toBe(iso(2));
  });
});

describe('the album', () => {
  it('opens once the night has started, not when the day is over', () => {
    expect(derive({ plan: plan({ event_date: iso(-1) }) }).albumOpen).toBe(true);
    expect(derive({ plan: plan({ event_date: iso(3) }) }).albumOpen).toBe(false);
  });

  it('stays shut on a flexible plan nobody locked, which has no night yet', () => {
    const d = derive({ plan: flexible(), dateOptions: [opt('o-gone', -3)] });
    expect(d.albumOpen).toBe(false);
  });

  it('lets the creator and anyone who said yes add to it', () => {
    const past = plan({ event_date: iso(-1) });
    expect(derive({ plan: past, userId: HOST }).canAddPhotos).toBe(true);
    expect(derive({ plan: past, rsvps: [yes(ME)], userId: ME }).canAddPhotos).toBe(true);
  });

  it('refuses everyone else, including a group admin who skipped the night', () => {
    const past = plan({ event_date: iso(-1) });
    expect(
      derive({ plan: past, rsvps: [no(ME)], membership: { role: 'admin' }, userId: ME })
        .canAddPhotos
    ).toBe(false);
    expect(derive({ plan: past, userId: ME }).canAddPhotos).toBe(false);
    expect(derive({ plan: past, rsvps: [yes(ME)] }).canAddPhotos).toBe(false);
  });

  it('refuses a cancelled plan even to the person who created it', () => {
    const d = derive({
      plan: plan({ status: 'cancelled', event_date: iso(-1) }),
      userId: HOST,
    });
    expect(d.canAddPhotos).toBe(false);
  });
});
