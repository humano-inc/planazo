import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { PlanCommentsCard } from '../PlanCommentsCard';
import { supabase } from '../../../lib/supabase';
import { chain } from '../../../lib/testing/supabase';
import { renderWithQuery } from '../../../lib/testing/render';

jest.mock('../../../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockPush = jest.fn();
jest.mock('expo-router', () =>
  require('../../../lib/testing/router').expoRouterMock(() => ({ push: mockPush }))
);

const mockFrom = supabase.from as jest.Mock;

const row = (id: string, name: string, body: string, authorId = 'u-them') => ({
  id,
  plan_id: 'p1',
  author_id: authorId,
  body,
  created_at: new Date().toISOString(),
  author: { display_name: name, avatar_url: null },
});

function answer(result: unknown) {
  mockFrom.mockImplementation(() => chain(result));
}

const renderCard = (isCancelled = false) =>
  renderWithQuery(<PlanCommentsCard planId="p1" userId="u-me" isCancelled={isCancelled} />);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PlanCommentsCard', () => {
  it('shows the latest two, oldest first, and the total', async () => {
    answer({
      data: [row('c2', 'Marta', 'running late'), row('c1', 'Pau', 'what time?')],
      count: 5,
      error: null,
    });
    await renderCard();

    expect(await screen.findByText('5 comments')).toBeTruthy();
    const bodies = screen.getAllByText(/running late|what time\?/).map((n) => n.props.children);
    expect(bodies).toEqual(['what time?', 'running late']);
  });

  it('calls your own comment yours', async () => {
    answer({ data: [row('c1', 'Marta', 'mine', 'u-me')], count: 1, error: null });
    await renderCard();

    expect(await screen.findByText('You')).toBeTruthy();
    expect(screen.queryByText('Marta')).toBeNull();
    expect(screen.getByText('1 comment')).toBeTruthy();
  });

  it('opens the comments screen when tapped', async () => {
    answer({ data: [row('c1', 'Marta', 'hello')], count: 1, error: null });
    await renderCard();

    await fireEvent.press(await screen.findByTestId('comments-card'));

    expect(mockPush).toHaveBeenCalledWith('/plan/p1/comments');
  });

  it('invites the first comment on a plan with none, and taps through to write it', async () => {
    answer({ data: [], count: 0, error: null });
    await renderCard();

    await fireEvent.press(await screen.findByLabelText('Add the first comment'));

    expect(mockPush).toHaveBeenCalledWith('/plan/p1/comments');
  });

  it('hides on a cancelled plan with no comments', async () => {
    answer({ data: [], count: 0, error: null });
    const { client } = await renderCard(true);

    await waitFor(() => expect(client.isFetching()).toBe(0));

    expect(screen.queryByTestId('comments-card')).toBeNull();
    expect(screen.queryByText('Comments')).toBeNull();
  });

  it('keeps showing a cancelled plan\'s comments', async () => {
    answer({ data: [row('c1', 'Marta', 'before the rain')], count: 1, error: null });
    await renderCard(true);

    expect(await screen.findByText('before the rain')).toBeTruthy();
  });

  it('says so when the read failed, rather than inviting a first comment', async () => {
    answer({ data: null, count: null, error: { message: 'boom' } });
    await renderCard();

    expect(await screen.findByText("That didn't load")).toBeTruthy();
    expect(screen.queryByText('Add the first comment')).toBeNull();
  });
});
