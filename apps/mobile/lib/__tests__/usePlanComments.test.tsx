import { Alert } from 'react-native';
import { act, waitFor } from '@testing-library/react-native';
import { usePlanComments, usePlanCommentsCard } from '../usePlanComments';
import { supabase } from '../supabase';
import { chain, type ChainMock } from '../testing/supabase';
import { renderHookWithQuery } from '../testing/render';
import { useAuthStore } from '../../stores/authStore';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

const row = (id: string, body = `comment ${id}`) => ({
  id,
  plan_id: 'p1',
  author_id: 'u-marta',
  body,
  created_at: '2026-11-05T12:00:00Z',
  author: { display_name: 'Marta', avatar_url: null },
});

let read: unknown;
let write: unknown;
let builders: ChainMock[];
let deletions: ChainMock[];

const inserts = () => builders.flatMap((b) => b.insert.mock.calls);

beforeEach(() => {
  jest.clearAllMocks();
  builders = [];
  deletions = [];
  read = { data: [row('a'), row('b')], count: 2, error: null };
  write = { error: null };
  useAuthStore.setState({ user: { id: 'u-me' } } as never);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockFrom.mockImplementation(() => {
    const builder = chain(() => read);
    builder.insert = jest.fn(() => chain(() => write));
    builder.delete = jest.fn(() => {
      const deletion = chain(() => write);
      deletions.push(deletion);
      return deletion;
    });
    builders.push(builder);
    return builder;
  });
});

describe('usePlanComments: the list', () => {
  it('reads the whole list, oldest first', async () => {
    const { result } = await renderHookWithQuery(() => usePlanComments('p1'));
    await waitFor(() => expect(result.current.comments).toHaveLength(2));

    expect(mockFrom).toHaveBeenCalledWith('plan_comments');
    expect(builders[0]!.eq).toHaveBeenCalledWith('plan_id', 'p1');
    expect(builders[0]!.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(builders[0]!.limit).not.toHaveBeenCalled();
  });

  it("keeps react-query's own names for its own fields", async () => {
    read = { data: null, error: { message: 'boom' } };
    const { result } = await renderHookWithQuery(() => usePlanComments('p1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.comments).toBeUndefined();
  });
});

describe('usePlanComments: sending', () => {
  async function send(draft: string) {
    const view = await renderHookWithQuery(() => usePlanComments('p1'));
    await waitFor(() => expect(view.result.current.comments).toBeTruthy());
    await act(async () => {
      await view.result.current.send.mutateAsync(draft).catch(() => {});
    });
    return view;
  }

  it('stores the comment trimmed, as the signed-in user', async () => {
    await send('  see you there \n');
    expect(inserts()).toEqual([
      [{ plan_id: 'p1', author_id: 'u-me', body: 'see you there' }],
    ]);
  });

  it('invalidates the prefix, which is what reaches the plan-detail card too', async () => {
    const { invalidated } = await send('hello');
    expect(invalidated).toEqual([['plan-comments', 'p1']]);
  });

  it('refuses a banned word before it is written, and says which field', async () => {
    const { invalidated } = await send('you absolute f4gg0t');

    expect(inserts()).toEqual([]);
    expect(invalidated).toEqual([]);
    expect(Alert.alert).toHaveBeenCalledWith(
      "That didn't go through",
      expect.stringContaining('That comment contains language'),
    );
  });

  it('explains an RLS refusal as the plan having changed under you', async () => {
    write = { error: { code: '42501', message: 'new row violates row-level security policy' } };
    await send('hello?');

    expect(Alert.alert).toHaveBeenCalledWith(
      "That didn't go through",
      "This plan isn't taking comments any more.",
    );
  });

  it('never shows a raw database message', async () => {
    write = { error: { code: '23514', message: 'violates check constraint "plan_comments_body_length"' } };
    await send('hello');

    const [, body] = (Alert.alert as jest.Mock).mock.calls[0]!;
    expect(body).not.toContain('plan_comments_body_length');
  });
});

describe('usePlanComments: deleting', () => {
  async function remove(id: string) {
    const view = await renderHookWithQuery(() => usePlanComments('p1'));
    await waitFor(() => expect(view.result.current.comments).toBeTruthy());
    await act(async () => {
      await view.result.current.remove.mutateAsync(id).catch(() => {});
    });
    return view;
  }

  it('deletes that comment and refreshes the list', async () => {
    const { invalidated } = await remove('c9');

    expect(deletions).toHaveLength(1);
    expect(deletions[0]!.eq).toHaveBeenCalledWith('id', 'c9');
    expect(invalidated).toEqual([['plan-comments', 'p1']]);
  });

  it('reports a failure without a raw message', async () => {
    write = { error: { code: '500', message: 'internal database detail' } };
    await remove('c9');

    const [, body] = (Alert.alert as jest.Mock).mock.calls[0]!;
    expect(body).not.toContain('internal database detail');
  });
});

describe('usePlanCommentsCard', () => {
  it('asks for the newest two and a count of everything the viewer can read', async () => {
    read = { data: [row('newest'), row('older')], count: 9, error: null };
    const { result } = await renderHookWithQuery(() => usePlanCommentsCard('p1'));
    await waitFor(() => expect(result.current.card).toBeTruthy());

    const builder = builders[0]!;
    expect(builder.select).toHaveBeenCalledWith(expect.any(String), { count: 'exact' });
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(2);

    expect(result.current.card?.total).toBe(9);
    expect(result.current.card?.latest.map((c) => c.id)).toEqual(['older', 'newest']);
  });

  it('sits under the list key, so one invalidation refreshes both', async () => {
    const { client, result } = await renderHookWithQuery(() => usePlanCommentsCard('p1'));
    await waitFor(() => expect(result.current.card).toBeTruthy());

    const keys = client.getQueryCache().getAll().map((query) => query.queryKey);
    expect(keys).toEqual([['plan-comments', 'p1', 'card']]);
  });

  it('surfaces a failed read rather than an empty conversation', async () => {
    read = { data: null, count: null, error: { message: 'boom' } };
    const { result } = await renderHookWithQuery(() => usePlanCommentsCard('p1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.card).toBeUndefined();
  });
});
