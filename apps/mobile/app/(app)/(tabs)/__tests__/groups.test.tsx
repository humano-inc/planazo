import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GroupsScreen from '../groups';
import { useAuthStore } from '../../../../stores/authStore';
import { supabase } from '../../../../lib/supabase';
import { MIN_TOUCH_TARGET } from '../../../../lib/a11y';

const mockPush = jest.fn();

jest.mock('../../../../lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), navigate: jest.fn() }),
}));


const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

let memberships: any[] = [];
let counts: any[] = [];
let plans: any[] = [];
let groupInvites: any[] = [];
let pendingRequests: any[] = [];
let acceptedFriendships: any[] = [];

/**
 * group_members serves two queries on this screen; which result a chain
 * resolves to depends on how it was built (eq user_id = memberships,
 * in group_id = counts). friendships resolves by the status filter
 * (pending = requests, accepted = friends).
 */
function primeSupabase() {
  mockFrom.mockImplementation((table: string) => {
    const c: any = {};
    let kind = table;
    let status: string | null = null;
    ['select', 'order', 'single', 'or'].forEach((m) => {
      c[m] = jest.fn(() => c);
    });
    c.eq = jest.fn((col: string, val: string) => {
      if (col === 'status') status = val;
      return c;
    });
    c.in = jest.fn(() => {
      if (table === 'group_members') kind = 'counts';
      return c;
    });
    c.then = (resolve: (v: unknown) => void) => {
      const result =
        kind === 'counts'
          ? { data: counts, error: null }
          : table === 'group_invites'
            ? { data: groupInvites, error: null }
            : table === 'friendships'
              ? { data: status === 'pending' ? pendingRequests : acceptedFriendships, error: null }
              : kind === 'group_members'
                ? { data: memberships, error: null }
                : { data: plans, error: null };
      return Promise.resolve(result).then(resolve);
    };
    return c;
  });
}

async function renderGroups() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <GroupsScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  memberships = [];
  counts = [];
  plans = [];
  groupInvites = [];
  pendingRequests = [];
  acceptedFriendships = [];
  primeSupabase();
  useAuthStore.setState({
    user: { id: 'me' } as any,
    profile: { id: 'me', display_name: 'Rocío', avatar_url: null } as any,
  });
});

describe('GroupsScreen', () => {
  it('lists groups with headcount and an ember needs-you count', async () => {
    memberships = [
      {
        group_id: 'g1',
        role: 'admin',
        groups: { id: 'g1', name: 'Piso Gràcia', color: '#F7B0DC', created_at: '2026-01-01' },
      },
      {
        group_id: 'g2',
        role: 'member',
        groups: { id: 'g2', name: 'Cine i sopar', color: '#B7E4C7', created_at: '2026-01-02' },
      },
    ];
    counts = [
      { group_id: 'g1' },
      { group_id: 'g1' },
      { group_id: 'g1' },
      { group_id: 'g1' },
      { group_id: 'g2' },
    ];
    // Open fixed plan in g1 with no answer from me: waiting on me.
    plans = [
      {
        id: 'p1',
        group_id: 'g1',
        plan_type: 'fixed',
        status: 'open',
        min_people: 2,
        rsvps: [{ user_id: 'other', response: 'yes' }],
        plan_date_options: [],
      },
    ];

    await renderGroups();

    expect(await screen.findByText('Piso Gràcia')).toBeTruthy();
    expect(screen.getByText('4 people')).toBeTruthy();
    expect(screen.getByText(/1 plan waiting on you/)).toBeTruthy();
    expect(screen.getByText('Cine i sopar')).toBeTruthy();
    expect(screen.getByText('1 person')).toBeTruthy();
    expect(screen.getByText('New group')).toBeTruthy();

    const newGroupStyle = StyleSheet.flatten(screen.getByTestId('new-group').props.style);
    expect(newGroupStyle.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(screen.getByText('New group').props.numberOfLines).toBe(1);

    await fireEvent.press(screen.getByTestId('group-row-g2'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/group/g2');
  });

  it('answered plans do not count as waiting', async () => {
    memberships = [
      {
        group_id: 'g1',
        role: 'member',
        groups: { id: 'g1', name: 'Piso Gràcia', color: null, created_at: '2026-01-01' },
      },
    ];
    counts = [{ group_id: 'g1' }];
    plans = [
      {
        id: 'p1',
        group_id: 'g1',
        plan_type: 'fixed',
        status: 'open',
        min_people: 2,
        rsvps: [{ user_id: 'me', response: 'yes' }],
        plan_date_options: [],
      },
    ];

    await renderGroups();

    expect(await screen.findByText('Piso Gràcia')).toBeTruthy();
    expect(screen.queryByText(/waiting on you/)).toBeNull();
  });

  it('day one: join field and create button, no header pill', async () => {
    await renderGroups();

    expect(await screen.findByTestId('join-input')).toBeTruthy();
    expect(screen.getByTestId('create-group')).toBeTruthy();
    expect(screen.queryByTestId('new-group')).toBeNull();

    await fireEvent.press(screen.getByTestId('create-group'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/group/new');
  });

  it('collapsed invites row counts both kinds and opens the sheet', async () => {
    memberships = [
      {
        group_id: 'g1',
        role: 'member',
        groups: { id: 'g1', name: 'Piso Gràcia', color: null, created_at: '2026-01-01' },
      },
    ];
    counts = [{ group_id: 'g1' }];
    groupInvites = [
      {
        id: 'i1',
        created_at: '2026-07-29T10:00:00Z',
        group_id: 'gx',
        groups: { id: 'gx', name: 'Padel Dilluns', color: null, group_members: [] },
        inviter: { display_name: 'Marta' },
      },
    ];
    pendingRequests = [
      {
        id: 'fr1',
        created_at: '2026-07-28T10:00:00Z',
        requester: { id: 'p9', display_name: 'Aina Roig', handle: 'ainaroig', avatar_url: null },
      },
    ];

    await renderGroups();

    expect(await screen.findByText('2 invites')).toBeTruthy();
    expect(screen.getByText('Padel Dilluns, Aina Roig')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('invites-row'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/invites');
  });

  it('your-people row shows the friend count and opens find people', async () => {
    memberships = [
      {
        group_id: 'g1',
        role: 'member',
        groups: { id: 'g1', name: 'Piso Gràcia', color: null, created_at: '2026-01-01' },
      },
    ];
    counts = [{ group_id: 'g1' }];
    acceptedFriendships = [
      {
        requester_id: 'me',
        addressee_id: 'f1',
        requester: { id: 'me', display_name: 'Rocío', handle: 'rovidal', avatar_url: null },
        addressee: { id: 'f1', display_name: 'Aina Roig', handle: 'ainaroig', avatar_url: null },
      },
    ];

    await renderGroups();

    expect(await screen.findByText('1 friend')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('your-people'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/find-people');

    await fireEvent.press(screen.getByTestId('find-people'));
    expect(mockPush).toHaveBeenCalledTimes(2);
  });

  // PLA-80: a pasted link and a tapped one end on the same screen, which is the
  // one that shows the group before anybody is added to it. What that screen
  // does with the code is its own test file's business; the point here is that
  // this one does none of it.
  it('hands a pasted invite link to the join screen instead of joining', async () => {
    await renderGroups();

    const input = await screen.findByTestId('join-input');
    await fireEvent.changeText(input, 'planazo://join/ABCD2345');
    await fireEvent.press(screen.getByTestId('join-button'));

    expect(mockPush).toHaveBeenCalledWith('/(app)/join/ABCD2345');
    expect(mockRpc).not.toHaveBeenCalled();
  });

});
