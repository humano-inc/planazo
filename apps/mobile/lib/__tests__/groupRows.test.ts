import { deriveGroupRows, type GroupMembership, type GroupNeedsSource } from '../groupRows';
import { iso } from '../testing/dates';

/**
 * The Groups tab's row derivation: member counts, "waiting on you" counts and
 * ordering, reached by input rather than by rendering the screen.
 */

const ME = 'u-me';

const membership = (
  group_id: string,
  over: Partial<GroupMembership['groups']> = {}
): GroupMembership => ({
  group_id,
  role: 'member',
  groups: {
    name: `Group ${group_id}`,
    color: null,
    image_url: null,
    created_at: iso(-30),
    ...over,
  },
});

const members = (...groupIds: string[]) => groupIds.map((group_id) => ({ group_id }));

const openFixed = (group_id: string, over: Partial<GroupNeedsSource> = {}): GroupNeedsSource => ({
  group_id,
  plan_type: 'fixed',
  status: 'open',
  rsvps: [],
  plan_date_options: [],
  ...over,
});

const derive = (over: Partial<Parameters<typeof deriveGroupRows>[0]> = {}) =>
  deriveGroupRows({ memberships: [], memberRows: [], plans: [], userId: ME, ...over });

describe('deriveGroupRows', () => {
  it('returns [] when there are no memberships', () => {
    expect(derive()).toEqual([]);
  });

  it('maps a membership to its row shape', () => {
    const rows = derive({
      memberships: [membership('g1', { name: 'Domingueros', color: '#f00', image_url: 'img.png' })],
      memberRows: members('g1', 'g1', 'g1'),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'g1',
      role: 'member',
      name: 'Domingueros',
      color: '#f00',
      imageUrl: 'img.png',
      members: 3,
      needsYou: 0,
    });
  });

  it('tallies member counts per group, defaulting to zero', () => {
    const rows = derive({
      memberships: [membership('g1'), membership('g2')],
      memberRows: members('g1', 'g1', 'g2'),
    });
    expect(rows.map((r) => [r.id, r.members])).toEqual([
      ['g1', 2],
      ['g2', 1],
    ]);
    expect(derive({ memberships: [membership('g3')] })[0]!.members).toBe(0);
  });

  it('counts only the open plans still waiting on you', () => {
    const rows = derive({
      memberships: [membership('g1')],
      plans: [
        openFixed('g1'), // unanswered — waits on you
        openFixed('g1'), // two of them accumulate
        openFixed('g1', { rsvps: [{ user_id: ME, response: 'yes' }] }), // answered
        openFixed('g1', { status: 'locked' }), // no longer open
      ],
    });
    expect(rows[0]!.needsYou).toBe(2);
  });

  it('a flexible plan stops waiting once you picked a date or declined', () => {
    const flexible = (over: Partial<GroupNeedsSource> = {}) =>
      openFixed('g1', {
        plan_type: 'flexible',
        plan_date_options: [{ id: 'd1', date: iso(5), date_availability: [] }],
        ...over,
      });
    const waiting = derive({ memberships: [membership('g1')], plans: [flexible()] });
    expect(waiting[0]!.needsYou).toBe(1);

    const picked = derive({
      memberships: [membership('g1')],
      plans: [
        flexible({
          plan_date_options: [{ id: 'd1', date: iso(5), date_availability: [{ user_id: ME }] }],
        }),
      ],
    });
    expect(picked[0]!.needsYou).toBe(0);

    const declined = derive({
      memberships: [membership('g1')],
      plans: [flexible({ rsvps: [{ user_id: ME, response: 'no' }] })],
    });
    expect(declined[0]!.needsYou).toBe(0);
  });

  it('keeps plans in other groups out of the count', () => {
    const rows = derive({
      memberships: [membership('g1'), membership('g2')],
      plans: [openFixed('g2')],
    });
    expect(rows.map((r) => [r.id, r.needsYou])).toEqual([
      ['g1', 0],
      ['g2', 1],
    ]);
  });

  it('orders groups oldest first, a missing created_at sorting to the front', () => {
    const rows = derive({
      memberships: [
        membership('g1', { created_at: iso(-1) }),
        membership('g2', { created_at: iso(-90) }),
        membership('g3', { created_at: null }),
      ],
    });
    expect(rows.map((r) => r.id)).toEqual(['g3', 'g2', 'g1']);
  });

});
