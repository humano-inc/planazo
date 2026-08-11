import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import AskPollScreen from '../poll';
import { supabase } from '../../../../../lib/supabase';
import { chain } from '../../../../../lib/testing/supabase';
import { renderWithQuery } from '../../../../../lib/testing/render';

const mockBack = jest.fn();

jest.mock('../../../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('expo-router', () =>
  require('../../../../../lib/testing/router').expoRouterMock(
    () => ({ back: mockBack }),
    () => ({ id: 'plan-1' })
  )
);

const mockFrom = supabase.from as jest.Mock;

let pollsChain: ReturnType<typeof chain>;
let optionsChain: ReturnType<typeof chain>;

beforeEach(() => {
  jest.clearAllMocks();
  pollsChain = chain({ data: { id: 'new-poll' }, error: null });
  optionsChain = chain({ error: null });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'plan_polls') return pollsChain;
    if (table === 'plan_poll_options') return optionsChain;
    return chain({ data: null, error: null });
  });
});

function renderAsk() {
  return renderWithQuery(<AskPollScreen />);
}

describe('AskPollScreen', () => {
  it('Ask stays dead until the question has two real options', async () => {
    renderAsk();
    await waitFor(() => expect(screen.getByTestId('ask')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('ask'));
    expect(pollsChain.insert).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('poll-question-input'), 'Which film?');
    await fireEvent.changeText(screen.getByTestId('poll-option-input-0'), 'Dune Part Two');
    await fireEvent.press(screen.getByTestId('ask'));
    expect(pollsChain.insert).not.toHaveBeenCalled();

    // Two identical options are one option twice
    await fireEvent.changeText(screen.getByTestId('poll-option-input-1'), 'Dune Part Two');
    await fireEvent.press(screen.getByTestId('ask'));
    expect(pollsChain.insert).not.toHaveBeenCalled();
  });

  it('asks: inserts the poll and its options in typed order, then goes back', async () => {
    renderAsk();
    await waitFor(() => expect(screen.getByTestId('poll-question-input')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('poll-question-input'), '  Which film? ');
    await fireEvent.changeText(screen.getByTestId('poll-option-input-0'), 'Dune Part Two');
    await fireEvent.changeText(screen.getByTestId('poll-option-input-1'), ' Anora ');
    await fireEvent.press(screen.getByTestId('poll-add-option'));
    await fireEvent.changeText(screen.getByTestId('poll-option-input-2'), 'The Substance');
    await fireEvent.press(screen.getByTestId('ask'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(pollsChain.insert).toHaveBeenCalledWith({
      plan_id: 'plan-1',
      question: 'Which film?',
    });
    expect(optionsChain.insert).toHaveBeenCalledWith([
      { poll_id: 'new-poll', plan_id: 'plan-1', label: 'Dune Part Two', position: 0 },
      { poll_id: 'new-poll', plan_id: 'plan-1', label: 'Anora', position: 1 },
      { poll_id: 'new-poll', plan_id: 'plan-1', label: 'The Substance', position: 2 },
    ]);
  });

  it('a blank middle option is dropped, not sent', async () => {
    renderAsk();
    await waitFor(() => expect(screen.getByTestId('poll-question-input')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('poll-question-input'), 'Which bar?');
    await fireEvent.changeText(screen.getByTestId('poll-option-input-0'), 'Bar Colombo');
    await fireEvent.press(screen.getByTestId('poll-add-option'));
    await fireEvent.changeText(screen.getByTestId('poll-option-input-2'), 'La Plata');
    await fireEvent.press(screen.getByTestId('ask'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(optionsChain.insert).toHaveBeenCalledWith([
      { poll_id: 'new-poll', plan_id: 'plan-1', label: 'Bar Colombo', position: 0 },
      { poll_id: 'new-poll', plan_id: 'plan-1', label: 'La Plata', position: 1 },
    ]);
  });
});
