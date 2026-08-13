import { Alert } from 'react-native';
import { act, waitFor } from '@testing-library/react-native';
import { useGroupCity } from '../useGroupCity';
import { supabase } from '../supabase';
import { chain, type ChainMock } from '../testing/supabase';
import { renderHookWithQuery } from '../testing/render';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

const GROUP = {
  id: 'g1',
  name: 'Padel',
  city_id: 'c-mendoza',
  city: { id: 'c-mendoza', name: 'Mendoza' },
  group_members: [],
};

/** Every builder the hook asked for: the write is rarely the newest one. */
let builders: ChainMock[] = [];
const updates = () => builders.flatMap((b) => b.update.mock.calls);

async function renderCity() {
  const view = await renderHookWithQuery(() => useGroupCity('g1'));
  await waitFor(() => expect(view.result.current.data).toBeTruthy());
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  builders = [];
  // alertActionError is the hook's onError; it must not reach the OS here.
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockFrom.mockImplementation(() => {
    const builder = chain({ data: GROUP, error: null });
    builders.push(builder);
    return builder;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useGroupCity', () => {
  it('reads the group through the Manage query, city and all', async () => {
    const { result } = await renderCity();

    expect(result.current.data?.city.name).toBe('Mendoza');
    expect(mockFrom).toHaveBeenCalledWith('groups');
  });

  it('writes only the city, and nothing else about the group', async () => {
    const { result } = await renderCity();

    await act(async () => {
      result.current.save.mutate('c-cordoba');
    });

    await waitFor(() => expect(updates()).toEqual([[{ city_id: 'c-cordoba' }]]));
  });

  /**
   * Manage, the group screen and the groups list all draw the city, and all
   * three go stale on this one write. `invalidateGroup` is what names them, so
   * the test is that the hook calls it rather than picking keys of its own.
   */
  it('goes through invalidateGroup, so every cache that draws a city refetches', async () => {
    const { result, invalidated } = await renderCity();

    await act(async () => {
      result.current.save.mutate('c-cordoba');
    });

    await waitFor(() =>
      expect(invalidated).toEqual(
        expect.arrayContaining([['group', 'g1'], ['group-manage', 'g1'], ['groups']])
      )
    );
  });

  it('surfaces a refused write instead of pretending it landed', async () => {
    const { result } = await renderCity();
    mockFrom.mockImplementation(() => {
      const builder = chain({ data: null, error: { message: 'new row violates row-level security' } });
      builders.push(builder);
      return builder;
    });

    await act(async () => {
      result.current.save.mutate('c-cordoba');
    });

    await waitFor(() => expect(result.current.save.isError).toBe(true));
  });
});
