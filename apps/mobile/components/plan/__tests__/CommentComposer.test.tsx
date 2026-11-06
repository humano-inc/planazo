import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { COMMENT_MAX_LENGTH } from '@planazo/shared';
import { CommentComposer } from '../CommentComposer';

// The ui barrel reaches the supabase client through lib/images, which reads env
// at import time. The composer never touches it.
jest.mock('../../../lib/supabase', () => ({ supabase: { from: jest.fn(), storage: {} } }));

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ fontScale: mockFontScale, height: 844, width: 390, scale: 3 }),
}));

const onSend = jest.fn();

function Harness({ initial = '', sending = false }: { initial?: string; sending?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <CommentComposer value={value} onChangeText={setValue} onSend={onSend} sending={sending} />
  );
}

const inputHeight = () =>
  (StyleSheet.flatten(screen.getByTestId('comment-input').props.style) as { height?: number }).height;

beforeEach(() => {
  onSend.mockClear();
  mockFontScale = 1;
});

describe('CommentComposer', () => {
  it('sends when there is something to send', async () => {
    await render(<Harness initial="see you there" />);
    await fireEvent.press(screen.getByTestId('comment-send'));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['empty', ''],
    ['only whitespace', '  \n '],
  ])('does not send when it is %s', async (_name, initial) => {
    await render(<Harness initial={initial} />);
    await fireEvent.press(screen.getByTestId('comment-send'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not send twice while one is on its way', async () => {
    await render(<Harness initial="hello" sending />);
    expect(screen.getByText('Sending…')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('comment-send'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('stops typing at the length the database takes', async () => {
    await render(<Harness />);
    expect(screen.getByTestId('comment-input').props.maxLength).toBe(COMMENT_MAX_LENGTH);
  });

  describe('height', () => {
    it('states one line when empty, which is what shrinks it back after a send', async () => {
      await render(<Harness />);
      expect(inputHeight()).toBe(48);
    });

    it('leaves sizing to the field as soon as it holds any text', async () => {
      await render(<Harness />);
      await fireEvent.changeText(screen.getByTestId('comment-input'), 'a');
      expect(inputHeight()).toBeUndefined();
    });

    it('goes back to one line when the text is taken away', async () => {
      await render(<Harness initial="a long comment" />);
      await fireEvent.changeText(screen.getByTestId('comment-input'), '');
      expect(inputHeight()).toBe(48);
    });

    it('grows the empty line with the text size, so the placeholder is not clipped', async () => {
      mockFontScale = 3;
      await render(<Harness />);
      expect(inputHeight()).toBe(22 * 3 + 24);
    });
  });
});
