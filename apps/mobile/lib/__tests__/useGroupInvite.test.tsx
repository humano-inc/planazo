import { act, waitFor } from '@testing-library/react-native';
import { groupInviteKey, useGroupInvite } from '../useGroupInvite';
import { supabase } from '../supabase';
import { chain } from '../testing/supabase';
import { renderHookWithQuery } from '../testing/render';

const mockBack = jest.fn();

jest.mock('expo-router', () =>
  require('../testing/router').expoRouterMock(() => ({ back: mockBack }))
);
jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

const GROUP = {
  id: 'g1',
  name: 'Padel',
  join_mode: 'open',
  who_can_invite: 'anyone',
  group_members: [{ user_id: 'me', role: 'admin' }],
};

/** How many times the sheet's three-call queryFn has run. */
const codeFetches = () => mockRpc.mock.calls.filter((c) => c[0] === 'get_group_invite_code').length;

async function renderInvite() {
  const view = await renderHookWithQuery(() => useGroupInvite('g1'));
  await waitFor(() => expect(view.result.current.group).toBeTruthy());
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockImplementation((table: string) =>
    table === 'groups'
      ? chain({ data: GROUP, error: null })
      : chain({ data: [{ invitee_id: 'u2' }], error: null })
  );
  mockRpc.mockImplementation((name: string) =>
    Promise.resolve({ data: name === 'get_group_invite_code' ? 'OLDCODE' : null, error: null })
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useGroupInvite', () => {
  it('reads the group, its pending invites and its code together', async () => {
    const { result } = await renderInvite();

    expect(result.current.group?.name).toBe('Padel');
    expect(result.current.group?.pendingInviteeIds).toEqual(['u2']);
    // The code is not a column this client may read (PLA-49): it comes from
    // the RPC that checks membership and the who_can_invite dial.
    expect(result.current.group?.inviteCode).toBe('OLDCODE');
    expect(mockRpc).toHaveBeenCalledWith('get_group_invite_code', { p_group_id: 'g1' });
  });

  it('shows a refused code as no link rather than as an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'not allowed' } });
    const { result } = await renderInvite();

    // The friends list still works without a link to show, so the refusal is
    // dropped rather than thrown.
    expect(result.current.group?.inviteCode).toBeNull();
    expect(result.current.group?.name).toBe('Padel');
  });

  it('puts a reset code straight into the cache instead of refetching', async () => {
    const { result, invalidated } = await renderInvite();
    const fetchesBefore = codeFetches();
    mockRpc.mockImplementation((name: string) =>
      Promise.resolve({ data: name === 'rotate_invite_code' ? 'NEWCODE' : null, error: null })
    );

    await act(async () => {
      result.current.rotate.mutate();
    });

    // A refetch here would blank the link the admin is about to share while
    // all three calls go out again.
    await waitFor(() => expect(result.current.group?.inviteCode).toBe('NEWCODE'));
    expect(codeFetches()).toBe(fetchesBefore);
    expect(invalidated).toEqual([]);
  });

  it('sends one invite per pick, then refreshes the sheet and leaves', async () => {
    const { result, invalidated } = await renderInvite();

    await act(async () => {
      result.current.sendInvites.mutate(['u3', 'u4']);
    });

    await waitFor(() => expect(result.current.sendInvites.isSuccess).toBe(true));
    expect(mockBack).toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith('invite_to_group', { p_group_id: 'g1', p_invitee: 'u3' });
    expect(mockRpc).toHaveBeenCalledWith('invite_to_group', { p_group_id: 'g1', p_invitee: 'u4' });
    expect(invalidated).toEqual([groupInviteKey('g1')]);
  });
});
