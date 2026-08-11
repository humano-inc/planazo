import { StyleSheet, type ViewStyle } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MIN_TOUCH_TARGET } from '../../../lib/a11y';
import { BackButton } from '../BackButton';

describe('BackButton', () => {
  it('renders the platform back symbol in the shared touch target and fires', async () => {
    const onPress = jest.fn();
    await render(<BackButton onPress={onPress} testID="back" />);

    const style = StyleSheet.flatten(screen.getByTestId('back').props.style) as ViewStyle;
    expect(style.minWidth).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(style.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(screen.getByTestId('back-glyph')).toBeTruthy();
    expect(screen.getByLabelText('Back')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('back'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps a destination label on one line and names it for accessibility', async () => {
    await render(<BackButton label="Weekend Crew" onPress={() => {}} testID="back" />);

    expect(screen.getByText('Weekend Crew').props.numberOfLines).toBe(1);
    expect(screen.getByLabelText('Back to Weekend Crew')).toBeTruthy();
  });

  it('accepts an explicit accessibility label for a generic visible label', async () => {
    await render(
      <BackButton
        label="Back"
        accessibilityLabel="Back"
        onPress={() => {}}
        testID="back"
      />
    );

    expect(screen.getByLabelText('Back')).toBeTruthy();
    expect(screen.queryByLabelText('Back to Back')).toBeNull();
  });
});
