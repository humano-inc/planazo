import {
  canInvite,
  memberLimits,
  joinBlurb,
  joinLabel,
  joinModeOf,
  joinPendingLabel,
  linkBlurb,
  linkUnavailable,
  requestedBlurb,
  requestedEyebrow,
  whoCanInviteOf,
} from '../groupDoor';

/**
 * The door's two dials, and the copy that has to keep pace with them (PLA-49).
 *
 * The narrowing functions matter more than they look: everything downstream
 * reads a `string` off the database, and a value nobody planned for has to
 * land on the permissive default rather than on some third behaviour. A group
 * whose door became unreadable should be an ordinary open group, not a locked
 * one.
 */
describe('whoCanInviteOf / joinModeOf', () => {
  it('narrows the two known values', () => {
    expect(whoCanInviteOf('admins')).toBe('admins');
    expect(whoCanInviteOf('members')).toBe('members');
    expect(joinModeOf('approval')).toBe('approval');
    expect(joinModeOf('open')).toBe('open');
  });

  it('falls back to fully open on anything else', () => {
    for (const value of [null, undefined, '', 'ADMINS', 'nonsense']) {
      expect(whoCanInviteOf(value)).toBe('members');
      expect(joinModeOf(value)).toBe('open');
    }
  });
});

describe('canInvite', () => {
  it('lets any member invite while the dial says members', () => {
    expect(canInvite('members', 'member')).toBe(true);
    expect(canInvite('members', 'admin')).toBe(true);
    expect(canInvite(null, null)).toBe(true);
  });

  it('leaves only admins holding a way in once the dial moves', () => {
    expect(canInvite('admins', 'member')).toBe(false);
    expect(canInvite('admins', null)).toBe(false);
    expect(canInvite('admins', 'admin')).toBe(true);
  });
});

/**
 * PLA-61. A member sees no switch they cannot move, so these lines are the only
 * place the group's settings get explained to them. Saying one that is not in
 * force would invent a restriction; staying silent about one that is leaves
 * them guessing why Invite is missing.
 */
describe('memberLimits', () => {
  it('says nothing about a group on its open defaults', () => {
    expect(memberLimits('members', true)).toEqual([]);
    expect(memberLimits(null, null)).toEqual([]);
    expect(memberLimits(undefined, undefined)).toEqual([]);
  });

  it('names the shut invite door on its own', () => {
    expect(memberLimits('admins', true)).toEqual(['Only admins can invite people here.']);
  });

  it('names the shut posting door on its own', () => {
    expect(memberLimits('members', false)).toEqual(['Only admins can post plans here.']);
  });

  it('names both, invite first, when both are shut', () => {
    expect(memberLimits('admins', false)).toEqual([
      'Only admins can invite people here.',
      'Only admins can post plans here.',
    ]);
  });

  it('reads an unreadable dial as open, never as a restriction', () => {
    for (const value of ['', 'ADMINS', 'nonsense']) {
      expect(memberLimits(value, true)).toEqual([]);
    }
  });
});

describe('the copy', () => {
  it('promises what the link actually does', () => {
    expect(linkBlurb('open')).toBe('Anyone with the link joins straight away.');
    expect(linkBlurb('approval')).toBe(
      'People with the link ask to join, and an admin lets them in.'
    );
  });

  it('says whether the button joins or asks, before the tap and during it', () => {
    expect(joinLabel('open', 'Piso Gràcia')).toBe('Join Piso Gràcia');
    expect(joinLabel('approval', 'Piso Gràcia')).toBe('Ask to join Piso Gràcia');
    expect(joinPendingLabel('open')).toBe('Joining…');
    expect(joinPendingLabel('approval')).toBe('Asking…');
  });

  it('explains what pressing it means', () => {
    expect(joinBlurb('open')).toMatch(/see their plans/);
    expect(joinBlurb('approval')).toMatch(/An admin has to let you in/);
  });

  // Deliberately a constant answer and not a function of anything: a decline is
  // never announced (PLA-44), so a turned-down requester who taps the same link
  // reads exactly what a first-time asker reads.
  it('tells a requester nothing about which kind of ask this is', () => {
    expect(requestedBlurb()).toBe('An admin has your request. You’ll hear the moment they let you in.');
  });
});

describe('linkUnavailable', () => {
  it('names the door when the door is the reason', () => {
    expect(linkUnavailable('admins', 'member')).toBe('Only admins can hand out a link to this group.');
    expect(linkUnavailable('admins', null)).toMatch(/Only admins/);
  });

  it('blames the network when the person is allowed a link', () => {
    for (const [dial, role] of [
      ['admins', 'admin'],
      ['members', 'member'],
      [null, null],
    ] as const) {
      expect(linkUnavailable(dial, role)).toMatch(/Check your connection/);
    }
  });

});

// The house rule: every one of these strings reaches a user.
it('uses no em dash anywhere', () => {
  const all = [
    linkBlurb('open'),
    linkBlurb('approval'),
    joinLabel('open', 'X'),
    joinLabel('approval', 'X'),
    joinPendingLabel('open'),
    joinPendingLabel('approval'),
    joinBlurb('open'),
    joinBlurb('approval'),
    requestedEyebrow,
    requestedBlurb(),
    linkUnavailable('admins', 'member'),
    linkUnavailable('members', 'member'),
  ];
  expect(all.some((s) => s.includes('—'))).toBe(false);
});
