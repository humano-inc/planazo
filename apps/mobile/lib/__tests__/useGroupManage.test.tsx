import { AppState } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useGroupManage } from '../useGroupManage';
import { UNDO_WINDOW_MS } from '../usePendingRemoval';
import { supabase } from '../supabase';
import { chain } from '../testing/supabase';
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

let client: QueryClient;
let invalidated: unknown[][];

/** Every key the hook asked react-query to refetch, flattened for assertion. */
const invalidatedKeys = () => invalidated.map((key) => JSON.stringify(key));

async function renderManage() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  invalidated = [];
  jest.spyOn(client, 'invalidateQueries').mockImplementation((filters?: { queryKey?: unknown }) => {
    invalidated.push((filters?.queryKey ?? []) as unknown[]);
    return Promise.resolve();
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = await renderHook(() => useGroupManage('g1'), { wrapper });
  await waitFor(() => expect(view.result.current.group).toBeTruthy());
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
  mockFrom.mockImplementation(() => chain({ data: GROUP, error: null }));
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
    const { result } = await renderManage();
    jest.useFakeTimers();

    await act(async () => result.current.startRemoval('u2', 'Ana'));
    // The row goes at once; the delete is what waits.
    expect(result.current.pendingRemovalId).toBe('u2');
    expect(mockRpc).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(UNDO_WINDOW_MS);
    });

    // The RPC, not a delete: it also withdraws the invites that person sent,
    // which is why the invite sheet is refetched alongside the group.
    expect(mockRpc).toHaveBeenCalledWith('remove_group_member', {
      p_group_id: 'g1',
      p_user_id: 'u2',
    });
    await waitFor(() =>
      expect(invalidatedKeys()).toEqual(
        expect.arrayContaining([
          JSON.stringify(['group-invite-sheet', 'g1']),
          JSON.stringify(['group-manage', 'g1']),
          JSON.stringify(['group', 'g1']),
          JSON.stringify(['groups']),
        ])
      )
    );
  });

  it('refreshes everything a block dissolves, not just the block list', async () => {
    const { result } = await renderManage();

    await act(async () => {
      result.current.setBlocked.mutate({ userId: 'u2', blocked: true });
    });

    await waitFor(() => expect(mockBlockUser).toHaveBeenCalledWith('me', 'u2'));
    // Friendship and their seats on this user's plans go server-side, so the
    // caches holding those have to go with them.
    expect(invalidatedKeys()).toEqual(
      expect.arrayContaining([
        JSON.stringify(BLOCKED_QUERY_KEY),
        JSON.stringify(['home-plans']),
        JSON.stringify(['friends']),
        JSON.stringify(['group-manage', 'g1']),
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
    const { result } = await renderManage();

    await act(async () => {
      result.current.setAnyoneCanPost.mutate(true);
    });

    await waitFor(() => expect(result.current.setAnyoneCanPost.isSuccess).toBe(true));
    const groups = mockFrom.mock.results.at(-1)?.value;
    expect(groups.update).toHaveBeenCalledWith({ anyone_can_post: true });
    expect(invalidatedKeys()).toEqual(
      expect.arrayContaining([JSON.stringify(['group-manage', 'g1'])])
    );
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
    const { result } = await renderManage();

    await act(async () => {
      result.current.leaveGroup.mutate();
    });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/(app)/(tabs)/groups'));
    expect(mockRpc).toHaveBeenCalledWith('leave_group', { p_group_id: 'g1' });
    expect(invalidatedKeys()).toEqual(
      expect.arrayContaining([JSON.stringify(['groups']), JSON.stringify(['home-plans'])])
    );
  });
});
