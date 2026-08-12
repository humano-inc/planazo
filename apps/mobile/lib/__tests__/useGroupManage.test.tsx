import { AppState } from 'react-native';
import { act, waitFor } from '@testing-library/react-native';
import { useGroupManage } from '../useGroupManage';
import { groupInviteKey } from '../useGroupInvite';
import { UNDO_WINDOW_MS } from '../usePendingRemoval';
import { supabase } from '../supabase';
import { chain, type ChainMock } from '../testing/supabase';
import { renderHookWithQuery } from '../testing/render';
import { BLOCKED_QUERY_KEY, blockUser, fetchBlockedIds, unblockUser } from '../moderation';
import { useAuthStore } from '../../stores/authStore';

const mockNavigate = jest.fn();

jest.mock('expo-router', () =>
  require('../testing/router').expoRouterMock(() => ({ navigate: mockNavigate }))
);
jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('../moderation', () => ({
  ...jest.requireActual('../moderation'),
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
  fetchBlockedIds: jest.fn(),
}));
// The undo toast belongs to the layout, and usePendingRemoval's own test owns
// its behaviour. Here it only has to exist.
jest.mock('../../components/ui', () => ({ showToast: jest.fn() }));

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;
const mockBlockUser = blockUser as jest.Mock;
const mockUnblockUser = unblockUser as jest.Mock;
const mockFetchBlockedIds = fetchBlockedIds as jest.Mock;

const GROUP = { id: 'g1', name: 'Padel', group_members: [] };

/**
 * Every builder the hook asked for. Not just the last one: an invalidation
 * refetches the group, so the builder that took the write is rarely the newest.
 */
let builders: ChainMock[] = [];

/** Every `.update()` argument, across all of them. */
const updates = () => builders.flatMap((b) => b.update.mock.calls);

async function renderManage() {
  const view = await renderHookWithQuery(() => useGroupManage('g1'));
  await waitFor(() => expect(view.result.current.group).toBeTruthy());
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
  builders = [];
  mockFrom.mockImplementation(() => {
    const builder = chain({ data: GROUP, error: null });
    builders.push(builder);
    return builder;
  });
  mockRpc.mockResolvedValue({ data: null, error: null });
  mockFetchBlockedIds.mockResolvedValue(['u9']);
  useAuthStore.setState({ user: { id: 'me' } as never });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useGroupManage', () => {
  it('reads the group and the list of people this user has blocked', async () => {
    const { result } = await renderManage();


    expect(result.current.group?.name).toBe('Padel');
    await waitFor(() => expect(result.current.blocked.has('u9')).toBe(true));
  });

  it('removes a member with the RPC once the undo window closes', async () => {
    const { result, invalidated } = await renderManage();
    jest.useFakeTimers();

    await act(async () => result.current.startRemoval('u2', 'Ana'));
    // The row goes at once; the delete is what waits.
    expect(result.current.pendingRemovalId).toBe('u2');
    expect(mockRpc).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(UNDO_WINDOW_MS);
    });
    // A second pass, because the timer only starts the mutation: its own
    // promise chain and the state it settles land on later microtasks, and
    // leaving them outside act is what prints the warning that hides the next
    // real one.
    await act(async () => {});

    // The RPC, not a delete: it also withdraws the invites that person sent,
    // which is why the invite sheet is refetched alongside the group.
    expect(mockRpc).toHaveBeenCalledWith('remove_group_member', {
      p_group_id: 'g1',
      p_user_id: 'u2',
    });
    expect(invalidated).toEqual(
      expect.arrayContaining([
        groupInviteKey('g1'),
        ['group-manage', 'g1'],
        ['group', 'g1'],
        ['groups'],
      ])
    );
  });

  it('refreshes everything a block dissolves, not just the block list', async () => {
    const { result, invalidated } = await renderManage();

    await act(async () => {
      result.current.setBlocked.mutate({ userId: 'u2', blocked: true });
    });

    await waitFor(() => expect(mockBlockUser).toHaveBeenCalledWith('me', 'u2'));
    // Friendship and their seats on this user's plans go server-side, so the
    // caches holding those have to go with them.
    expect(invalidated).toEqual(
      expect.arrayContaining([
        BLOCKED_QUERY_KEY,
        ['home-plans'],
        ['friends'],
        ['group-manage', 'g1'],
      ])
    );
  });

  it('unblocks without asking anyone else to change', async () => {
    const { result } = await renderManage();

    await act(async () => {
      result.current.setBlocked.mutate({ userId: 'u2', blocked: false });
    });

    await waitFor(() => expect(mockUnblockUser).toHaveBeenCalledWith('me', 'u2'));
    expect(mockBlockUser).not.toHaveBeenCalled();
  });

  it('writes the post permission on the group row', async () => {
    const { result, invalidated } = await renderManage();

    await act(async () => {
      result.current.setAnyoneCanPost.mutate(true);
    });

    await waitFor(() => expect(result.current.setAnyoneCanPost.isSuccess).toBe(true));
    expect(updates()).toContainEqual([{ anyone_can_post: true }]);
    expect(invalidated).toEqual(expect.arrayContaining([['group-manage', 'g1']]));
  });

  it('sets the new-plan notification through its RPC', async () => {
    const { result } = await renderManage();

    await act(async () => {
      result.current.setNotify.mutate(false);
    });

    await waitFor(() => expect(result.current.setNotify.isSuccess).toBe(true));
    expect(mockRpc).toHaveBeenCalledWith('set_group_notify', {
      p_group_id: 'g1',
      p_notify: false,
    });
  });

  it('leaves the group and goes back to the groups tab', async () => {
    const { result, invalidated } = await renderManage();

    await act(async () => {
      result.current.leaveGroup.mutate();
    });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/(app)/(tabs)/groups'));
    expect(mockRpc).toHaveBeenCalledWith('leave_group', { p_group_id: 'g1' });
    expect(invalidated).toEqual(expect.arrayContaining([['groups'], ['home-plans']]));
    // Not the group's own caches: refetching them for a group you have just
    // left is what would flip the screen to "This group isn't here".
    expect(invalidated).not.toContainEqual(['group-manage', 'g1']);
  });
});
