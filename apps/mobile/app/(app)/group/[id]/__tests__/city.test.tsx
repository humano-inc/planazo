import { Alert } from 'react-native';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import GroupCityScreen from '../city';
import { useAuthStore } from '../../../../../stores/authStore';
import { supabase } from '../../../../../lib/supabase';
import { renderWithQuery } from '../../../../../lib/testing/render';

const mockReplace = jest.fn();

jest.mock('../../../../../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: mockReplace,
    canGoBack: () => false,
  }),
  useLocalSearchParams: () => ({ id: 'g1' }),
}));

const mockFrom = supabase.from as jest.Mock;

const CITIES = [
  { id: 'c-mendoza', slug: 'mendoza', name: 'Mendoza' },
  { id: 'c-cordoba', slug: 'cordoba', name: 'Córdoba' },
  { id: 'c-rosario', slug: 'rosario', name: 'Rosario' },
];

/** Who is looking. Swapped per test; the screen reads the role off the rows. */
let myRole: 'admin' | 'member' = 'admin';
/** The rows the update reported touching. Empty is what RLS filtering looks like. */
let updated: unknown[] = [{ id: 'g1' }];
/** Every `groups` update the screen ran, payload first. */
let writes: unknown[][] = [];

const group = () => ({
  id: 'g1',
  name: 'Padel Dilluns',
  city_id: 'c-mendoza',
  city: { id: 'c-mendoza', name: 'Mendoza' },
  group_members: [
    { user_id: 'me', role: myRole, joined_at: '2026-01-01', profile: null },
    { user_id: 'u2', role: 'admin', joined_at: '2026-01-02', profile: null },
  ],
});

function primeSupabase() {
  mockFrom.mockImplementation((table: string) => {
    const c: Record<string, jest.Mock | unknown> = {};
    let mutation = false;
    ['select', 'eq', 'single'].forEach((m) => {
      c[m] = jest.fn(() => c);
    });
    c.update = jest.fn((payload: unknown) => {
      mutation = true;
      writes.push([payload]);
      return c;
    });
    c.then = (resolve: (v: unknown) => void) => {
      if (mutation) return Promise.resolve({ data: updated, error: null }).then(resolve);
      const data = table === 'cities' ? CITIES : group();
      return Promise.resolve({ data, error: null }).then(resolve);
    };
    return c;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  myRole = 'admin';
  updated = [{ id: 'g1' }];
  writes = [];
  primeSupabase();
  useAuthStore.setState({ user: { id: 'me' } as never });
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function renderCity() {
  const view = await renderWithQuery(<GroupCityScreen />);
  // FormScreen puts the caller's testID on its scroll view, so this is the
  // screen itself resolving rather than QueryScreen's loading state.
  await screen.findByTestId('group-city-scroll');
  return view;
}

describe('an admin', () => {
  it('gets the picker and a Save that waits for a different city', async () => {
    await renderCity();

    expect(await screen.findByTestId('city-rosario')).toBeTruthy();
    expect(screen.getByTestId('save').props.accessibilityState.disabled).toBe(true);
    expect(screen.queryByTestId('city-read-only')).toBeNull();
  });

  it('names both ends of the move once a different city is chosen', async () => {
    await renderCity();

    await fireEvent.press(await screen.findByTestId('city-rosario'));

    expect(screen.getByText('Moving from Mendoza to Rosario')).toBeTruthy();
    expect(screen.getByTestId('save').props.accessibilityState.disabled).toBe(false);
  });

  it('writes the city and leaves for Manage', async () => {
    await renderCity();

    await fireEvent.press(await screen.findByTestId('city-rosario'));
    await fireEvent.press(screen.getByTestId('save'));

    await waitFor(() => expect(writes).toEqual([[{ city_id: 'c-rosario' }]]));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(app)/group/g1/manage'));
  });

  /**
   * The half a screen cannot see. RLS filters an UPDATE rather than refusing
   * it, so a write that moved nothing arrives as success; the hook reads the
   * row back to catch it, and the sheet must stay put when it does.
   */
  it('stays open and says why when the write touched no rows', async () => {
    await renderCity();
    updated = [];

    await fireEvent.press(await screen.findByTestId('city-rosario'));
    await fireEvent.press(screen.getByTestId('save'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "That didn't go through",
        'Only an admin can move this group to another city.'
      )
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('a member who deep-links in', () => {
  /**
   * Manage draws no chevron for them, but `planazo://group/g1/city` is a route
   * like any other. Before this guard they got the whole picker and a Save
   * that closed the sheet over a group that never moved.
   */
  it('is told where the group meets instead of being offered the picker', async () => {
    myRole = 'member';
    await renderCity();

    expect(await screen.findByTestId('city-read-only')).toBeTruthy();
    expect(screen.getByText('This group meets in Mendoza')).toBeTruthy();
    expect(screen.queryByTestId('save')).toBeNull();
    expect(screen.queryByTestId('city-search')).toBeNull();
    expect(screen.queryByTestId('city-rosario')).toBeNull();
  });

  it('can still leave', async () => {
    myRole = 'member';
    await renderCity();

    await fireEvent.press(screen.getByTestId('cancel'));

    expect(mockReplace).toHaveBeenCalledWith('/(app)/group/g1/manage');
  });
});
