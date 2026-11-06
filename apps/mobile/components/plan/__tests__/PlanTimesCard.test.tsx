import { useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PlanTimesCard } from '../PlanTimesCard';
import { MIN_TOUCH_TARGET } from '../../../lib/a11y';
import { fmtDay, isoOfDate, localDate } from '../../../lib/dates';
import { UNTOUCHED_END, type PlanEndDraft } from '../../../lib/planEnd';
import { iso } from '../../../lib/testing/dates';

// The ui barrel reaches Supabase transitively; the card never calls it.
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

// Every prop lands on a View, so a test can read `minimumDate` and call
// `onValueChange` the way the native picker would.
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: (props: object) => React.createElement(View, props) };
});

const DAY = isoOfDate(new Date(iso(5)));
const dayLater = (n: number) => isoOfDate(new Date(iso(5 + n)));
const onStartTimeChange = jest.fn();
const onEndChange = jest.fn();

/** Holds the state the way a screen does, so a pick shows up on the next render. */
function Harness({
  startDay = DAY,
  startTime = '20:00',
  settled = false,
  initialEnd = UNTOUCHED_END,
}: {
  startDay?: string;
  startTime?: string;
  settled?: boolean;
  initialEnd?: PlanEndDraft | null;
}) {
  const [time, setTime] = useState(startTime);
  const [end, setEnd] = useState(initialEnd);
  return (
    <PlanTimesCard
      startDay={startDay}
      startTime={time}
      onStartTimeChange={
        settled
          ? undefined
          : (next) => {
              onStartTimeChange(next);
              setTime(next);
            }
      }
      end={end}
      onEndChange={(next) => {
        onEndChange(next);
        setEnd(next);
      }}
    />
  );
}

const atTime = (h: number, m = 0) => new Date(2026, 0, 1, h, m);
const pick = (wheel: string, picked: Date) =>
  fireEvent(screen.getByTestId(wheel), 'valueChange', { type: 'set' }, picked);

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('with no end', () => {
  it('offers to add one, and shows nothing else about it', async () => {
    await render(<Harness initialEnd={null} />);

    expect(screen.getByTestId('end-add')).toHaveTextContent('Add end time');
    expect(screen.queryByText('Ends')).toBeNull();
    expect(screen.queryByTestId('end-time-pill')).toBeNull();
    expect(screen.queryByTestId('end-remove')).toBeNull();
    expect(screen.queryByTestId('end-passed')).toBeNull();
  });

  it('says nothing about an end having gone by, because there is none', async () => {
    await render(<Harness initialEnd={null} startDay={isoOfDate(new Date(iso(-2)))} />);
    expect(screen.queryByTestId('end-passed')).toBeNull();
  });
});

describe('adding and removing an end', () => {
  it('adding starts two hours after the start, on the same day', async () => {
    await render(<Harness initialEnd={null} />);

    await fireEvent.press(screen.getByTestId('end-add'));

    expect(onEndChange).toHaveBeenCalledWith(UNTOUCHED_END);
    expect(screen.getByText('Ends')).toBeTruthy();
    expect(screen.getByText('22:00')).toBeTruthy();
    expect(screen.getByTestId('end-day-label')).toHaveTextContent('Same day');
    expect(screen.queryByTestId('end-rollover')).toBeNull();
    expect(screen.queryByTestId('end-add')).toBeNull();
  });

  it('removing goes back to offering one', async () => {
    await render(<Harness />);

    await fireEvent.press(screen.getByTestId('end-remove'));

    expect(onEndChange).toHaveBeenCalledWith(null);
    expect(screen.getByTestId('end-add')).toBeTruthy();
    expect(screen.queryByText('Ends')).toBeNull();
  });

  it('removing takes an open wheel with it', async () => {
    await render(<Harness />);

    await fireEvent.press(screen.getByTestId('end-time-pill'));
    await fireEvent.press(screen.getByTestId('end-remove'));
    await fireEvent.press(screen.getByTestId('end-add'));

    expect(screen.queryByTestId('end-time-wheel')).toBeNull();
  });
});

