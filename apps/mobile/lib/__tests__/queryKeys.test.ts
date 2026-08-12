import { cancelNoticesKey } from '../useCancelNotices';
import { feedKey } from '../useFeed';
import { friendsKey } from '../useFriends';
import { groupDetailKey, groupManageKey } from '../groupManageQuery';
import { groupsKey } from '../useGroupRows';
import { invitesKey } from '../usePendingInvites';
import { planDetailKey } from '../planDetailQuery';
import { planPhotosKey } from '../usePlanPhotos';
import { planPollKey } from '../usePlanPoll';
import {
  PLAN_MEMBERSHIP_KEY,
  planAvailabilitiesKey,
  planGroupMemberIdsKey,
  planRsvpsKey,
} from '../usePlanDetail';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

/**
 * Every key a second file reaches for, with the literal it has to keep
 * producing. The values are spelled out rather than derived: the point of a
 * factory is that the string stops moving, and a test that computed it from
 * the factory would agree with any string at all.
 */
const KEYS: [name: string, factory: (id?: string) => unknown[], prefix: string][] = [
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
  it.each(KEYS)('%s keeps the literal it replaced', (_name, factory, prefix) => {
    expect(factory()).toEqual([prefix]);
    expect(factory('x1')).toEqual([prefix, 'x1']);
  });

  /**
   * The whole reason a bare call is allowed: react-query matches an
   * invalidation filter positionally from the front, so the no-argument form
   * only reaches the keyed queries while it stays their prefix. Break this and
   * a write still succeeds, the screen still shows what it showed, and nothing
   * fails.
   */
  it.each(KEYS)('%s: the bare form is a prefix of the keyed one', (_name, factory) => {
    const keyed = factory('x1');
    expect(keyed.slice(0, factory().length)).toEqual(factory());
  });

  it('keys membership on the pair, under a prefix realtime can invalidate', () => {
    expect(PLAN_MEMBERSHIP_KEY).toEqual(['plan-membership']);
  });

  it('hangs the Groups tab and the lighter my-groups list off one prefix', () => {
    // useMyGroups keys on [...groupsKey(), 'mine', userId] so that every write
    // invalidating groupsKey() reaches it too (PLA-78).
    expect(groupsKey('u1').slice(0, 1)).toEqual(groupsKey());
  });
});
