import { Alert, Platform, StyleSheet } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import PlanCommentsRoute from '../comments';
import { supabase } from '../../../../../lib/supabase';
import { chooseFromSheet, mockActionSheet, sheetOptions } from '../../../../../lib/testing/actionSheet';
import { chain, type ChainMock } from '../../../../../lib/testing/supabase';
import { renderWithQuery } from '../../../../../lib/testing/render';
import { useAuthStore } from '../../../../../stores/authStore';

jest.mock('../../../../../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockCanGoBack = true;
let mockParamId = 'p1';
jest.mock('expo-router', () =>
  require('../../../../../lib/testing/router').expoRouterMock(
    () => ({
      push: mockPush,
      replace: mockReplace,
      back: mockBack,
      canGoBack: () => mockCanGoBack,
    }),
    () => ({ id: mockParamId })
  )
);

const mockFrom = supabase.from as jest.Mock;

const comment = (id: string, authorId: string, name: string, body: string) => ({
  id,
  plan_id: 'p1',
  author_id: authorId,
  body,
  created_at: new Date().toISOString(),
  author: { display_name: name, avatar_url: null },
});

const MINE = comment('c-mine', 'u-me', 'Me', 'my own comment');
const THEIRS = comment('c-theirs', 'u-marta', 'Marta', "Marta's comment");

let planResult: unknown;
let commentsResult: unknown;
let writeResult: unknown;
let commentBuilders: ChainMock[];

const inserts = () => commentBuilders.flatMap((b) => b.insert.mock.calls.map(([row]) => row));

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack = true;
  mockParamId = 'p1';
  commentBuilders = [];
  useAuthStore.setState({ user: { id: 'u-me' } } as never);
  planResult = {
    data: { id: 'p1', title: 'Padel + pizza', status: 'open', plan_type: 'fixed', audience: 'group' },
    error: null,
  };
  commentsResult = { data: [THEIRS, MINE], error: null };
  writeResult = { error: null };
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  mockActionSheet();
  mockFrom.mockImplementation((table: string) => {
    if (table === 'plans') return chain(() => planResult);
    const builder = chain(() => commentsResult);
    builder.insert = jest.fn(() => chain(() => writeResult));
    builder.delete = jest.fn(() => chain(() => writeResult));
    commentBuilders.push(builder);
    return builder;
  });
});

const renderScreen = () => renderWithQuery(<PlanCommentsRoute />);

describe('the list', () => {
  it('shows every comment, oldest first', async () => {
    await renderScreen();

    await screen.findByText('my own comment');
    const bodies = screen.getAllByText(/comment$/).map((node) => node.props.children);
    expect(bodies).toEqual(["Marta's comment", 'my own comment']);
  });

  it('names the plan it belongs to', async () => {
    await renderScreen();
    expect(await screen.findByText('Padel + pizza')).toBeTruthy();
  });

  it('invites the first comment when there are none', async () => {
    commentsResult = { data: [], error: null };
    await renderScreen();

    expect(await screen.findByText('Nothing here yet')).toBeTruthy();
    expect(screen.getByText("Ask what time, or say what you're bringing.")).toBeTruthy();
  });

  it('says so when the comments failed to load', async () => {
    commentsResult = { data: null, error: { message: 'boom' } };
    await renderScreen();

    expect(await screen.findByText("That didn't load")).toBeTruthy();
    expect(screen.queryByText('Nothing here yet')).toBeNull();
  });

  it('says the plan is gone when it cannot be seen', async () => {
    planResult = { data: null, error: { code: 'PGRST116', details: 'The result contains 0 rows' } };
    await renderScreen();

    expect(await screen.findByText("This plan isn't here")).toBeTruthy();
    expect(screen.queryByTestId('comment-input')).toBeNull();
  });

  it('goes back to the plan from a cold push, where there is nothing behind it', async () => {
    mockCanGoBack = false;
    await renderScreen();

    await fireEvent.press(await screen.findByTestId('comments-back'));

    expect(mockReplace).toHaveBeenCalledWith('/(app)/plan/p1');
  });
});

