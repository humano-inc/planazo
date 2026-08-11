import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MIN_TOUCH_TARGET } from '../../../lib/a11y';
import { colors } from '../../../theme/tokens';
import { TextAction } from '../TextAction';

describe('TextAction', () => {
  it('uses a one-line label in the shared touch target and fires', async () => {
    const onPress = jest.fn();
    await render(
      <TextAction label="New group" align="end" onPress={onPress} testID="new-group" />
    );

    const style = StyleSheet.flatten(screen.getByTestId('new-group').props.style) as ViewStyle;
    expect(style.minWidth).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(style.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(style.alignItems).toBe('flex-end');
    expect(screen.getByText('New group').props.numberOfLines).toBe(1);

    await fireEvent.press(screen.getByTestId('new-group'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses the destructive action color when requested', async () => {
    await render(
      <TextAction label="Remove" tone="destructive" onPress={() => {}} testID="remove" />
    );

    const style = StyleSheet.flatten(screen.getByText('Remove').props.style) as TextStyle;
    expect(style.color).toBe(colors.accentPressed);
  });

  it('announces and enforces its disabled state', async () => {
    const onPress = jest.fn();
    await render(<TextAction label="Invite" disabled onPress={onPress} testID="invite" />);

    expect(screen.getByRole('button', { disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByTestId('invite'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
