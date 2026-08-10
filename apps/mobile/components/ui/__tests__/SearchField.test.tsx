import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SearchField, SearchGlyph } from '../SearchField';
import { colors } from '../../../theme/tokens';

async function renderField(props: Partial<React.ComponentProps<typeof SearchField>> = {}) {
  return render(<SearchField placeholder="Name or @handle" testID="search" {...props} />);
}

/** The bordered row is the input's parent; the box styles live on it. */
function boxStyleOf(view: Awaited<ReturnType<typeof renderField>>) {
  return StyleSheet.flatten(view.getByTestId('search').parent?.props.style);
}

describe('SearchField', () => {
  it('shows the placeholder in the faint tone, never as a value', async () => {
    const view = await renderField();
    const input = view.getByTestId('search');

    expect(input.props.placeholder).toBe('Name or @handle');
    expect(input.props.placeholderTextColor).toBe(colors.textFaint);
    expect(input.props.value).toBeUndefined();
  });

  it('reports what was typed', async () => {
    const onChangeText = jest.fn();
    const view = await renderField({ onChangeText });

    await fireEvent.changeText(view.getByTestId('search'), 'nacho');

    expect(onChangeText).toHaveBeenCalledWith('nacho');
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
  it('rests on the strong border and never on ink', async () => {
    const view = await renderField();
    const box = boxStyleOf(view);

    expect(box.borderColor).toBe(colors.borderStrong);
    expect(box.borderColor).not.toBe(colors.ink);
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
    expect(input.minHeight).toBeGreaterThanOrEqual(44);
    expect(box.paddingVertical).toBeUndefined();
  });

  it('takes no taps when it is a still life', async () => {
    const view = await renderField({ editable: false });

    expect(view.getByTestId('search').props.editable).toBe(false);
  });
});

describe('SearchGlyph', () => {
  async function renderGlyph(color?: string) {
    const view = await render(<SearchGlyph color={color} />);
    return {
      box: StyleSheet.flatten(view.getByTestId('search-glyph').props.style),
      lens: StyleSheet.flatten(view.getByTestId('search-glyph-lens').props.style),
      handle: StyleSheet.flatten(view.getByTestId('search-glyph-handle').props.style),
    };
  }

  // The 15pt box holds an 11pt ring plus a handle that has to clear it. A wider
  // ring runs its own stroke back across the lens, which is what the 13pt copy
  // on the admins screen was doing before PLA-85.
  it('leaves the handle room beside the ring', async () => {
    const { box, lens, handle } = await renderGlyph();

    expect(lens.width).toBeLessThan(box.width);
    expect(lens.width + handle.width).toBeGreaterThan(box.width);
  });

  it('takes the muted hint tone by default', async () => {
    const { lens, handle } = await renderGlyph();

    expect(lens.borderColor).toBe(colors.textMuted);
    expect(handle.backgroundColor).toBe(colors.textMuted);
  });

  // On the groups tab it is part of a button label, not a hint inside a field.
  it('takes a caller colour on both strokes', async () => {
    const { lens, handle } = await renderGlyph(colors.ink);

    expect(lens.borderColor).toBe(colors.ink);
    expect(handle.backgroundColor).toBe(colors.ink);
  });
});
