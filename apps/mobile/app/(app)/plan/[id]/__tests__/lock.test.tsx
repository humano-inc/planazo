import { Alert } from 'react-native';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import LockPlanScreen from '../lock';
import { supabase } from '../../../../../lib/supabase';
import { fmtDay } from '../../../../../lib/dates';
import { iso } from '../../../../../lib/testing/dates';
import { chain } from '../../../../../lib/testing/supabase';
import { renderWithQuery } from '../../../../../lib/testing/render';

jest.mock('../../../../../lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

const mockBack = jest.fn();
let mockDate = '';
let mockOptionId: string | undefined = 'd1';
jest.mock('expo-router', () => ({
  ...require('../../../../../lib/testing/router').expoRouterMock(
    () => ({ back: mockBack }),
    () => ({ id: 'plan-1', optionId: mockOptionId, date: mockDate })
  ),
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text testID="redirect">{href}</Text>;
  },
}));

jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: (props: object) => React.createElement(View, props) };
});

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

/** The same day as `mockDate`, at a time, the way the sheet builds it. */
const onThatDay = (h: number, m = 0) => {
  const d = new Date(mockDate);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString();
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  // An option is the day at local midnight, which is what the sheet receives.
  mockDate = iso(5, 0);
  mockOptionId = 'd1';
  mockFrom.mockImplementation(() =>
    chain({ data: { id: 'plan-1', group_id: 'g1', plan_type: 'flexible' }, error: null })
  );
  mockRpc.mockResolvedValue({ data: { locked: true }, error: null });
});

describe('LockPlanScreen', () => {
  it('names the date and what locking does', async () => {
    await renderWithQuery(<LockPlanScreen />);

    expect(screen.getByText(`Lock in ${fmtDay(mockDate)}`)).toBeTruthy();
    expect(
      screen.getByText('This ends the vote and notifies everyone who can make it.')
    ).toBeTruthy();
  });

  it('locks with the default start and no end, then closes', async () => {
    await renderWithQuery(<LockPlanScreen />);
    expect(screen.getByTestId('end-add')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('lock-confirm'));

    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith('lock_plan', {
        p_plan_id: 'plan-1',
        p_date_option_id: 'd1',
        p_starts_at: onThatDay(20, 30),
      })
    );
    expect(mockRpc.mock.calls[0][1].p_ends_at).toBeUndefined();
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('sends the default end once the host adds one', async () => {
    await renderWithQuery(<LockPlanScreen />);

    await fireEvent.press(screen.getByTestId('end-add'));
    await fireEvent.press(screen.getByTestId('lock-confirm'));

    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith(
        'lock_plan',
        expect.objectContaining({ p_ends_at: onThatDay(22, 30) })
      )
    );
  });

  it('sends the times the host picked', async () => {
    await renderWithQuery(<LockPlanScreen />);

    await fireEvent.press(screen.getByTestId('time-pill'));
    await fireEvent(
      screen.getByTestId('start-wheel'),
      'valueChange',
      { type: 'set' },
      new Date(2026, 0, 1, 13, 0)
    );
    await fireEvent.press(screen.getByTestId('end-add'));
    await fireEvent.press(screen.getByTestId('end-time-pill'));
    await fireEvent(
      screen.getByTestId('end-time-wheel'),
      'valueChange',
      { type: 'set' },
      new Date(2026, 0, 1, 17, 30)
    );
    await fireEvent.press(screen.getByTestId('lock-confirm'));

    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith(
        'lock_plan',
        expect.objectContaining({
          p_starts_at: onThatDay(13),
          p_ends_at: onThatDay(17, 30),
        })
      )
    );
  });

  it('"Not yet" closes without locking', async () => {
    await renderWithQuery(<LockPlanScreen />);

    await fireEvent.press(screen.getByTestId('lock-not-yet'));

    expect(mockBack).toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  // Someone withdrew while the sheet was open. The RPC answers this without an
  // error, so closing on "no error" would leave the vote running unnoticed.
  it('says so and stays open when the date no longer has enough people', async () => {
    mockRpc.mockResolvedValue({ data: { locked: false, reason: 'no_viable_date' }, error: null });
    await renderWithQuery(<LockPlanScreen />);

    await fireEvent.press(screen.getByTestId('lock-confirm'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect((Alert.alert as jest.Mock).mock.calls[0].join(' ')).toContain(
      "That date doesn't have enough people any more."
    );
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('reports a failed write without closing', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'raw postgres text' } });
    await renderWithQuery(<LockPlanScreen />);

    await fireEvent.press(screen.getByTestId('lock-confirm'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect((Alert.alert as jest.Mock).mock.calls[0].join(' ')).not.toContain('raw postgres text');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('will not lock an end that has already gone by', async () => {
    mockDate = iso(-1, 0);
    await renderWithQuery(<LockPlanScreen />);

    await fireEvent.press(screen.getByTestId('end-add'));
    expect(screen.getByTestId('end-passed')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('lock-confirm'));

    expect(mockRpc).not.toHaveBeenCalled();
  });

  describe('a deep link with nothing to lock', () => {
    it('goes back to the plan when the option is missing', async () => {
      mockOptionId = undefined;
      await renderWithQuery(<LockPlanScreen />);
      expect(screen.getByTestId('redirect')).toHaveTextContent('/(app)/plan/plan-1');
    });

    it('goes back to the plan when the date is missing', async () => {
      mockDate = '';
      await renderWithQuery(<LockPlanScreen />);
      expect(screen.getByTestId('redirect')).toBeTruthy();
    });

    it('goes back to the plan when the date does not parse', async () => {
      mockDate = 'not-a-date';
      await renderWithQuery(<LockPlanScreen />);
      expect(screen.getByTestId('redirect')).toBeTruthy();
    });
  });
});
