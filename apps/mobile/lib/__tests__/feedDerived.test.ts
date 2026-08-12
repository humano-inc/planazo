import type { NestedDateOption } from '@planazo/shared';
import { fmtDay, fmtTime } from '../dates';
import { deriveFeedItems, type FeedPlanSource } from '../feedDerived';
import { iso } from '../testing/dates';
import { rsvp, yes } from '../testing/rsvps';

/**
 * Every branch of the feed's per-plan derivation, reached by input rather
 * than by rendering the screen. The screen keeps its RTL tests for what it
 * draws; this file owns what it decides.
 */

const ME = 'u-me';
const HOST = 'u-host';

const option = (
  id: string,
  daysFromNow: number,
  availableIds: string[] = []
): NestedDateOption => ({
  id,
  date: iso(daysFromNow),
  date_availability: availableIds.map((user_id) => ({
    user_id,
    profile: { display_name: user_id },
  })),
});

const plan = (over: Partial<FeedPlanSource> = {}): FeedPlanSource => ({
  plan_type: 'fixed',
  status: 'open',
  min_people: 2,
  max_people: null,
  created_by: HOST,
  event_date: iso(3),
  locked_date: null,
  rsvps: [],
  plan_date_options: [],
  ...over,
});

const derive = (p: FeedPlanSource, userId: string | undefined = ME) =>
  deriveFeedItems([p], userId)[0]!;

