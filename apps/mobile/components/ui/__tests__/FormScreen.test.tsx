import { Text, StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { FormScreen } from '../FormScreen';
import { spacing } from '../../../theme/tokens';

const FOOTER_HEIGHT = 96;

const renderScreen = (
  props: Partial<React.ComponentProps<typeof FormScreen>> = {},
  bottom = 34,
) =>
  render(
    <SafeAreaInsetsContext.Provider value={{ top: 59, bottom, left: 0, right: 0 }}>
      <FormScreen testID="form" {...props}>
        <Text>Field</Text>
      </FormScreen>
    </SafeAreaInsetsContext.Provider>,
  );

const scroll = () => screen.getByTestId('form-scroll');
const contentStyle = () => StyleSheet.flatten(scroll().props.contentContainerStyle);

/** The layout event the real FooterBar fires once it has been measured. */
const measureFooter = async (height = FOOTER_HEIGHT) =>
  fireEvent(screen.getByTestId('form-footer'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height } },
  });

describe('FormScreen', () => {
  it('renders the header, the content and the footer', async () => {
    await renderScreen({
      header: <Text>Header</Text>,
      footer: <Text>Post</Text>,
    });

    expect(screen.getByText('Header')).toBeTruthy();
    expect(screen.getByText('Field')).toBeTruthy();
    expect(screen.getByText('Post')).toBeTruthy();
  });

  it('has no footer to render when none was given', async () => {
    await renderScreen();

    expect(screen.queryByTestId('form-footer')).toBeNull();
    expect(screen.queryByTestId('form-sticky')).toBeNull();
  });

  describe('the home indicator', () => {
    it('is cleared by the content when nothing is pinned below it', async () => {
      await renderScreen();

      expect(contentStyle().paddingBottom).toBe(34);
    });

    it('falls back to a token where there is no indicator', async () => {
      await renderScreen({}, 0);

      expect(contentStyle().paddingBottom).toBe(spacing.lg);
    });

    /**
     * The regression this guards is the one the type signature also guards: two
     * things both padding for the same indicator, which reads as a gap.
     */
    it('is left to the footer when there is one, never doubled', async () => {
      await renderScreen({ footer: <Text>Post</Text> });

      expect(contentStyle().paddingBottom).toBeUndefined();
    });
  });

  describe('keeping the focused field clear of the footer', () => {
    it('asks for a bare gap until the footer has been measured', async () => {
      await renderScreen({ footer: <Text>Post</Text> });

      expect(scroll().props.bottomOffset).toBe(spacing.md);
    });

    it('grows the offset to the footer once it reports its height', async () => {
      await renderScreen({ footer: <Text>Post</Text> });
      await measureFooter();

      expect(scroll().props.bottomOffset).toBe(FOOTER_HEIGHT + spacing.md);
    });

    it('follows the footer when it changes height', async () => {
      await renderScreen({ footer: <Text>Post</Text> });
      await measureFooter();
      await measureFooter(212);

      expect(scroll().props.bottomOffset).toBe(212 + spacing.md);
    });

    // onLayout reports sub-pixel heights, so the offset is never a round number
    // in practice. The hardcoded 140 this replaces had no idea (PLA-74).
    it('survives the fractional heights onLayout actually reports', async () => {
      await renderScreen({ footer: <Text>Post</Text> });
      await measureFooter(95.66666412353516);

      expect(scroll().props.bottomOffset).toBeCloseTo(95.66666412353516 + spacing.md);
    });

    /**
     * The regression this guards is the one only a device showed: a form
     * shorter than the screen has no slack to scroll, so the sticky footer
     * covered the field it was parked over and `bottomOffset` alone could not
     * move it. `plan/[id]/cancel` autofocused an input hidden behind its own
     * "Call it off" button (PLA-74).
     */
    it('buys enough scrolling room to clear a footer on a form that does not scroll', async () => {
      await renderScreen({ footer: <Text>Post</Text> });
      await measureFooter();

      expect(scroll().props.extraKeyboardSpace).toBe(FOOTER_HEIGHT);
    });

    it('buys none when there is no footer in the way', async () => {
      await renderScreen();

      expect(scroll().props.extraKeyboardSpace).toBe(0);
    });
  });

  describe('the sticky footer', () => {
    it('drops back by the indicator inset once the keyboard covers it', async () => {
      await renderScreen({ footer: <Text>Post</Text> });

      expect(screen.getByTestId('form-sticky').props.offset).toEqual({ closed: 0, opened: 34 });
    });

    it('has nothing to drop back by on a phone without an indicator', async () => {
      await renderScreen({ footer: <Text>Post</Text> }, 0);

      expect(screen.getByTestId('form-sticky').props.offset).toEqual({ closed: 0, opened: 0 });
    });
  });

  describe('the scroll', () => {
    it('lets a tap through to a button while the keyboard is up', async () => {
      await renderScreen();

      expect(scroll().props.keyboardShouldPersistTaps).toBe('handled');
      expect(scroll().props.keyboardDismissMode).toBe('on-drag');
    });

    it('takes a caller style on top of its own', async () => {
      await renderScreen({ contentContainerStyle: { paddingTop: 40, gap: 12 } });

      expect(contentStyle().paddingTop).toBe(40);
      expect(contentStyle().gap).toBe(12);
      expect(contentStyle().paddingHorizontal).toBe(spacing.xl);
    });

    // plan/create and group/new restore a scroll position from `?y=` so a deep
    // link can put QA at the bottom of a long form.
    it('restores a scroll position when given one', async () => {
      await renderScreen({ contentOffset: { x: 0, y: 320 } });

      expect(scroll().props.contentOffset).toEqual({ x: 0, y: 320 });
    });
  });

  it('renders without a SafeAreaProvider above it', async () => {
    await render(
      <FormScreen testID="bare" footer={<Text>Post</Text>}>
        <Text>Field</Text>
      </FormScreen>,
    );

    expect(screen.getByTestId('bare-sticky').props.offset).toEqual({ closed: 0, opened: 0 });
    expect(screen.getByText('Field')).toBeTruthy();
  });
});
