import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EditPlanScreen from '../edit';
import { supabase } from '../../../../../lib/supabase';
import { iso } from '../../../../../lib/testing/dates';

jest.mock('../../../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: (props: object) => React.createElement(View, props) };
});

const mockBack = jest.fn();
const mockReplace = jest.fn();
/** False on a cold deep link: the screen mounts with nothing behind it. */
let mockCanGoBack = true;
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'plan-1' }),
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
    replace: mockReplace,
    canGoBack: () => mockCanGoBack,
  }),
}));


const mockFrom = supabase.from as jest.Mock;

const PLAN = {
  id: 'plan-1',
  group_id: 'group-1',
  created_by: 'me',
  title: 'Padel',
  location: 'Club Vall d’Hebron',
  description: 'Bring cash',
  status: 'open',
  plan_type: 'fixed',
  min_people: 4,
  max_people: null,
};

let planUpdate: jest.Mock;
let planRow: Record<string, unknown> = PLAN;

/**
 * One builder serves both statements this screen makes: the read that fills
 * the fields and the write that saves them. Which one it resolves as is
 * decided by whether `.update()` was called on it.
 */
function primeSupabase(updateResult: unknown = { data: [{ id: 'plan-1' }], error: null }) {
  planUpdate = jest.fn();
  mockFrom.mockImplementation(() => {
    const c: any = {};
    let writing = false;
    ['select', 'eq', 'single'].forEach((m) => {
      c[m] = jest.fn(() => c);
    });
    c.update = jest.fn((values: Record<string, unknown>) => {
      writing = true;
      planUpdate(values);
      return c;
    });
    c.then = (resolve: (v: unknown) => void) =>
      Promise.resolve(writing ? updateResult : { data: planRow, error: null }).then(resolve);
    return c;
  });
}

async function renderEdit() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <EditPlanScreen />
    </QueryClientProvider>
  );
  // Fields start empty and fill from the query.
  await waitFor(() => expect(screen.getByTestId('title-input').props.value).toBe('Padel'));
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockCanGoBack = true;
  planRow = PLAN;
  primeSupabase();
});

