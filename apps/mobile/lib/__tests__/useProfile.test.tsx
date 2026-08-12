import { Alert } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useProfile } from '../useProfile';
import { supabase } from '../supabase';
import { chain, type ChainMock } from '../testing/supabase';
import { signOutOfAccount } from '../signOut';
import { purgeOwnedFiles } from '../storage';
import { clearPushToken, registerPushToken } from '../push';
import { useAuthStore } from '../../stores/authStore';

const mockReplace = jest.fn();

jest.mock('expo-router', () =>
  require('../testing/router').expoRouterMock(() => ({ replace: mockReplace }))
);
jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('../signOut', () => ({ signOutOfAccount: jest.fn() }));
jest.mock('../storage', () => ({ purgeOwnedFiles: jest.fn() }));
jest.mock('../push', () => ({ registerPushToken: jest.fn(), clearPushToken: jest.fn() }));

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;
const mockSignOutOfAccount = signOutOfAccount as jest.Mock;
const mockPurge = purgeOwnedFiles as jest.Mock;
const mockClearPushToken = clearPushToken as jest.Mock;
const mockRegisterPushToken = registerPushToken as jest.Mock;

const PROFILE = { id: 'user-1', display_name: 'Nacho', push_enabled: false };

let alerts: string[][] = [];
let profiles: ChainMock;
let groupMembers: ChainMock;

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const renderProfile = () => renderHook(() => useProfile(), { wrapper });

beforeEach(() => {
  jest.clearAllMocks();
  alerts = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, body) => {
    alerts.push([title, body ?? '']);
  });
  profiles = chain({ data: { ...PROFILE, push_enabled: true }, error: null });
  groupMembers = chain({ count: 3, error: null });
  mockFrom.mockImplementation((table: string) => (table === 'profiles' ? profiles : groupMembers));
  mockRpc.mockResolvedValue({ error: null });
  mockSignOutOfAccount.mockResolvedValue(true);
  mockPurge.mockResolvedValue({ failed: [] });
  useAuthStore.setState({ user: { id: 'user-1' } as never, profile: PROFILE as never });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useProfile', () => {
  it('counts the groups the signed-in user belongs to', async () => {
    const { result } = await renderProfile();

    await waitFor(() => expect(result.current.groupCount).toBe(3));
    expect(mockFrom).toHaveBeenCalledWith('group_members');
    expect(groupMembers.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('clears the device token before turning notifications off', async () => {
    const { result } = await renderProfile();

    await act(async () => {
      result.current.setPush.mutate(false);
    });

    await waitFor(() => expect(result.current.setPush.isSuccess).toBe(true));
    // The privacy policy says the token goes with the switch, so a flipped flag
    // on its own would make it a lie.
    expect(mockClearPushToken).toHaveBeenCalledWith('user-1');
    expect(mockRegisterPushToken).not.toHaveBeenCalled();
    expect(profiles.update).toHaveBeenCalledWith({ push_enabled: false });
  });

  it('goes to login once the credentials are actually gone', async () => {
    const { result } = await renderProfile();

    await act(async () => {
      result.current.signOut.mutate();
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/login'));
    expect(alerts).toEqual([]);
  });

  it('stays put and says so when the credentials survive the sign-out', async () => {
    mockSignOutOfAccount.mockResolvedValue(false);
    const { result } = await renderProfile();

    await act(async () => {
      result.current.signOut.mutate();
    });

    // A login screen over a session still on disk signs them back in on the
    // next launch (PLA-36), so the screen has to stay where it is.
    await waitFor(() => expect(alerts).toHaveLength(1));
    expect(alerts[0]![0]).toBe("Couldn't sign out");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('refuses to delete the account while its photos are still online', async () => {
    mockPurge.mockResolvedValue({ failed: ['avatars/user-1/avatar.jpg'] });
    const { result } = await renderProfile();

    await act(async () => {
      result.current.deleteAccount.mutate();
    });

    await waitFor(() => expect(alerts).toHaveLength(1));
    expect(alerts[0]![0]).toBe("Couldn't delete your account");
    expect(alerts[0]![1]).toContain("Your photos couldn't be removed");
    // Deleting around a file nobody can reach again would leave a public avatar
    // URL outliving the account it belonged to.
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('deletes the files, then the account, then leaves', async () => {
    const { result } = await renderProfile();

    await act(async () => {
      result.current.deleteAccount.mutate();
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/login'));
    expect(mockPurge).toHaveBeenCalledWith('user-1');
    expect(mockRpc).toHaveBeenCalledWith('delete_my_account');
    expect(alerts).toEqual([]);
  });

  it('keeps the deleted account on screen when the device will not let go of it', async () => {
    mockSignOutOfAccount.mockResolvedValue(false);
    const { result } = await renderProfile();

    await act(async () => {
      result.current.deleteAccount.mutate();
    });

    // The row is gone server-side, so the copy names that rather than offering
    // a retry of the delete.
    await waitFor(() => expect(alerts).toHaveLength(1));
    expect(alerts[0]![0]).toBe('Your account is deleted');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