describe('deriveFeedItems', () => {
  it('returns [] for undefined and empty inputs', () => {
    expect(deriveFeedItems(undefined, ME)).toEqual([]);
    expect(deriveFeedItems([], ME)).toEqual([]);
  });

  it('carries every selected column through on item.plan, unions narrowed', () => {
    const row = { ...plan(), id: 'p1', title: 'Padel + pizza' };
    const item = deriveFeedItems([row], ME)[0]!;
    expect(item.plan.id).toBe('p1');
    expect(item.plan.title).toBe('Padel + pizza');
    expect(item.plan.plan_type).toBe('fixed');
    expect(item.plan.status).toBe('open');
  });

  it('an unanswered open fixed plan needs you, with no userRsvp', () => {
    const item = derive(plan({ rsvps: [yes(HOST)] }));
    expect(item.needs).toBe(true);
    expect(item.userRsvp).toBeUndefined();
    expect(item.rsvpDriven).toBe(true);
  });

  it('your answer collapses needs and surfaces as userRsvp', () => {
    const item = derive(plan({ rsvps: [yes(ME, 'Me')] }));
    expect(item.needs).toBe(false);
    expect(item.userRsvp?.response).toBe('yes');
  });

  it('confirms a fixed plan at its minimum, counting and naming the yeses', () => {
    const item = derive(plan({ rsvps: [yes(HOST, 'Marta'), yes('u-2', 'Jordi')] }));
    expect(item.confirmed).toBe(true);
    expect(item.goingCount).toBe(2);
    expect(item.goingNames).toEqual(['Marta', 'Jordi']);
  });

  it('a running date vote is not RSVP-driven and counts the best single date', () => {
    const item = derive(
      plan({
        plan_type: 'flexible',
        event_date: null,
        plan_date_options: [option('d1', 5, [HOST, 'u-2']), option('d2', 6, ['u-3'])],
      })
    );
    expect(item.rsvpDriven).toBe(false);
    // The count is the leading date; the faces are everyone who engaged.
    expect(item.goingCount).toBe(2);
    expect(item.goingNames).toEqual([HOST, 'u-2', 'u-3']);
    expect(item.countByDate.d1!.count).toBe(2);
    expect(item.countByDate.d2!.count).toBe(1);
  });

  it('counts only your own date picks as myDates', () => {
    const item = derive(
      plan({
        plan_type: 'flexible',
        event_date: null,
        plan_date_options: [option('d1', 5, [ME, HOST]), option('d2', 6, [ME])],
      })
    );
    expect(item.myDates).toBe(2);
  });

  it('labels a settled date and an open vote differently', () => {
    const settled = derive(plan());
    expect(settled.when).toBe(`${fmtDay(iso(3))} · ${fmtTime(iso(3))}`);
    const voting = derive(
      plan({
        plan_type: 'flexible',
        event_date: null,
        plan_date_options: [option('d1', 5), option('d2', 6)],
      })
    );
    expect(voting.when).toBe('2 dates on the table');
  });

  it('sorts by locked date, then event date, then the earliest viable date', () => {
    const locked = derive(plan({ locked_date: iso(1), event_date: iso(9), status: 'locked' }));
    expect(locked.sortKey).toBe(new Date(iso(1)).getTime());

    const fixed = derive(plan({ event_date: iso(4) }));
    expect(fixed.sortKey).toBe(new Date(iso(4)).getTime());

    const viable = derive(
      plan({
        plan_type: 'flexible',
        event_date: null,
        plan_date_options: [option('d1', 8, [HOST, 'u-2']), option('d2', 5, ['u-3'])],
      })
    );
    // d2 is earlier but below min_people; d1 is the earliest viable date.
    expect(viable.sortKey).toBe(new Date(iso(8)).getTime());
  });

  it('sorts a plan with no viable date to the end', () => {
    const item = derive(
      plan({ plan_type: 'flexible', event_date: null, plan_date_options: [option('d1', 5)] })
    );
    expect(item.sortKey).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('marks a plan past once its day has gone', () => {
    expect(derive(plan({ event_date: iso(-2) })).isPast).toBe(true);
    expect(derive(plan()).isPast).toBe(false);
    // An undated flexible plan is past once its last option day has gone.
    const flexPast = derive(
      plan({
        plan_type: 'flexible',
        event_date: null,
        plan_date_options: [option('d1', -3), option('d2', -2)],
      })
    );
    expect(flexPast.isPast).toBe(true);
  });

  it('is full only while a yes is what the plan wants', () => {
    const full = derive(plan({ max_people: 2, rsvps: [yes(HOST), yes('u-2')] }));
    expect(full.isFull).toBe(true);

    // Same seats taken, but the vote is still running: no seat is handed out.
    const voting = derive(
      plan({
        plan_type: 'flexible',
        event_date: null,
        max_people: 2,
        rsvps: [yes(HOST), yes('u-2')],
        plan_date_options: [option('d1', 5)],
      })
    );
    expect(voting.isFull).toBe(false);
  });

  it('shows your waiting-list place and nobody else’s', () => {
    const rsvps = [
      yes(HOST),
      rsvp('u-2', 'pending', null, 4),
      rsvp(ME, 'pending', null, 7),
      rsvp('u-3', 'pending', null, 9),
    ];
    expect(derive(plan({ rsvps })).waitPosition).toBe(2);
    expect(derive(plan({ rsvps: [yes(HOST)] })).waitPosition).toBeNull();
  });

  it('lets the host, a yes, and a date voter answer polls, and nobody else', () => {
    expect(derive(plan(), HOST).canVoteOnPolls).toBe(true);
    expect(derive(plan({ rsvps: [yes(ME)] })).canVoteOnPolls).toBe(true);
    expect(
      derive(plan({ plan_type: 'flexible', plan_date_options: [option('d1', 5, [ME])] }))
        .canVoteOnPolls
    ).toBe(true);
    expect(derive(plan()).canVoteOnPolls).toBe(false);
    expect(derive(plan(), undefined).canVoteOnPolls).toBe(false);
  });

  it('counts the poll denominator as the distinct union of yeses and voters', () => {
    const item = derive(
      plan({
        plan_type: 'flexible',
        rsvps: [yes(HOST), yes('u-2')],
        // HOST holds both a yes and a pick, and must count once.
        plan_date_options: [option('d1', 5, [HOST, 'u-3'])],
      })
    );
    expect(item.pollPeopleIn).toBe(3);
  });
});
