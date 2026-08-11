import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SearchField } from '../SearchField';
import { colors } from '../../../theme/tokens';
import { MIN_TOUCH_TARGET } from '../../../lib/a11y';

async function renderField(props: Partial<React.ComponentProps<typeof SearchField>> = {}) {
  return render(<SearchField placeholder="Name or @handle" testID="search" {...props} />);
}

/** The bordered row carries its own testID, so this never walks the tree. */
function boxStyleOf(view: Awaited<ReturnType<typeof renderField>>) {
  return StyleSheet.flatten(view.getByTestId('search-box').props.style);
}

describe('SearchField', () => {
  it('shows the placeholder in the faint tone, never as a value', async () => {
    const view = await renderField();
    const input = view.getByTestId('search');

    expect(input.props.placeholder).toBe('Name or @handle');
    expect(input.props.placeholderTextColor).toBe(colors.textFaint);
    expect(input.props.value).toBeUndefined();
  });

  it('turns off autocapitalize and autocorrect, which no name search wants', async () => {
    const view = await renderField();
    const input = view.getByTestId('search');

    expect(input.props.autoCapitalize).toBe('none');
    expect(input.props.autoCorrect).toBe(false);
  });

  it('lets a caller override those defaults', async () => {
    const view = await renderField({ autoCapitalize: 'words' });

    expect(view.getByTestId('search').props.autoCapitalize).toBe('words');
  });

  /**
   * PLA-85: an ink border means *selected* everywhere else in the app, so a
   * resting search box must not wear one. Resting is borderStrong and focus is
   * ember, matching FormField.
   */
  it('rests on the strong border, not the selected-state ink', async () => {
    expect(boxStyleOf(await renderField()).borderColor).toBe(colors.borderStrong);
  });

  it('borders ember while focused and returns to rest on blur', async () => {
    const view = await renderField();
    const input = view.getByTestId('search');

    await fireEvent(input, 'focus');
    expect(boxStyleOf(view).borderColor).toBe(colors.accent);

    await fireEvent(input, 'blur');
    expect(boxStyleOf(view).borderColor).toBe(colors.borderStrong);
  });

  it('still calls a caller onFocus and onBlur alongside its own', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const view = await renderField({ onFocus, onBlur });
    const input = view.getByTestId('search');

    await fireEvent(input, 'focus');
    await fireEvent(input, 'blur');

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('fills with white on a screen and with paper on a card', async () => {
    expect(boxStyleOf(await renderField()).backgroundColor).toBe(colors.surface);
    expect(boxStyleOf(await renderField({ onCard: true })).backgroundColor).toBe(
      colors.background,
    );
  });

  // The same regression FormField guards: padding on the wrapper draws a box
  // taller than the strip that actually takes a tap.
  it('puts the tap target on the input rather than the box', async () => {
    const view = await renderField();
    const input = StyleSheet.flatten(view.getByTestId('search').props.style);
    const box = boxStyleOf(view);

    expect(input.paddingVertical).toBeGreaterThanOrEqual(12);
    expect(input.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(box.paddingVertical).toBeUndefined();
  });

  /**
   * Onboarding's art is a picture of a field, not a field. The three halves of
   * that have to travel together: drop one and page 1 of the first-run deck
   * grows a live box that summons a keyboard mid-swipe.
   */
  it('makes a still life uneditable and untappable in one prop', async () => {
    const view = await renderField({ decorative: true });

    expect(view.getByTestId('search').props.editable).toBe(false);
    expect(view.getByTestId('search-box').props.pointerEvents).toBe('none');
  });

  it('is an ordinary editable field otherwise', async () => {
    const view = await renderField();

    expect(view.getByTestId('search').props.editable).toBe(true);
    expect(view.getByTestId('search-box').props.pointerEvents).toBe('auto');
  });
});
