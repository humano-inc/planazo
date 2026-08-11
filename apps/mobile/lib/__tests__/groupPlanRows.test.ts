import { deriveGroupPlanRows, type GroupPlan, type GroupPlanRow } from '../groupPlanRows';
import { iso } from '../testing/dates';

const yes = (user_id: string, display_name: string) => ({
  user_id,
  response: 'yes',
  profile: { display_name },
});

/** One person free on each of the given days, so no evening ever has two. */
const spreadThin = (days: number[]) =>
  days.map((d, i) => ({
    id: `o${i + 1}`,
    date: iso(d),
    date_availability: [{ user_id: `u${i + 1}` }],
  }));

const plan = (over: Partial<GroupPlan> = {}): GroupPlan => ({
  id: 'p1',
  title: 'Sunday roast',
  plan_type: 'fixed',
  status: 'open',
  event_date: iso(4),
  min_people: 3,
  rsvps: [],
  plan_date_options: [],
  ...over,
});

const rows = (plans: GroupPlan[], userId = 'me') => deriveGroupPlanRows({ plans, userId });

/** The one row a single-plan fixture is expected to produce, in that section. */
function only(list: GroupPlanRow[]): GroupPlanRow {
  expect(list).toHaveLength(1);
  return list[0] as GroupPlanRow;
}

const liveRow = (over: Partial<GroupPlan> = {}) => only(rows([plan(over)]).live);
const pastRow = (over: Partial<GroupPlan> = {}) => only(rows([plan(over)]).past);

