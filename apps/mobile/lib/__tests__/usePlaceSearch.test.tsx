import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { usePlaceSearch } from '../usePlaceSearch';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));

const invoke = supabase.functions.invoke as jest.Mock;
const ARENA = { id: 'p1', title: 'Arena Padel Mendoza', subtitle: 'Pedro del Castillo' };

async function render(initial: string, cityId: string | null = 'c1') {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(({ text }: { text: string }) => usePlaceSearch(text, cityId), {
    wrapper,
    initialProps: { text: initial },
  });
}

const settle = (ms = 300) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  jest.useFakeTimers();
  invoke.mockReset();
  invoke.mockResolvedValue({ data: { suggestions: [ARENA] }, error: null });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('usePlaceSearch', () => {
  it('asks place-search for the trimmed text and the city', async () => {
    const view = await render('  Arena  ');
    await settle();

    expect(invoke).toHaveBeenCalledWith('place-search', { body: { q: 'Arena', cityId: 'c1' } });
    expect(view.result.current.suggestions).toEqual([ARENA]);
  });

  it.each(['', 'Ar', '  A  '])('does not spend a request on %j', async (text) => {
    const view = await render(text);
    await settle();

    expect(invoke).not.toHaveBeenCalled();
    expect(view.result.current.suggestions).toEqual([]);
  });

  it('waits for a pause in the typing', async () => {
    const view = await render('');
    await view.rerender({ text: 'Are' });
    await settle(100);
    await view.rerender({ text: 'Aren' });
    await settle(100);
    await view.rerender({ text: 'Arena' });
    await settle(299);
    expect(invoke).not.toHaveBeenCalled();

    await settle(1);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('place-search', { body: { q: 'Arena', cityId: 'c1' } });
  });

  it('empties the list as soon as the text is cleared', async () => {
    const view = await render('Arena');
    await settle();
    expect(view.result.current.suggestions).toEqual([ARENA]);

    await view.rerender({ text: '' });
    expect(view.result.current.suggestions).toEqual([]);
  });

  it('a failed search is just no suggestions, and it does not retry', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('down') });
    const view = await render('Arena');
    await settle(5000);

    expect(view.result.current.suggestions).toEqual([]);
    expect(view.result.current.isError).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('a thrown request is also just no suggestions', async () => {
    invoke.mockRejectedValue(new Error('offline'));
    const view = await render('Arena');
    await settle();

    expect(view.result.current.suggestions).toEqual([]);
  });

  it('searches again for a different city', async () => {
    const first = await render('Arena', 'c1');
    await settle();
    first.unmount();
    await render('Arena', 'c2');
    await settle();

    expect(invoke).toHaveBeenLastCalledWith('place-search', { body: { q: 'Arena', cityId: 'c2' } });
  });
});
