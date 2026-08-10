import { Text, StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { FooterBar, indicatorPadding } from '../FooterBar';
import { spacing } from '../../../theme/tokens';

describe('indicatorPadding', () => {
  it('clears the indicator on a phone that has one', () => {
    expect(indicatorPadding({ top: 59, bottom: 34, left: 0, right: 0 })).toBe(34);
  });

  // The floor is the point: a bar flush against the bottom edge of an SE reads
  // as unfinished, which is what `paddingBottom: 30` used to paper over.
  it('falls back to a token where there is no indicator', () => {
    expect(indicatorPadding({ top: 20, bottom: 0, left: 0, right: 0 })).toBe(spacing.lg);
  });

  it('keeps the floor when the inset is smaller than it', () => {
    expect(indicatorPadding({ top: 0, bottom: spacing.lg - 1, left: 0, right: 0 })).toBe(
      spacing.lg,
    );
  });

  // No SafeAreaProvider above it. FooterBar and FormScreen both read the
  // context rather than the hook so this case renders instead of throwing.
  it('falls back to the token when there are no insets at all', () => {
    expect(indicatorPadding(null)).toBe(spacing.lg);
  });
});

const renderBar = (props: Partial<React.ComponentProps<typeof FooterBar>> = {}, bottom = 34) =>
  render(
    <SafeAreaInsetsContext.Provider value={{ top: 0, bottom, left: 0, right: 0 }}>
      <FooterBar testID="bar" {...props}>
        <Text>Go</Text>
      </FooterBar>
    </SafeAreaInsetsContext.Provider>,
  );

const barStyle = () => StyleSheet.flatten(screen.getByTestId('bar').props.style);

describe('FooterBar', () => {
  it('leaves the inset to its parent by default', async () => {
    await renderBar();

    expect(barStyle().paddingBottom).toBe(spacing.lg);
    expect(barStyle().position).toBeUndefined();
  });

  /**
   * The regression this guards: four screens hardcoded `paddingBottom: 30` for
   * a bar their SafeAreaView never inset (PLA-73).
   */
  it('clears the home indicator itself when pinned', async () => {
    await renderBar({ pinned: true });

    expect(barStyle().paddingBottom).toBe(34);
    expect(barStyle().position).toBe('absolute');
  });

  // poll.tsx: in flow, but its SafeAreaView carries no `bottom` edge.
  it('clears the home indicator without pinning when asked', async () => {
    await renderBar({ insetBottom: true });

    expect(barStyle().paddingBottom).toBe(34);
    expect(barStyle().position).toBeUndefined();
  });

  it('falls back to its own padding where there is no indicator to clear', async () => {
    await renderBar({ pinned: true }, 0);

    expect(barStyle().paddingBottom).toBe(spacing.lg);
  });
});
