import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MIN_TOUCH_TARGET } from '../../../lib/a11y';
import { type } from '../../../theme/tokens';
import { BackButton } from '../BackButton';
import { HeaderAction } from '../HeaderAction';
import { HeaderRow } from '../HeaderRow';
import { MoreGlyph } from '../NavigationGlyphs';
import { ActionButton } from '../ActionButton';

describe('HeaderRow', () => {
  it('renders a left action, the shared title, and a right action', async () => {
    await render(
      <HeaderRow
        left={<HeaderAction label="Cancel" onPress={jest.fn()} testID="cancel" />}
        right={<HeaderAction label="Save" onPress={jest.fn()} testID="save" />}
        testID="header"
        title="Edit plan"
      />,
    );

    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Edit plan')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText('Edit plan').props.style)).toMatchObject(
      type.screenHeader,
    );
  });

  it('renders a spacer opposite a left action', async () => {
    await render(
      <HeaderRow
        left={<HeaderAction label="Cancel" onPress={jest.fn()} testID="cancel" />}
        rightSpacerWidth={48}
        testID="header"
        title="New plan"
      />,
    );

    expect(screen.getByText('New plan')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('header-spacer').props.style).width).toBe(48);
  });

  it('renders a back-only row', async () => {
    await render(
      <HeaderRow left={<BackButton label="Back" onPress={jest.fn()} testID="back" />} />,
    );

    expect(screen.getByTestId('back')).toBeTruthy();
    expect(screen.queryByText('Save')).toBeNull();
  });

  it('renders the action-only menu shape', async () => {
    await render(
      <HeaderRow
        left={<BackButton label="Weekend Crew" onPress={jest.fn()} testID="back" />}
        right={
          <ActionButton
            accessibilityLabel="Plan options"
            onPress={jest.fn()}
            testID="menu"
          >
            <MoreGlyph />
          </ActionButton>
        }
      />,
    );

    expect(screen.getByTestId('back')).toBeTruthy();
    expect(screen.getByLabelText('Plan options')).toBeTruthy();
    expect(screen.queryByText('Edit plan')).toBeNull();
  });

  it.each(['back', 'menu'])('holds the shared target floor for the %s action', async (testID) => {
    await render(
      <HeaderRow
        left={<BackButton label="Back" onPress={jest.fn()} testID="back" />}
        right={
          <ActionButton onPress={jest.fn()} testID="menu">
            <MoreGlyph />
          </ActionButton>
        }
      />,
    );

    const style = StyleSheet.flatten(screen.getByTestId(testID).props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(style.minWidth).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it('does not press a disabled right action', async () => {
    const onPress = jest.fn();
    await render(
      <HeaderRow
        left={<HeaderAction label="Cancel" onPress={jest.fn()} testID="cancel" />}
        right={
          <HeaderAction disabled label="Save" onPress={onPress} testID="save" />
        }
        title="Edit plan"
      />,
    );

    fireEvent.press(screen.getByTestId('save'));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { disabled: true })).toBeTruthy();
  });
});
