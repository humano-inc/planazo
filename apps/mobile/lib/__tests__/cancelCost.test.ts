import { affectedCount, costLine } from '../cancelCost';

const fixedOpen = { plan_type: 'fixed', status: 'open' };
const flexibleOpen = { plan_type: 'flexible', status: 'open' };
const flexibleLocked = { plan_type: 'flexible', status: 'locked' };

const yes = { response: 'yes' };
const no = { response: 'no' };
const pending = { response: 'pending' };

describe('affectedCount', () => {
  it('counts yeses on a fixed plan, ignoring no and pending', () => {
    expect(affectedCount(fixedOpen, [yes, no, pending, yes], [])).toBe(2);
  });

  it('counts people rather than ticks on an open flexible plan', () => {
    // One person ticking four dates is one person let down, not four.
    const availabilities = [
      { user_id: 'u1' },
      { user_id: 'u1' },
      { user_id: 'u1' },
      { user_id: 'u2' },
    ];
    expect(affectedCount(flexibleOpen, [], availabilities)).toBe(2);
  });

  it('goes back to counting yeses once a flexible plan locks', () => {
    // The vote is over, so what lands on people is the answer they gave.
    expect(affectedCount(flexibleLocked, [yes], [{ user_id: 'u1' }, { user_id: 'u2' }])).toBe(1);
  });

  it('treats missing lists as empty', () => {
    expect(affectedCount(fixedOpen, null, null)).toBe(0);
    expect(affectedCount(flexibleOpen, undefined, undefined)).toBe(0);
    expect(affectedCount(null, null, null)).toBe(0);
  });
});

describe('costLine', () => {
  it.each([
    ['fixed, nobody answered', fixedOpen, [], [], 'No one has answered yet. The plan moves to Past.'],
    [
      'fixed, exactly one',
      fixedOpen,
      [yes],
      [],
      "1 person said they're coming. They'll get a notification straight away, and the plan moves to Past.",
    ],
    [
      'fixed, more than one',
      fixedOpen,
      [yes, yes, yes],
      [],
      "3 people said they're coming. They'll all get a notification straight away, and the plan moves to Past.",
    ],
    [
      'flexible, nobody sent dates',
      flexibleOpen,
      [],
      [],
      'No one has answered yet. The plan moves to Past.',
    ],
    [
      'flexible, exactly one',
      flexibleOpen,
      [],
      [{ user_id: 'u1' }, { user_id: 'u1' }],
      "1 person sent dates. They'll get a notification straight away, and the plan moves to Past.",
    ],
    [
      'flexible, more than one',
      flexibleOpen,
      [],
      [{ user_id: 'u1' }, { user_id: 'u2' }],
      "2 people sent dates. They'll all get a notification straight away, and the plan moves to Past.",
    ],
  ])('%s', (_name, plan, rsvps, availabilities, expected) => {
    expect(costLine(plan, rsvps, availabilities)).toBe(expected);
  });

  it('says nobody answered rather than naming a verb when the count is zero', () => {
    // The zero sentence is shared by both plan types on purpose: there is no
    // "sent dates" to report when nothing was sent.
    expect(costLine(flexibleOpen, [], [])).toBe(costLine(fixedOpen, [], []));
  });

  it('never uses an em dash, which is app copy the user reads', () => {
    const lines = [
      costLine(fixedOpen, [], []),
      costLine(fixedOpen, [yes], []),
      costLine(fixedOpen, [yes, yes], []),
      costLine(flexibleOpen, [], [{ user_id: 'u1' }]),
      costLine(flexibleOpen, [], [{ user_id: 'u1' }, { user_id: 'u2' }]),
    ];
    lines.forEach((line) => expect(line).not.toMatch(/—/));
  });
});
