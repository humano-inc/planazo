import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NewGroupScreen from '../new';
import { useAuthStore } from '../../../../stores/authStore';
import { supabase } from '../../../../lib/supabase';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
/** False on a cold deep link: the sheet opens with nothing behind it. */
let mockCanGoBack = true;
let mockParams: Record<string, string | undefined> = {};

jest.mock('../../../../lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack,
  }),
  useLocalSearchParams: () => mockParams,
}));


const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

const ME = { id: 'me', display_name: 'Rocío', handle: 'rovidal', avatar_url: null };
const FRIENDSHIPS = [
  {
    requester_id: 'me',
    addressee_id: 'f1',
    requester: ME,
    addressee: { id: 'f1', display_name: 'Aina Roig', handle: 'ainaroig', avatar_url: null },
  },
  {
    requester_id: 'f2',
    addressee_id: 'me',
    requester: { id: 'f2', display_name: 'Marta Serra', handle: 'martaserra', avatar_url: null },
    addressee: ME,
  },
];

const CITIES = [
  { id: 'c-mendoza', slug: 'mendoza', name: 'Mendoza' },
  { id: 'c-cordoba', slug: 'cordoba', name: 'Córdoba' },
];

function primeSupabase() {
  mockFrom.mockImplementation((table: string) => {
    const c: any = {};
    ['select', 'eq', 'or', 'single', 'insert'].forEach((m) => {
      c[m] = jest.fn(() => c);
    });
    const data = table === 'cities' ? CITIES : FRIENDSHIPS;
    c.then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ data, error: null }).then(resolve);
    return c;
  });
}

/** Open the city step, choose one, and let it collapse back down. */
async function pickCity(slug = 'mendoza') {
  await fireEvent.press(await screen.findByTestId('city-open'));
  await fireEvent.press(await screen.findByTestId(`city-${slug}`));
}

/** create_group returns the group row; invite_to_group returns a status. */
function primeRpc() {
  mockRpc.mockImplementation((fn: string) =>
    Promise.resolve(
      fn === 'create_group'
        ? { data: { id: 'g-new', name: 'Padel Dilluns' }, error: null }
        : { data: { status: 'invited' }, error: null }
    )
  );
}

async function renderNew() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <NewGroupScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockCanGoBack = true;
  primeSupabase();
  primeRpc();
  useAuthStore.setState({
    user: { id: 'me' } as any,
    profile: ME as any,
  });
});

describe('NewGroupScreen', () => {
  it('demands a name before anything else', async () => {
    await renderNew();

    expect(await screen.findByText('Name it first')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('name-input'), 'Padel Dilluns');
    expect(screen.getByText('Pick a city first')).toBeTruthy();
    await pickCity();
    expect(screen.getByText('Create group')).toBeTruthy();
  });

  /**
   * PLA-88: the city is required, and the picked city is what the group is
   * created with. Both halves are here because a CTA that unlocks without
   * sending `p_city_id` would look exactly like a working screen.
   */
  it('sends the picked city to create_group, and collapses the step once picked', async () => {
    await renderNew();

    await fireEvent.changeText(screen.getByTestId('name-input'), 'Padel Dilluns');
    await pickCity('cordoba');

    // The long list is gone and the choice is a single line again.
    expect(screen.queryByTestId('city-mendoza')).toBeNull();
    expect(screen.getByTestId('city-picked')).toBeTruthy();
    expect(screen.getByText("Ideas will come from what's on in Córdoba.")).toBeTruthy();

    await fireEvent.press(screen.getByText('Create group'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockRpc).toHaveBeenCalledWith(
      'create_group',
      expect.objectContaining({ p_city_id: 'c-cordoba' })
    );
  });

  it('finds a city by the accents nobody types', async () => {
    await renderNew();

    await fireEvent.press(await screen.findByTestId('city-open'));
    await fireEvent.changeText(screen.getByTestId('city-search'), 'cordoba');

    expect(screen.getByTestId('city-cordoba')).toBeTruthy();
    expect(screen.queryByTestId('city-mendoza')).toBeNull();
  });

  it('lists friends from both friendship directions', async () => {
    await renderNew();

    expect(await screen.findByText('Aina Roig')).toBeTruthy();
    expect(screen.getByText('@ainaroig')).toBeTruthy();
    expect(screen.getByText('Marta Serra')).toBeTruthy();
  });

  it('picking people turns the CTA into create-and-invite and sends the invites', async () => {
    await renderNew();

    await fireEvent.changeText(screen.getByTestId('name-input'), 'Padel Dilluns');
    await pickCity();
    await fireEvent.press(await screen.findByTestId('person-f1'));
    await fireEvent.press(screen.getByTestId('person-f2'));

    expect(screen.getByText('2 selected')).toBeTruthy();
    await fireEvent.press(screen.getByText('Create and invite 2'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    // PLA-35: one server-side call replaces the group + membership inserts,
    // and the client no longer names itself as creator or picks the role.
    expect(mockRpc).toHaveBeenCalledWith(
      'create_group',
      expect.objectContaining({ p_name: 'Padel Dilluns' })
    );
    expect(mockFrom).not.toHaveBeenCalledWith('group_members');
    expect(mockRpc).toHaveBeenCalledWith('invite_to_group', {
      p_group_id: 'g-new',
      p_invitee: 'f1',
    });
    expect(mockRpc).toHaveBeenCalledWith('invite_to_group', {
      p_group_id: 'g-new',
      p_invitee: 'f2',
    });
  });

  /**
   * `planazo://group/new` opens this sheet with nothing behind it (the params
   * above exist for exactly that), so back() is a no-op there and the old
   * back-then-push-in-100ms pair left the sheet up with the new group pushed
   * in behind it. Cancel had the same hole.
   */
  it('replaces a deep-linked sheet instead of leaving it standing', async () => {
    mockCanGoBack = false;
    await renderNew();

    await fireEvent.changeText(screen.getByTestId('name-input'), 'Cine');
    await pickCity();
    await fireEvent.press(screen.getByText('Create group'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(app)/group/g-new'));
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('cancels out of a deep-linked sheet that has no screen behind it', async () => {
    mockCanGoBack = false;
    await renderNew();

    await fireEvent.press(screen.getByTestId('cancel'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(app)/(tabs)');
  });

  it('deselecting via the chip drops the pick', async () => {
    await renderNew();

    await fireEvent.press(await screen.findByTestId('person-f1'));
    expect(screen.getByText('1 selected')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('chip-f1'));
    expect(screen.queryByText('1 selected')).toBeNull();
  });

  it('stores the picked swatch on create', async () => {
    await renderNew();

    await fireEvent.changeText(screen.getByTestId('name-input'), 'Cine');
    await pickCity();
    await fireEvent.press(screen.getByTestId('swatch-2'));
    await fireEvent.press(screen.getByText('Create group'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockRpc).toHaveBeenCalledWith(
      'create_group',
      expect.objectContaining({ p_color: '#F6C453' })
    );
  });

  it('maps the deep-link colour index to the shared field once at startup', async () => {
    mockParams = { color: '3' };
    await renderNew();

    expect(screen.getByTestId('swatch-3').props.accessibilityState).toEqual({ selected: true });

    await fireEvent.changeText(screen.getByTestId('name-input'), 'Cine');
    await pickCity();
    await fireEvent.press(screen.getByText('Create group'));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        'create_group',
        expect.objectContaining({ p_color: '#B7E4C7' })
      );
    });
  });
});