describe('the composer', () => {
  it('holds Send back until there is something to send', async () => {
    await renderScreen();
    const input = await screen.findByTestId('comment-input');

    await fireEvent.press(screen.getByTestId('comment-send'));
    await fireEvent.changeText(input, '   \n ');
    await fireEvent.press(screen.getByTestId('comment-send'));

    expect(inserts()).toEqual([]);
  });

  it('sends the comment, and clears the field once it has landed', async () => {
    await renderScreen();
    const input = await screen.findByTestId('comment-input');

    await fireEvent.changeText(input, ' see you there ');
    await fireEvent.press(screen.getByTestId('comment-send'));

    await waitFor(() =>
      expect(inserts()).toEqual([{ plan_id: 'p1', author_id: 'u-me', body: 'see you there' }])
    );
    await waitFor(() => expect(input.props.value).toBe(''));
  });

  it('keeps what you wrote when the send fails', async () => {
    writeResult = { error: { code: '500', message: 'internal' } };
    await renderScreen();
    const input = await screen.findByTestId('comment-input');

    await fireEvent.changeText(input, 'do not lose this');
    await fireEvent.press(screen.getByTestId('comment-send'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(screen.getByTestId('comment-input').props.value).toBe('do not lose this');
  });

  it('is gone on a cancelled plan, which stays readable', async () => {
    planResult = {
      data: { id: 'p1', title: 'Padel + pizza', status: 'cancelled', plan_type: 'fixed', audience: 'group' },
      error: null,
    };
    await renderScreen();

    expect(await screen.findByText('my own comment')).toBeTruthy();
    expect(screen.getByTestId('comments-closed')).toBeTruthy();
    expect(screen.queryByTestId('comment-input')).toBeNull();
  });

  it('leaves the home indicator to FormScreen once the composer has gone', async () => {
    planResult = {
      data: { id: 'p1', title: 'Padel + pizza', status: 'cancelled', plan_type: 'fixed', audience: 'group' },
      error: null,
    };
    await renderScreen();
    await screen.findByText('my own comment');

    const { paddingBottom } = StyleSheet.flatten(
      screen.getByTestId('comments-scroll').props.contentContainerStyle
    );
    // No insets in this suite, so FormScreen's own floor is what should be left.
    expect(paddingBottom).toBe(16);
  });

  it('does not carry a half-written comment to another plan', async () => {
    const { rerenderSameInstance } = await renderScreen();
    await fireEvent.changeText(await screen.findByTestId('comment-input'), 'meant for plan one');

    mockParamId = 'p2';
    await rerenderSameInstance();

    expect((await screen.findByTestId('comment-input')).props.value).toBe('');
  });
});

describe('long-pressing a comment', () => {
  const longPress = async (id: string) => {
    const row = await screen.findByTestId(`comment-${id}`);
    await fireEvent(row, 'longPress');
  };

  it('offers your own for deleting, and deletes it', async () => {
    await renderScreen();
    await longPress('c-mine');

    expect(sheetOptions()).toEqual(['Delete comment', 'Cancel']);

    await chooseFromSheet(0);

    await waitFor(() =>
      expect(commentBuilders.some((b) => b.delete.mock.calls.length > 0)).toBe(true)
    );
  });

  it("offers someone else's for reporting, naming them for the block toggle", async () => {
    await renderScreen();
    await longPress('c-theirs');

    expect(sheetOptions()).toEqual(['Report comment', 'Cancel']);

    await chooseFromSheet(0);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(app)/report',
      params: {
        type: 'comment',
        id: 'c-theirs',
        subject: "Marta's comment",
        personId: 'u-marta',
        personName: 'Marta',
      },
    });
  });

  it('does nothing when the sheet is cancelled', async () => {
    await renderScreen();
    await longPress('c-mine');

    await chooseFromSheet(1);

    expect(commentBuilders.some((b) => b.delete.mock.calls.length > 0)).toBe(false);
  });

  it('offers a screen reader the same action, by name', async () => {
    await renderScreen();
    const row = await screen.findByTestId('comment-c-theirs');

    expect(row.props.accessibilityActions).toEqual([{ name: 'act', label: 'Report comment' }]);

    await act(async () => {
      row.props.onAccessibilityAction({ nativeEvent: { actionName: 'act' } });
    });

    expect(sheetOptions()).toEqual(['Report comment', 'Cancel']);
  });
});
