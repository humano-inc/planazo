import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  MY_GROUPS_KEY,
  MY_GROUPS_STALE_MS,
  invalidateMyGroups,
  useMyGroups,
} from '../useMyGroups';
import { supabase } from '../supabase';
import { useAuthStore } from '../../stores/authStore';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

/** Rows exactly as the select returns them: the group nested under `groups`. */
let rows: unknown[] = [];
/** How many times the query actually went to the network. */
let fetches = 0;

function primeSupabase() {
  mockFrom.mockImplementation(() => {
    const c: any = {};
    ['select', 'eq'].forEach((m) => {
      c[m] = jest.fn(() => c);
    });
    c.then = (resolve: (v: unknown) => void) => {
      fetches += 1;
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    };
    return c;
  });
}

/**
 * The app's client, not a convenient one. `refetchOnWindowFocus: 'always'` is
 * what app/_layout.tsx sets, and it is half of what PLA-78 is about — a client
 * without it would pass these tests while the app still refetched.
 */
function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: 'always' } },
  });
}

/** Background, then foreground: what AppState drives in app/_layout.tsx. */
async function foreground() {
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

async function renderMyGroups(client = makeClient()) {
  const view = await renderHook(() => useMyGroups(), { wrapper: wrapper(client) });
  return { ...view, client };
}

const group = (id: string, name: string, color: string | null = '#fff') => ({
  groups: { id, name, color },
});

beforeEach(() => {
  jest.clearAllMocks();
  rows = [];
  fetches = 0;
  primeSupabase();
  useAuthStore.setState({ user: { id: 'user-1' } as any });
});

describe('useMyGroups', () => {
  it('returns the groups the join rows point at', async () => {
    rows = [group('g1', 'Padel'), group('g2', 'Flatmates', null)];
    const { result } = await renderMyGroups();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.groups).toEqual([
      { id: 'g1', name: 'Padel', color: '#fff' },
      { id: 'g2', name: 'Flatmates', color: null },
    ]);
    expect(result.current.hasGroups).toBe(true);
  });

  it('drops a join row whose group came back null, rather than rendering a hole', async () => {
    rows = [group('g1', 'Padel'), { groups: null }];
    const { result } = await renderMyGroups();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.groups).toEqual([{ id: 'g1', name: 'Padel', color: '#fff' }]);
  });

  it('reports no groups rather than an error when you are in none', async () => {
    rows = [];
    const { result } = await renderMyGroups();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.groups).toEqual([]);
    expect(result.current.hasGroups).toBe(false);
  });

  it('never fetches, and never reads as loading, for a signed-out user', async () => {
    useAuthStore.setState({ user: null });
    const { result } = await renderMyGroups();

    expect(result.current.loading).toBe(false);
    expect(result.current.hasGroups).toBe(false);
    expect(fetches).toBe(0);
  });

  it('serves a second caller from cache instead of fetching again (the create sheet on top of the tab bar)', async () => {
    rows = [group('g1', 'Padel')];
    const client = makeClient();
    const { result } = await renderMyGroups(client);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetches).toBe(1);

    // A second observer on data inside staleTime: what opening "+" does.
    const second = await renderHook(() => useMyGroups(), { wrapper: wrapper(client) });
    await waitFor(() => expect(second.result.current.hasGroups).toBe(true));
    expect(fetches).toBe(1);
  });

  it('does not refetch when the app comes back to the foreground', async () => {
    rows = [group('g1', 'Padel')];
    const { result } = await renderMyGroups();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetches).toBe(1);

    // The tab bar holds this query mounted for the whole session, so this is
    // every foreground for as long as the app is open (PLA-78).
    await foreground();
    await foreground();

    expect(fetches).toBe(1);
  });

  it('still refetches on a foreground once the staleTime has run out', async () => {
    rows = [group('g1', 'Padel')];
    const client = makeClient();
    const { result } = await renderMyGroups(client);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetches).toBe(1);

    // Backdate the fetch rather than wait five real minutes. This is the
    // backstop for a membership change no invalidation reached, so it has to
    // be a real refetch and not just a comment in useMyGroups.
    const entry = client.getQueryCache().find({ queryKey: ['my-groups', 'user-1'] })!;
    entry.state = { ...entry.state, dataUpdatedAt: Date.now() - MY_GROUPS_STALE_MS - 1 };

    await foreground();

    await waitFor(() => expect(fetches).toBe(2));
  });
});

describe('invalidateMyGroups', () => {
  it('reaches the hook that keys on the user, not just the bare prefix', async () => {
    rows = [group('g1', 'Padel')];
    const client = makeClient();
    const { result } = await renderMyGroups(client);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetches).toBe(1);

    // The group you just created, arriving because the write said so and not
    // because the cache went stale on its own.
    rows = [group('g1', 'Padel'), group('g2', 'Flatmates')];
    invalidateMyGroups(client);

    await waitFor(() => expect(result.current.groups).toHaveLength(2));
    expect(fetches).toBe(2);
  });

  it('leaves other caches alone', async () => {
    const client = makeClient();
    client.setQueryData(['groups'], ['untouched']);
    client.setQueryData(['home-plans'], ['untouched']);

    invalidateMyGroups(client);

    expect(client.getQueryData(['groups'])).toEqual(['untouched']);
    expect(client.getQueryData(['home-plans'])).toEqual(['untouched']);
  });

  it('keys on the prefix every user entry shares', () => {
    expect(MY_GROUPS_KEY).toEqual(['my-groups']);
  });
});
