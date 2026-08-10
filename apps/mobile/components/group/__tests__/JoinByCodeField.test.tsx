import { render, screen, fireEvent } from '@testing-library/react-native';
import { JoinByCodeField } from '../JoinByCodeField';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// The field touches no network at all. It reaches `lib/supabase` only through
// the `components/ui` barrel, which pulls in the photo field, which needs real
// `EXPO_PUBLIC_*` values at import time.
jest.mock('../../../lib/supabase', () => ({ supabase: {} }));

beforeEach(() => {
  jest.clearAllMocks();
});

async function paste(text: string) {
  await render(<JoinByCodeField />);
  await fireEvent.changeText(screen.getByTestId('join-input'), text);
  await fireEvent.press(screen.getByTestId('join-button'));
}

/**
 * The field's whole job is turning what somebody pasted into a route. It joins
 * nothing itself (PLA-80), so every test here ends at a push.
 */
describe('JoinByCodeField', () => {
  it('opens the join screen with the code pulled out of a whole link', async () => {
    await paste('https://planazo.me/join/ABCD2345');
    expect(mockPush).toHaveBeenCalledWith('/(app)/join/ABCD2345');
  });

  it('takes a bare code too, in whatever case it arrives', async () => {
    await paste('abcd2345');
    expect(mockPush).toHaveBeenCalledWith('/(app)/join/ABCD2345');
  });

  it('finds the code in a sentence somebody typed around it', async () => {
    await paste('join us! planazo://join/K4M7P2QR');
    expect(mockPush).toHaveBeenCalledWith('/(app)/join/K4M7P2QR');
  });

  it('goes nowhere on an empty field', async () => {
    await render(<JoinByCodeField />);
    await fireEvent.press(screen.getByTestId('join-button'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('goes nowhere on text with no code in it', async () => {
    await paste('join my group!');
    expect(mockPush).not.toHaveBeenCalled();
  });

  // 0, 1, I and O are not in the code alphabet, so eight characters is not
  // enough on its own to be a code.
  it('goes nowhere on eight characters that cannot be a code', async () => {
    await paste('ABC10OI2');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('empties itself on the way out, so the spent code is not still sitting there', async () => {
    await render(<JoinByCodeField />);
    const input = screen.getByTestId('join-input');
    await fireEvent.changeText(input, 'ABCD2345');
    await fireEvent.press(screen.getByTestId('join-button'));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(input.props.value).toBe('');
  });

  it('goes on the keyboard’s own key, not only on the button', async () => {
    await render(<JoinByCodeField />);
    await fireEvent.changeText(screen.getByTestId('join-input'), 'ABCD2345');
    await fireEvent(screen.getByTestId('join-input'), 'submitEditing');

    expect(mockPush).toHaveBeenCalledWith('/(app)/join/ABCD2345');
  });
});
