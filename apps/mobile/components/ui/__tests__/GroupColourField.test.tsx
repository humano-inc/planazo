import { fireEvent, render, screen } from '@testing-library/react-native';
import { groupColors } from '../../../theme/tokens';
import { GroupColourField } from '../GroupColourField';

describe('GroupColourField', () => {
  it('renders every group colour with the stable swatch test IDs', async () => {
    await render(<GroupColourField value={groupColors[0]} onChange={jest.fn()} />);

    expect(screen.getByText('Colour')).toBeTruthy();
    groupColors.forEach((_, index) => {
      expect(screen.getByTestId(`swatch-${index}`)).toBeTruthy();
      expect(screen.getByLabelText(`Group color ${index + 1}`)).toBeTruthy();
    });
  });

  it('marks only the current colour as selected', async () => {
    await render(<GroupColourField value={groupColors[2]} onChange={jest.fn()} />);

    groupColors.forEach((_, index) => {
      expect(screen.getByTestId(`swatch-${index}`).props.accessibilityState).toEqual({
        selected: index === 2,
      });
    });
  });

  it('hands the pressed colour back to the screen', async () => {
    const onChange = jest.fn();
    await render(<GroupColourField value={groupColors[0]} onChange={onChange} />);

    await fireEvent.press(screen.getByTestId('swatch-3'));

    expect(onChange).toHaveBeenCalledWith(groupColors[3]);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not invent a selection for an unknown stored colour', async () => {
    await render(<GroupColourField value="#000000" onChange={jest.fn()} />);

    groupColors.forEach((_, index) => {
      expect(screen.getByTestId(`swatch-${index}`).props.accessibilityState).toEqual({
        selected: false,
      });
    });
  });
});