describe('what it reads', () => {

  it('reads "Today" when the plan starts today', async () => {
    await render(<Harness startDay={isoOfDate(new Date())} startTime="00:00" />);
    expect(screen.getByTestId('end-day-label')).toHaveTextContent('Today');
  });

  it('gives every control a full touch target', async () => {
    await render(<Harness />);
    ['time-pill', 'end-day-pill', 'end-time-pill', 'end-remove'].forEach((id) => {
      const { minHeight } = StyleSheet.flatten(screen.getByTestId(id).props.style);
      expect(minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    });
  });

  it('gives adding an end a full touch target too', async () => {
    await render(<Harness initialEnd={null} />);
    const { minHeight } = StyleSheet.flatten(screen.getByTestId('end-add').props.style);
    expect(minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });
});

describe('the start', () => {
  it('moves an end nobody has touched along with it', async () => {
    await render(<Harness />);

    await fireEvent.press(screen.getByTestId('time-pill'));
    await pick('start-wheel', atTime(18, 15));

    expect(onStartTimeChange).toHaveBeenCalledWith('18:15');
    expect(screen.getByText('20:15')).toBeTruthy();
    expect(onEndChange).not.toHaveBeenCalled();
  });

  it('is shown rather than offered where it is settled', async () => {
    await render(<Harness settled />);

    expect(screen.getByText('Starts')).toBeTruthy();
    expect(screen.queryByText('Starts at')).toBeNull();
    expect(screen.queryByTestId('time-pill')).toBeNull();
    expect(screen.getByTestId('start-settled')).toHaveTextContent(
      `${fmtDay(localDate(DAY).toISOString())} · 20:00`
    );
  });
});

describe('the end time', () => {
  it('stays on the same day when it is later than the start', async () => {
    await render(<Harness />);

    await fireEvent.press(screen.getByTestId('end-time-pill'));
    await pick('end-time-wheel', atTime(23, 45));

    expect(onEndChange).toHaveBeenCalledWith({ day: null, time: '23:45' });
    expect(screen.getByTestId('end-day-label')).toHaveTextContent('Same day');
    expect(screen.queryByTestId('end-rollover')).toBeNull();
  });

  it('moves to the next day with a notice when it is earlier than the start', async () => {
    await render(<Harness startTime="22:00" />);

    await fireEvent.press(screen.getByTestId('end-time-pill'));
    await pick('end-time-wheel', atTime(2));

    const next = dayLater(1);
    expect(screen.getByTestId('end-day-label')).toHaveTextContent(
      fmtDay(localDate(next).toISOString())
    );
    const weekday = localDate(next).toLocaleDateString('en-GB', { weekday: 'long' });
    expect(screen.getByTestId('end-rollover')).toHaveTextContent(
      `Runs past midnight, so it ends on ${weekday}.`
    );
  });
});

describe('the end day', () => {
  it('cannot be set before the start', async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByTestId('end-day-pill'));
    expect(screen.getByTestId('end-day-wheel').props.minimumDate).toEqual(localDate(DAY));
  });

  it('reads the date the host picked, and keeps a chosen time', async () => {
    await render(<Harness initialEnd={{ day: null, time: '12:00' }} />);

    await fireEvent.press(screen.getByTestId('end-day-pill'));
    await pick('end-day-wheel', localDate(dayLater(2)));

    expect(onEndChange).toHaveBeenCalledWith({ day: dayLater(2), time: '12:00' });
    expect(screen.getByTestId('end-day-label')).toHaveTextContent(
      fmtDay(localDate(dayLater(2)).toISOString())
    );
    expect(screen.queryByTestId('end-rollover')).toBeNull();
  });
});

describe('an end that has already gone by', () => {
  it('says so instead of the rollover notice', async () => {
    await render(<Harness startDay={isoOfDate(new Date(iso(-2)))} />);
    expect(screen.getByTestId('end-passed')).toHaveTextContent(
      'That has already gone by. Pick a later end.'
    );
  });
});

describe('the wheels', () => {
  it('open one at a time, and a second press closes one', async () => {
    await render(<Harness />);

    await fireEvent.press(screen.getByTestId('end-time-pill'));
    expect(screen.getByTestId('end-time-wheel')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('end-day-pill'));
    expect(screen.queryByTestId('end-time-wheel')).toBeNull();
    expect(screen.getByTestId('end-day-wheel')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('end-day-pill'));
    expect(screen.queryByTestId('end-day-wheel')).toBeNull();
  });

  it('stay open after a pick on iOS, where the spinner sits in the page', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await render(<Harness />);

    await fireEvent.press(screen.getByTestId('end-time-pill'));
    await pick('end-time-wheel', atTime(23));

    expect(screen.getByTestId('end-time-wheel')).toBeTruthy();
  });

  it('close after a pick on Android, where the picker is a dialog', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await render(<Harness />);

    await fireEvent.press(screen.getByTestId('end-time-pill'));
    await pick('end-time-wheel', atTime(23));

    expect(screen.queryByTestId('end-time-wheel')).toBeNull();
    expect(onEndChange).toHaveBeenCalledWith({ day: null, time: '23:00' });
  });

  it('close without changing anything when the dialog is dismissed', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await render(<Harness />);

    await fireEvent.press(screen.getByTestId('time-pill'));
    await fireEvent(screen.getByTestId('start-wheel'), 'dismiss');

    expect(screen.queryByTestId('start-wheel')).toBeNull();
    expect(onStartTimeChange).not.toHaveBeenCalled();
  });
});
