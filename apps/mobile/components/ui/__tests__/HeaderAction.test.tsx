import { StyleSheet, type ViewStyle } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MIN_TOUCH_TARGET } from '../../../lib/a11y';
import { colors } from '../../../theme/tokens';
import { HeaderAction } from '../HeaderAction';

describe('HeaderAction', () => {
  it('uses the shared floor, aligns to the requested edge, and fires', async () => {
    const onPress = jest.fn();
    await render(<HeaderAction label="Save" align="end" onPress={onPress} testID="save" />);

    const style = StyleSheet.flatten(screen.getByTestId('save').props.style) as ViewStyle;
    expect(style.minWidth).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(style.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(style.alignItems).toBe('flex-end');
    expect(screen.getByText('Save').props.numberOfLines).toBe(1);

    await fireEvent.press(screen.getByTestId('save'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('announces and enforces its disabled state', async () => {
    const onPress = jest.fn();
    await render(<HeaderAction label="Send" disabled onPress={onPress} testID="send" />);

    expect(screen.getByRole('button', { disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByTestId('send'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('uses the secondary label color for a quiet action', async () => {
    await render(
      <HeaderAction label="Cancel" tone="muted" onPress={() => {}} testID="cancel" />
    );

    expect(StyleSheet.flatten(screen.getByText('Cancel').props.style).color).toBe(
      colors.textSecondary
    );
  });
});