describe('EditPlanScreen', () => {
  it('shows what the plan says now', async () => {
    await renderEdit();

    expect(screen.getByTestId('location-input').props.value).toBe('Club Vall d’Hebron');
    expect(screen.getByTestId('notes-input').props.value).toBe('Bring cash');
  });

  it('Save stays grey until something actually changed', async () => {
    await renderEdit();

    await fireEvent.press(screen.getByTestId('save'));
    expect(planUpdate).not.toHaveBeenCalled();

    // Retyping the same title is not a change, and neither is whitespace.
    await fireEvent.changeText(screen.getByTestId('title-input'), 'Padel ');
    await fireEvent.press(screen.getByTestId('save'));
    expect(planUpdate).not.toHaveBeenCalled();
  });

  it('refuses to save a plan with no title', async () => {
    await renderEdit();

    await fireEvent.changeText(screen.getByTestId('title-input'), '   ');
    await fireEvent.press(screen.getByTestId('save'));
    expect(planUpdate).not.toHaveBeenCalled();
  });

  it('saves the fields trimmed, clearing the place to null, then closes', async () => {
    await renderEdit();

    await fireEvent.changeText(screen.getByTestId('title-input'), '  Padel at the club  ');
    await fireEvent.changeText(screen.getByTestId('location-input'), '   ');
    await fireEvent.press(screen.getByTestId('save'));

    await waitFor(() => {
      expect(planUpdate).toHaveBeenCalledWith({
        title: 'Padel at the club',
        location: null,
        description: 'Bring cash',
      });
      expect(mockBack).toHaveBeenCalled();
    });
  });

  // Guideline 1.2: the filter runs before the write, wherever the text is typed.
  it('stops objectionable language before it reaches the database', async () => {
    await renderEdit();

    await fireEvent.changeText(screen.getByTestId('notes-input'), 'no retards allowed');
    await fireEvent.press(screen.getByTestId('save'));

    await waitFor(() =>
      // A UserFacingError, so the filter's own sentence survives the trip
      // through alertActionError instead of being flattened (PLA-105).
      expect(Alert.alert).toHaveBeenCalledWith(
        "That didn't go through",
        expect.stringContaining('language that isn’t allowed')
      )
    );
    expect(planUpdate).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  // PLA-16's shape: PostgREST answers 200 with no rows when the policy filtered
  // the row out. Closing the screen on that would report a save that never was.
  it('says so when the update comes back with no rows', async () => {
    primeSupabase({ data: [], error: null });
    await renderEdit();

    await fireEvent.changeText(screen.getByTestId('title-input'), 'Padel at nine');
    await fireEvent.press(screen.getByTestId('save'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "That didn't go through",
        expect.stringContaining("You're not the host of this plan any more")
      )
    );
    expect(mockBack).not.toHaveBeenCalled();
  });

  /**
   * PLA-79. `planazo://plan/plan-1/edit` from a message or a push mounts this
   * screen with an empty stack, and `back()` there is a no-op that logs and
   * does nothing: Cancel is the only way off this screen, so it stops being
   * leavable at all. Pinned on the two screens that leave it, because saving
   * closes the screen the same way Cancel does.
   */
  describe('opened by a deep link, with nothing behind it', () => {
    it('Cancel lands on the plan rather than doing nothing', async () => {
      mockCanGoBack = false;
      await renderEdit();

      await fireEvent.press(screen.getByTestId('cancel'));

      expect(mockReplace).toHaveBeenCalledWith('/(app)/plan/plan-1');
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('a successful save leaves the same way', async () => {
      mockCanGoBack = false;
      await renderEdit();

      await fireEvent.changeText(screen.getByTestId('title-input'), 'Padel at nine');
      await fireEvent.press(screen.getByTestId('save'));

      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(app)/plan/plan-1'));
    });
  });

  it('reports a failed write instead of closing', async () => {
    primeSupabase({ data: null, error: { message: 'permission denied for table plans' } });
    await renderEdit();

    await fireEvent.changeText(screen.getByTestId('title-input'), 'Padel at nine');
    await fireEvent.press(screen.getByTestId('save'));

    // The opposite case: postgres wrote this one, so the user gets classified
    // copy and never sees the raw message (PLA-105).
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "That didn't go through",
        'Something went wrong saving your answer. Try again.'
      )
    );
    expect(mockBack).not.toHaveBeenCalled();
  });

  describe('the end', () => {
    const start = iso(5, 20);
    const end = iso(5, 22);

    it('shows the start without offering it, and leaves Save grey until the end changes', async () => {
      planRow = { ...PLAN, event_date: start, ends_at: end };
      await renderEdit();

      expect(screen.queryByTestId('time-pill')).toBeNull();
      expect(screen.getByTestId('start-settled')).toBeTruthy();
      expect(screen.getByText('22:00')).toBeTruthy();
      expect(screen.getByTestId('save').props.accessibilityState?.disabled).toBe(true);
    });

    it('saves a changed end with the other fields', async () => {
      planRow = { ...PLAN, event_date: start, ends_at: end };
      await renderEdit();

      await fireEvent.press(screen.getByTestId('end-time-pill'));
      await fireEvent(
        screen.getByTestId('end-time-wheel'),
        'valueChange',
        { type: 'set' },
        new Date(2026, 0, 1, 23, 30)
      );
      await fireEvent.press(screen.getByTestId('save'));

      const d = new Date(start);
      await waitFor(() =>
        expect(planUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Padel',
            ends_at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 30).toISOString(),
          })
        )
      );
    });

    it('leaves the end out of the write when it did not change', async () => {
      planRow = { ...PLAN, event_date: start, ends_at: end };
      await renderEdit();

      await fireEvent.changeText(screen.getByTestId('title-input'), 'Padel at the club');
      await fireEvent.press(screen.getByTestId('save'));

      await waitFor(() => expect(planUpdate).toHaveBeenCalled());
      expect(planUpdate.mock.calls[0][0]).not.toHaveProperty('ends_at');
    });

    it('leaves a plan with no end alone until the host adds one', async () => {
      planRow = { ...PLAN, event_date: start, ends_at: null };
      await renderEdit();

      expect(screen.getByTestId('end-add')).toBeTruthy();
      expect(screen.getByTestId('save').props.accessibilityState?.disabled).toBe(true);

      await fireEvent.changeText(screen.getByTestId('title-input'), 'Padel at the club');
      await fireEvent.press(screen.getByTestId('save'));

      await waitFor(() => expect(planUpdate).toHaveBeenCalled());
      expect(planUpdate.mock.calls[0][0]).not.toHaveProperty('ends_at');
    });

    it('saves an end the host added', async () => {
      planRow = { ...PLAN, event_date: start, ends_at: null };
      await renderEdit();

      await fireEvent.press(screen.getByTestId('end-add'));
      await fireEvent.press(screen.getByTestId('save'));

      await waitFor(() =>
        expect(planUpdate).toHaveBeenCalledWith(expect.objectContaining({ ends_at: end }))
      );
    });

    it('clears an end the host removed', async () => {
      planRow = { ...PLAN, event_date: start, ends_at: end };
      await renderEdit();

      await fireEvent.press(screen.getByTestId('end-remove'));
      await fireEvent.press(screen.getByTestId('save'));

      await waitFor(() =>
        expect(planUpdate).toHaveBeenCalledWith(expect.objectContaining({ ends_at: null }))
      );
    });

    it('offers no end on a vote nobody has locked', async () => {
      planRow = { ...PLAN, plan_type: 'flexible', event_date: null, locked_date: null };
      await renderEdit();

      expect(screen.queryByTestId('end-time-pill')).toBeNull();
      expect(screen.getByText(/The dates, the group and the numbers stay as they are\./)).toBeTruthy();
    });

    it('says the start stays as it is on a plan that has one', async () => {
      planRow = { ...PLAN, event_date: start, ends_at: end };
      await renderEdit();

      expect(screen.getByText(/The start, the group and the numbers stay as they are\./)).toBeTruthy();
    });
  });
});
