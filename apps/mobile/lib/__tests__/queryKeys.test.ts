import { cancelNoticesKey } from '../useCancelNotices';
import { feedKey } from '../useFeed';
import { friendsKey } from '../useFriends';
import { groupDetailKey, groupManageKey } from '../groupManageQuery';
import { groupsKey } from '../useGroupRows';
import { invitesKey } from '../usePendingInvites';
import { planPhotosKey } from '../planPhotosKey';
import { planPollKey } from '../usePlanPoll';
import {
  planAvailabilitiesKey,
  planDetailKey,
  planGroupMemberIdsKey,
  planMembershipKey,
  planRsvpsKey,
} from '../usePlanDetail';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

/**
 * Every key a second file reaches for, with the literal it has to keep
 * producing. The values are spelled out rather than derived: the point of a
 * factory is that the string stops moving, and a test that computed it from
 * the factory would agree with any string at all.
 */
const KEYS: [name: string, factory: (id?: string) => readonly unknown[], prefix: string][] = [
  ['feedKey', feedKey, 'home-plans'],
  ['groupsKey', groupsKey, 'groups'],
  ['groupDetailKey', groupDetailKey, 'group'],
  ['groupManageKey', groupManageKey, 'group-manage'],
  ['planDetailKey', planDetailKey, 'plan'],
  ['planRsvpsKey', planRsvpsKey, 'plan-rsvps'],
  ['planAvailabilitiesKey', planAvailabilitiesKey, 'plan-availabilities'],
  ['planGroupMemberIdsKey', planGroupMemberIdsKey, 'plan-group-member-ids'],
  ['planPollKey', planPollKey, 'plan-poll'],
  ['planPhotosKey', planPhotosKey, 'plan-photos'],
  ['friendsKey', friendsKey, 'friends'],
  ['invitesKey', invitesKey, 'invites'],
  ['cancelNoticesKey', cancelNoticesKey, 'cancel-notices'],
];

describe('query key factories', () => {
  /**
   * Both halves in one case, because they are one claim: the string did not
   * move when the literal became a call, and the bare form stayed a prefix of
   * the keyed one. react-query matches an invalidation filter positionally
   * from the front, so a prefix that is not one reaches nothing — the write
   * lands, the screen keeps showing what it showed, and nothing fails.
   */
  it.each(KEYS)('%s keeps the literal it replaced, prefix first', (_name, factory, prefix) => {
    expect(factory()).toEqual([prefix]);
    expect(factory('x1')).toEqual([prefix, 'x1']);
  });

  /**
   * The one key that cannot use the shared factory. A pair is all-or-nothing:
   * a filter with a hole in the middle would match no query at all, so a
   * half-known pair has to fall back to the prefix rather than key on it.
   */
  it('keys membership on the pair, or not at all', () => {
    expect(planMembershipKey('g1', 'u1')).toEqual(['plan-membership', 'g1', 'u1']);
    expect(planMembershipKey()).toEqual(['plan-membership']);
    expect(planMembershipKey('g1')).toEqual(['plan-membership']);
    expect(planMembershipKey(undefined, 'u1')).toEqual(['plan-membership']);
  });
});
