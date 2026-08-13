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

/**
 * What the update's own `select` comes back with. Separate from the read,
 * because the hook now reads the row back to tell a move from a no-op, and the
 * two shapes differ: the read is one group, the write is the rows it touched.
 */
let writeResult: unknown = { data: [{ id: 'g1' }], error: null };

async function renderCity() {
  const view = await renderHookWithQuery(() => useGroupCity('g1'));
  await waitFor(() => expect(view.result.current.data).toBeTruthy());
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  builders = [];
  writeResult = { data: [{ id: 'g1' }], error: null };
  // alertActionError is the hook's onError; it must not reach the OS here.
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockFrom.mockImplementation(() => {
    // One builder serves both the read and the write, and only `update` says
    // which this one turned out to be.
    let mutation = false;
    const builder = chain(() => (mutation ? writeResult : { data: GROUP, error: null }));
    const update = builder.update;
    builder.update = jest.fn((...args: unknown[]) => {
      mutation = true;
      return update(...args);
    });
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
    writeResult = { data: null, error: { message: 'new row violates row-level security' } };

    await act(async () => {
      result.current.save.mutate('c-cordoba');
    });

    await waitFor(() => expect(result.current.save.isError).toBe(true));
  });

  /**
   * The failure this hook exists to catch. A member's UPDATE is not rejected,
   * it is filtered: postgres applies it to the rows the policy admits, which
   * is none of them, and PostgREST reports that as success with nothing in it.
   * `packages/integration-tests/src/group-city.test.ts` proves the database
   * really does answer that way.
   */
  it('treats an update that touched no rows as a failure, not a move', async () => {
    const { result } = await renderCity();
    writeResult = { data: [], error: null };

    await act(async () => {
      result.current.save.mutate('c-cordoba');
    });

    await waitFor(() => expect(result.current.save.isError).toBe(true));
    expect(Alert.alert).toHaveBeenCalledWith(
      "That didn't go through",
      'Only an admin can move this group to another city.'
    );
  });

  it('reads the row back, so an empty result can be told from a move', async () => {
    const { result } = await renderCity();

    await act(async () => {
      result.current.save.mutate('c-cordoba');
    });

    await waitFor(() => expect(result.current.save.isSuccess).toBe(true));
    const wrote = builders.find((b) => b.update.mock.calls.length > 0);
    expect(wrote?.select).toHaveBeenCalledWith('id');
  });
});
