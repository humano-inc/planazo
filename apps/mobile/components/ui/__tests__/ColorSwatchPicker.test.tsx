import { StyleSheet, type ViewStyle } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MIN_TOUCH_TARGET } from '../../../lib/a11y';
import { colors } from '../../../theme/tokens';
import { ColorSwatchPicker } from '../ColorSwatchPicker';

const SWATCHES = ['#AA0000', '#00BB00', '#0000CC'] as const;

const styleOf = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID).props.style) as ViewStyle;

describe('ColorSwatchPicker', () => {
  it('gives every swatch a full touch target and a numbered name', async () => {
    await render(<ColorSwatchPicker swatches={SWATCHES} selected={undefined} onSelect={() => {}} />);

    SWATCHES.forEach((swatch, index) => {
      const style = styleOf(`swatch-${index}`);
      expect(style.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      expect(style.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      expect(style.backgroundColor).toBe(swatch);
      expect(screen.getByLabelText(`Group color ${index + 1}`)).toBeTruthy();
    });
  });

  it('rings only the selected swatch and announces it', async () => {
    await render(<ColorSwatchPicker swatches={SWATCHES} selected="#00BB00" onSelect={() => {}} />);

    expect(styleOf('swatch-1').borderColor).toBe(colors.ink);
    expect(styleOf('swatch-0').borderColor).toBe('transparent');
    expect(styleOf('swatch-2').borderColor).toBe('transparent');
    expect(screen.getByLabelText('Group color 2').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Group color 1').props.accessibilityState.selected).toBe(false);
  });

  it('reports both the colour and its index so either can drive state', async () => {
    const onSelect = jest.fn();
    await render(<ColorSwatchPicker swatches={SWATCHES} selected={undefined} onSelect={onSelect} />);

    await fireEvent.press(screen.getByTestId('swatch-2'));

    expect(onSelect).toHaveBeenCalledWith('#0000CC', 2);
  });

  it('rings nothing when the selection is not in the palette', async () => {
    await render(<ColorSwatchPicker swatches={SWATCHES} selected="#FFFFFF" onSelect={() => {}} />);

    SWATCHES.forEach((_swatch, index) => {
      expect(styleOf(`swatch-${index}`).borderColor).toBe('transparent');
    });
  });
});
