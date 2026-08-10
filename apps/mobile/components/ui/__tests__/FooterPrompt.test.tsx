import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { FooterPrompt } from '../FooterPrompt';

const rowStyle = () => StyleSheet.flatten(screen.getByTestId('signup-link-row').props.style);

describe('FooterPrompt', () => {
  it('shows the question and the link that answers it', async () => {
    await render(
      <FooterPrompt prompt="First time here?" action="Sign up" href="/(auth)/signup" testID="signup-link" />,
    );

    expect(screen.getByText('First time here?')).toBeTruthy();
    expect(screen.getByTestId('signup-link')).toBeTruthy();
  });

  /**
   * The regression this guards: at Accessibility XXXL the prompt and its link
   * no longer fit on one line, and a non-wrapping row ran off the side of the
   * screen (PLA-69). It was fixed on login and copied unevenly from there.
   */
  it('wraps rather than running off the side of the screen', async () => {
    await render(
      <FooterPrompt prompt="First time here?" action="Sign up" href="/(auth)/signup" testID="signup-link" />,
    );

    expect(rowStyle().flexWrap).toBe('wrap');
  });

  it('calls onPress for a row that stays on its own screen', async () => {
    const onPress = jest.fn();
    await render(
      <FooterPrompt prompt="Wrong email?" action="Go back" onPress={onPress} testID="signup-link" />,
    );

    await fireEvent.press(screen.getByTestId('signup-link'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is reachable as a button', async () => {
    await render(
      <FooterPrompt prompt="Wrong email?" action="Go back" onPress={jest.fn()} testID="signup-link" />,
    );

    expect(screen.getByTestId('signup-link').props.accessibilityRole).toBe('button');
  });
});
