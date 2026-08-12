import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import SignupScreen from '../signup';
import { supabase } from '../../../lib/supabase';
import { pickFromLibrary, uploadAvatar } from '../../../lib/images';
import { captureError } from '../../../lib/sentry';

const mockReplace = jest.fn();

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { signUp: jest.fn(), verifyOtp: jest.fn(), resend: jest.fn() },
    from: jest.fn(),
  },
}));

// The picker and the upload are lib/images' job, and its own test owns them
// (including the `?t=` cache-buster on the URL this screen stores). Here they
// are a seam: what this screen has to get right is that the photo picked
// before confirmation survives until there is a session to upload it with.
jest.mock('../../../lib/images', () => ({
  pickFromLibrary: jest.fn(),
  uploadAvatar: jest.fn(),
}));

// setSentryUser as well as captureError: the auth store calls it on every
// session change, and this screen's whole job is producing one.
jest.mock('../../../lib/sentry', () => ({ captureError: jest.fn(), setSentryUser: jest.fn() }));

let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const mockPick = pickFromLibrary as jest.Mock;
const mockUploadAvatar = uploadAvatar as jest.Mock;
const mockCaptureError = captureError as jest.Mock;
const mockSignUp = supabase.auth.signUp as jest.Mock;
const mockVerifyOtp = supabase.auth.verifyOtp as jest.Mock;
const mockResend = supabase.auth.resend as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

const profileReturning = (profile: object) => ({
  select: jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({ data: profile }),
    }),
  }),
  update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
});

const fill = async (name: string, email: string, password: string) => {
  await fireEvent.changeText(screen.getByTestId('name-input'), name);
  await fireEvent.changeText(screen.getByTestId('email-input'), email);
  await fireEvent.changeText(screen.getByTestId('password-input'), password);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockResend.mockResolvedValue({ error: null });
});

describe('SignupScreen', () => {
  it('names the next missing field on the footer button instead of going mute', async () => {
    await render(<SignupScreen />);

    expect(screen.getByText('Add your name to continue')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('name-input'), 'Nacho');
    expect(screen.getByText('Add your email to continue')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('email-input'), 'nacho@planazo.me');
    expect(screen.getByText('Pick a password to continue')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('password-input'), 'short');
    expect(screen.getByText('Make it 6 characters or more')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('password-input'), 'hunter22');
    expect(screen.getByText('Make my account')).toBeTruthy();
  });

  it('does not call Supabase while the form is incomplete', async () => {
    await render(<SignupScreen />);

    await fireEvent.press(screen.getByTestId('create-account'));

    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('shows the Supabase error inline and stays put', async () => {
    mockSignUp.mockResolvedValue({
      data: {},
      error: { message: 'User already registered' },
    });

    await render(<SignupScreen />);
    await fill('Nacho', ' Nacho@Planazo.me ', 'hunter22');
    await fireEvent.press(screen.getByTestId('create-account'));

    await waitFor(() => {
      expect(screen.getByText('User already registered')).toBeTruthy();
    });
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'nacho@planazo.me',
      password: 'hunter22',
      options: { data: { display_name: 'Nacho' } },
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('goes into the app when signup returns a session', async () => {
    mockSignUp.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });
    mockFrom.mockReturnValue(profileReturning({ id: 'user-1', display_name: 'Nacho' }));

    await render(<SignupScreen />);
    await fill('Nacho', 'nacho@planazo.me', 'hunter22');
    await fireEvent.press(screen.getByTestId('create-account'));

    // Index rather than the tabs: it owns the first-run gate (PLA-75), and a
    // brand new account is exactly who that gate exists for.
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  /**
   * The old flow ended here on a card whose only button led to the sign-in
   * form, where the only possible outcome was "Email not confirmed" (PLA-70).
   * The code step replaces it in place, on this same screen.
   */
  it('asks for the code on this screen when confirmation is required', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });

    await render(<SignupScreen />);
    await fill('Nacho', ' Nacho@Planazo.me ', 'hunter22');
    await fireEvent.press(screen.getByTestId('create-account'));

    await waitFor(() => {
      expect(screen.getByTestId('code-input')).toBeTruthy();
    });
    expect(screen.getByText(/nacho@planazo\.me/)).toBeTruthy();
    expect(screen.queryByTestId('go-to-login')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
    // Nothing goes out unasked on this path: signUp already sent the code.
    expect(mockResend).not.toHaveBeenCalled();
  });

  /**
   * The photo used to be lost here. It lives in this component's state and the
   * upload needs a session, so replacing the screen with a card threw it away.
   */
  /** Pick a photo, sign up, then enter the code that produces the session. */
  const signUpWithPhoto = async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });
    mockVerifyOtp.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });
    mockPick.mockResolvedValue('file:///photo.jpg');

    await render(<SignupScreen />);
    await fireEvent.press(screen.getByTestId('add-photo'));
    await fill('Nacho', 'nacho@planazo.me', 'hunter22');
    await fireEvent.press(screen.getByTestId('create-account'));

    await waitFor(() => expect(screen.getByTestId('code-input')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('code-input'), '604928');
    await fireEvent.press(screen.getByTestId('confirm-code'));
  };

  it('uploads the photo picked before confirmation, once the code lands', async () => {
    const profiles = profileReturning({ id: 'user-1', display_name: 'Nacho' });
    mockFrom.mockReturnValue(profiles);
    mockUploadAvatar.mockResolvedValue('https://cdn/avatar.jpg?t=1754870400000');

    await signUpWithPhoto();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
    expect(mockUploadAvatar).toHaveBeenCalledWith('user-1', 'file:///photo.jpg');
    expect(profiles.update).toHaveBeenCalledWith({
      avatar_url: 'https://cdn/avatar.jpg?t=1754870400000',
    });
  });

  it('still makes the account when the photo upload fails', async () => {
    const profiles = profileReturning({ id: 'user-1', display_name: 'Nacho' });
    mockFrom.mockReturnValue(profiles);
    mockUploadAvatar.mockRejectedValue(new Error('Storage unreachable'));

    await signUpWithPhoto();

    // The account exists by this point, so refusing to go in would strand them
    // on the code step over a photo they can add from the profile screen.
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
    expect(profiles.update).not.toHaveBeenCalled();
    expect(mockCaptureError).toHaveBeenCalled();
  });

  it('opens straight into the code step when sign-in hands an address over', async () => {
    mockParams = { verify: 'nacho@planazo.me' };

    await render(<SignupScreen />);

    expect(screen.getByTestId('code-input')).toBeTruthy();
    // Their old code is stale or lost by the time they get here, so one goes
    // out without them having to ask for it.
    await waitFor(() => {
      expect(mockResend).toHaveBeenCalledWith({ type: 'signup', email: 'nacho@planazo.me' });
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('goes back to the form with the address still filled in', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });

    await render(<SignupScreen />);
    await fill('Nacho', 'nacho@planazo.me', 'hunter22');
    await fireEvent.press(screen.getByTestId('create-account'));

    await waitFor(() => expect(screen.getByTestId('code-input')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('confirm-back'));

    expect(screen.getByTestId('email-input').props.value).toBe('nacho@planazo.me');
  });
});