describe('deriveGroupPlanRows', () => {
  it('has nothing to say about a group with no plans', () => {
    expect(deriveGroupPlanRows({ plans: [], userId: 'me' })).toEqual({
      live: [],
      waiting: [],
      locked: [],
      past: [],
    });
    expect(deriveGroupPlanRows({}).live).toEqual([]);
  });

  describe('the sections', () => {
    it('splits live plans by whether they are still open', () => {
      const { live, waiting, locked, past } = rows([
        plan({ id: 'open-one', status: 'open' }),
        plan({ id: 'locked-one', status: 'locked', locked_date: iso(6) }),
      ]);

      expect(live.map((p) => p.id)).toEqual(['open-one', 'locked-one']);
      expect(waiting.map((p) => p.id)).toEqual(['open-one']);
      expect(locked.map((p) => p.id)).toEqual(['locked-one']);
      expect(past).toEqual([]);
    });

    it('keeps a plan whose day has gone out of every live section', () => {
      const { live, waiting, locked, past } = rows([plan({ event_date: iso(-2) })]);

      expect(live).toEqual([]);
      expect(waiting).toEqual([]);
      expect(locked).toEqual([]);
      expect(past.map((p) => p.id)).toEqual(['p1']);
    });

    it('treats a cancelled plan as past on the day it was going to happen', () => {
      const { live, past } = rows([plan({ status: 'cancelled', event_date: iso(5) })]);

      expect(live).toEqual([]);
      expect(past.map((p) => p.id)).toEqual(['p1']);
    });

    it('puts the most recent ending at the top of the past section', () => {
      const { past } = rows([
        plan({ id: 'older', event_date: iso(-20) }),
        plan({ id: 'newest', event_date: iso(-1) }),
        plan({ id: 'middle', event_date: iso(-9) }),
      ]);

      expect(past.map((p) => p.id)).toEqual(['newest', 'middle', 'older']);
    });

    it('sorts a cancelled plan with no date at the end, not the start', () => {
      const { past } = rows([
        plan({ id: 'dateless', status: 'cancelled', event_date: null }),
        plan({ id: 'dated', event_date: iso(-3) }),
      ]);

      expect(past.map((p) => p.id)).toEqual(['dated', 'dateless']);
      expect(past.map((p) => p.endDate)).toEqual([expect.any(String), null]);
    });
  });

  describe('the when line', () => {
    it('counts the dates on the table for an open flexible plan', () => {
      const row = liveRow({
        plan_type: 'flexible',
        event_date: null,
        plan_date_options: [
          { id: 'o1', date: iso(3) },
          { id: 'o2', date: iso(5) },
        ],
      });

      expect(row.when).toBe('2 dates on the table');
    });

    it('says date, not dates, when only one is offered', () => {
      const row = liveRow({
        plan_type: 'flexible',
        event_date: null,
        plan_date_options: [{ id: 'o1', date: iso(3) }],
      });

      expect(row.when).toBe('1 date on the table');
    });
  });

  describe('the going count', () => {
    it('counts yes-RSVPs on a fixed plan', () => {
      expect(liveRow({ rsvps: [yes('me', 'Rocío'), yes('u2', 'Aina')] }).meta).toBe(
        '2 of 3 needed'
      );
    });

    it('says going once the plan has the people it needs', () => {
      expect(
        liveRow({ min_people: 2, rsvps: [yes('me', 'Rocío'), yes('u2', 'Aina')] }).meta
      ).toBe('2 going');
    });

    /**
     * Never the union of everyone free on any date. Three people each free on
     * a different day is a plan going nowhere, and the row used to call that
     * "3 going" while the plan screen said "3 more and it's on".
     */
    it('counts the best single date while a flexible vote runs', () => {
      const row = liveRow({
        plan_type: 'flexible',
        event_date: null,
        plan_date_options: [
          { id: 'o1', date: iso(3), date_availability: [{ user_id: 'me' }, { user_id: 'u2' }] },
          { id: 'o2', date: iso(5), date_availability: [{ user_id: 'u3' }] },
        ],
      });

      expect(row.meta).toBe('2 of 3 needed');
    });

    it('never adds up people spread one per date', () => {
      const row = liveRow({
        plan_type: 'flexible',
        event_date: null,
        plan_date_options: spreadThin([3, 4, 5]),
      });

      expect(row.when).toBe('3 dates on the table');
      expect(row.meta).toBe('1 of 3 needed');
    });
  });

  describe('the three endings', () => {
    it('names whoever called a plan off', () => {
      const row = pastRow({
        status: 'cancelled',
        cancelled_by: 'u2',
        canceller: { display_name: 'Aina' },
      });

      expect(row.ending).toBe('cancelled');
      expect(row.endingLine).toBe('Called off by Aina');
    });

    it('says you, not your name, when you were the one who called it off', () => {
      const row = pastRow({
        status: 'cancelled',
        cancelled_by: 'me',
        canceller: { display_name: 'Rocío' },
      });

      expect(row.endingLine).toBe('Called off by you');
    });

    it('falls back to the host when the canceller cannot be named', () => {
      expect(pastRow({ status: 'cancelled', cancelled_by: 'ghost' }).endingLine).toBe(
        'Called off by the host'
      );
    });

    it('counts how short a plan fell when its date passed', () => {
      const row = pastRow({ event_date: iso(-2), min_people: 4, rsvps: [yes('me', 'Rocío')] });

      expect(row.ending).toBe('expired');
      expect(row.endingLine).toBe("Didn't happen · 1 of 4");
    });

    it('sinks a spread-thin plan into Past as never-quite, not as happened', () => {
      const row = pastRow({
        plan_type: 'flexible',
        event_date: null,
        plan_date_options: spreadThin([-6, -5, -4]),
      });

      expect(row.ending).toBe('expired');
      expect(row.endingLine).toBe("Didn't happen · 1 of 3");
    });

    it('leaves a plan that happened without a line of explanation', () => {
      const row = pastRow({
        event_date: iso(-2),
        min_people: 2,
        rsvps: [yes('me', 'Rocío'), yes('u2', 'Aina')],
      });

      expect(row.ending).toBe('happened');
      expect(row.endingLine).toBe('');
    });

    it('counts a locked plan as having happened however few said yes', () => {
      const row = pastRow({
        status: 'locked',
        locked_date: iso(-2),
        min_people: 5,
        rsvps: [],
      });

      expect(row.ending).toBe('happened');
    });

    it('leaves a live plan with no ending at all', () => {
      const row = liveRow();

      expect(row.ending).toBeNull();
      expect(row.endingLine).toBe('');
    });
  });

  describe('who went', () => {
    it('puts you first and names everyone else in row order', () => {
      const row = pastRow({
        event_date: iso(-2),
        min_people: 2,
        rsvps: [yes('u2', 'Aina'), yes('me', 'Rocío'), yes('u3', 'Marta')],
      });

      expect(row.wentNames).toEqual(['You', 'Aina', 'Marta']);
      expect(row.wentLabel).toBe('You and 2 others went');
    });

    it('says other, not others, when it was the two of you', () => {
      const row = pastRow({
        event_date: iso(-2),
        min_people: 2,
        rsvps: [yes('me', 'Rocío'), yes('u2', 'Aina')],
      });

      expect(row.wentLabel).toBe('You and 1 other went');
    });

    it('says you went when nobody else did', () => {
      const row = pastRow({ event_date: iso(-2), min_people: 1, rsvps: [yes('me', 'Rocío')] });

      expect(row.wentNames).toEqual(['You']);
      expect(row.wentLabel).toBe('You went');
    });

    it('counts heads instead when you were not one of them', () => {
      const row = pastRow({
        event_date: iso(-2),
        min_people: 2,
        rsvps: [yes('u2', 'Aina'), yes('u3', 'Marta')],
      });

      expect(row.wentNames).toEqual(['Aina', 'Marta']);
      expect(row.wentLabel).toBe('2 went');
    });

    it('names someone whose profile did not load with a placeholder', () => {
      const row = pastRow({
        event_date: iso(-2),
        min_people: 1,
        rsvps: [{ user_id: 'u2', response: 'yes' }],
      });

      expect(row.wentNames).toEqual(['?']);
    });

    it('falls back to the going count when a past plan holds no yes at all', () => {
      // A flexible plan whose dates ran out before it ever locked: nobody
      // holds a yes, so there is no name to render, only the number that
      // decided whether it happened.
      const row = pastRow({
        plan_type: 'flexible',
        event_date: null,
        min_people: 3,
        plan_date_options: [
          {
            id: 'o1',
            date: iso(-2),
            date_availability: [{ user_id: 'me' }, { user_id: 'u2' }, { user_id: 'u3' }],
          },
        ],
      });

      expect(row.wentNames).toEqual([]);
      expect(row.wentLabel).toBe('3 went');
      expect(row.ending).toBe('happened');
    });

    it('ignores a no when counting who went', () => {
      const row = pastRow({
        event_date: iso(-2),
        min_people: 1,
        rsvps: [
          yes('me', 'Rocío'),
          { user_id: 'u2', response: 'no', profile: { display_name: 'Aina' } },
        ],
      });

      expect(row.wentNames).toEqual(['You']);
      expect(row.wentLabel).toBe('You went');
    });
  });
});
