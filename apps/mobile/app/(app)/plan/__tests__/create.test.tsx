import { StyleSheet } from 'react-native';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { MIN_TOUCH_TARGET } from '../../../../lib/a11y';
import { DISMISS_MS } from '../../../../lib/navigation';
import CreatePlanScreen from '../create';
import { useAuthStore } from '../../../../stores/authStore';
import { supabase } from '../../../../lib/supabase';
import { chain } from '../../../../lib/testing/supabase';
import { renderWithQuery } from '../../../../lib/testing/render';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
/** False on a cold deep link: the sheet opens with nothing behind it. */
let mockCanGoBack = true;
let mockParams: Record<string, string | undefined> = {};

jest.mock('../../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('expo-router', () =>
  require('../../../../lib/testing/router').expoRouterMock(
    () => ({
      push: mockPush,
      back: mockBack,
      navigate: mockNavigate,
      replace: mockReplace,
      canGoBack: () => mockCanGoBack,
    }),
    () => mockParams
  )
);


jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    FadeInDown: {},
    FadeOutUp: {},
    LinearTransition: {},
  };
});

jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => React.createElement(View, { testID: 'time-picker' }),
  };
});

const mockFrom = supabase.from as jest.Mock;

/** Chainable, awaitable Supabase query-builder stub. */

const MEMBERSHIPS = [
  { groups: { id: 'g1', name: 'Los de siempre' } },
  { groups: { id: 'g2', name: 'Escapistas' } },
];

/** One accepted friendship, in the shape useFriends reads. */
const FRIENDS = [
  {
    requester_id: 'me',
    addressee_id: 'u-marta',
    requester: { id: 'me', display_name: 'Rocío', handle: null, avatar_url: null },
    addressee: { id: 'u-marta', display_name: 'Marta', handle: null, avatar_url: null },
  },
];

let plansChain: ReturnType<typeof chain>;
let optionsChain: ReturnType<typeof chain>;
let rsvpsChain: ReturnType<typeof chain>;
let availChain: ReturnType<typeof chain>;
let pollsChain: ReturnType<typeof chain>;
let pollOptionsChain: ReturnType<typeof chain>;

function primeSupabase(memberships: unknown[] = MEMBERSHIPS, friends: unknown[] = FRIENDS) {
  plansChain = chain({ data: { id: 'new-plan' }, error: null });
  optionsChain = chain({ data: [{ id: 'd1' }, { id: 'd2' }], error: null });
  rsvpsChain = chain({ error: null });
  availChain = chain({ error: null });
  pollsChain = chain({ data: { id: 'new-poll' }, error: null });
  pollOptionsChain = chain({ error: null });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'group_members') return chain({ data: memberships, error: null });
    if (table === 'friendships') return chain({ data: friends, error: null });
    if (table === 'plans') return plansChain;
    if (table === 'plan_date_options') return optionsChain;
    if (table === 'rsvps') return rsvpsChain;
    if (table === 'date_availability') return availChain;
    if (table === 'plan_polls') return pollsChain;
    if (table === 'plan_poll_options') return pollOptionsChain;
    return chain({ data: null, error: null });
  });
}

async function renderCreate() {
  return renderWithQuery(<CreatePlanScreen />);
}

// Freeze only Date (timers stay real so async rendering works):
// today is Wed 2026-08-05, so days 6+ of August are pickable.
beforeAll(() => {
  jest.useFakeTimers({
    now: new Date('2026-08-05T10:00:00'),
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  });
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockCanGoBack = true;
  primeSupabase();
  useAuthStore.setState({
    user: { id: 'me' } as any,
    profile: { id: 'me', display_name: 'Rocío', avatar_url: null } as any,
  });
});

describe('CreatePlanScreen', () => {
  /**
   * PLA-40. "Cancel" was a bare text Pressable with no padding, so its target
   * was exactly the word — about 48×20 in a header that was already 45pt tall.
   * The shared header action now owns the button's full target.
   *
   * The group and date chips are here too because they are the controls this
   * screen is made of, and both were under (39 and 34).
   */
  it('gives its header and chips the adaptive minimum', async () => {
    await renderCreate();
    await screen.findByTestId('group-g1');

    const cancelStyle = StyleSheet.flatten(screen.getByTestId('cancel').props.style);
    const groupStyle = StyleSheet.flatten(screen.getByTestId('group-g1').props.style);
    expect(cancelStyle.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(groupStyle.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it('shows all group chips with the first preselected and named in the CTA', async () => {
    await renderCreate();

    await screen.findByTestId('group-g1');
    expect(screen.getByTestId('group-g2')).toBeTruthy();
    expect(screen.getByTestId('group-g1')).toBeSelected();
    expect(screen.getByText('Post to Los de siempre')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('group-g2'));
    expect(screen.getByTestId('group-g2')).toBeSelected();
    expect(screen.getByText('Post to Escapistas')).toBeTruthy();
  });

  /**
   * PLA-68, as reported: with no groups the chip row was an empty space under
   * its own label and the footer read "Post to …", disabled for good. The
   * screen is reachable by deep link whatever the "+" does, so it has to
   * answer for this state itself rather than assume a caller checked.
   */
  it('offers the way into a group instead of a form that cannot be posted', async () => {
    primeSupabase([], []);
    await renderCreate();

    await screen.findByText('Plans need people first');
    expect(screen.queryByTestId('post-cta')).toBeNull();
    expect(screen.queryByText("Who's it for")).toBeNull();
    expect(screen.queryByTestId('title-input')).toBeNull();

    // Cancel still works, so the sheet is never a trap.
    expect(screen.getByTestId('cancel')).toBeTruthy();
  });

  it('dismisses the sheet before changing tabs underneath it', async () => {
    primeSupabase([], []);
    await renderCreate();

    await fireEvent.press(await screen.findByText('Sort out a group'));
    expect(mockBack).toHaveBeenCalled();
    // The tab change is deliberately deferred until the sheet is gone. This
    // suite leaves setTimeout real (see doNotFake above), so it is waited for
    // rather than advanced.
    expect(mockNavigate).not.toHaveBeenCalled();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/(app)/(tabs)/groups'));
  });

  /**
   * `planazo://plan/create` on a cold start opens this sheet with nothing
   * behind it, and back() is a no-op that logs "GO_BACK was not handled by
   * any navigator". Both ways out used it, so the sheet a deep link opened
   * could not be left at all.
   */
  it('leaves the sheet by replacing it when there is nothing to go back to', async () => {
    mockCanGoBack = false;
    primeSupabase([], []);
    await renderCreate();

    await fireEvent.press(await screen.findByText('Sort out a group'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(app)/(tabs)/groups');
  });

  it('cancels out of a deep-linked sheet that has no screen behind it', async () => {
    mockCanGoBack = false;
    await renderCreate();

    await fireEvent.press(await screen.findByTestId('cancel'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(app)/(tabs)');
  });

  it('collapses the chip row to one group when opened with groupId', async () => {
    mockParams = { groupId: 'g2' };
    await renderCreate();

    await screen.findByTestId('group-g2');
    expect(screen.queryByTestId('group-g1')).toBeNull();
    expect(screen.getByText('Post to Escapistas')).toBeTruthy();
  });

  it('treats an empty groupId param as absent', async () => {
    mockParams = { groupId: '' };
    await renderCreate();

    await screen.findByTestId('group-g1');
    expect(screen.getByTestId('group-g2')).toBeTruthy();
    expect(screen.getByTestId('group-g1')).toBeSelected();
    expect(screen.getByText('Post to Los de siempre')).toBeTruthy();
  });

  it('one tapped day means fixed: summary, chip and time field appear', async () => {
    await renderCreate();
    await screen.findByTestId('group-g1');

    expect(screen.getByText('Pick a date, or a few, and let them vote.')).toBeTruthy();
    expect(screen.queryByText('Starts at')).toBeNull();

    await fireEvent.press(screen.getByTestId('cal-day-2026-08-07'));

    expect(screen.getByText('Fixed date · Friday 7 August')).toBeTruthy();
    expect(screen.getByTestId('chip-2026-08-07')).toBeTruthy();
    expect(screen.getByText('Starts at')).toBeTruthy();
    expect(screen.getByText('20:30')).toBeTruthy();
    expect(screen.queryByText("You'll set the time once a date wins.")).toBeNull();
  });

  it('two tapped days mean flexible: options summary and time hint instead of time field', async () => {
    await renderCreate();
    await screen.findByTestId('group-g1');

    await fireEvent.press(screen.getByTestId('cal-day-2026-08-07'));
    await fireEvent.press(screen.getByTestId('cal-day-2026-08-09'));

    expect(screen.getByText('2 options · everyone ticks what works')).toBeTruthy();
    expect(screen.queryByText('Starts at')).toBeNull();
    expect(screen.getByText("You'll set the time once a date wins.")).toBeTruthy();
  });

  it('removes a picked day from its chip', async () => {
    await renderCreate();
    await screen.findByTestId('group-g1');

    await fireEvent.press(screen.getByTestId('cal-day-2026-08-07'));
    await fireEvent.press(screen.getByTestId('cal-day-2026-08-09'));
    await fireEvent.press(screen.getByTestId('chip-2026-08-07'));

    expect(screen.queryByTestId('chip-2026-08-07')).toBeNull();
    expect(screen.getByText('Fixed date · Sunday 9 August')).toBeTruthy();
  });

  it('past days are dead and month arrows clamp at the current month', async () => {
    await renderCreate();
    await screen.findByTestId('group-g1');

    await fireEvent.press(screen.getByTestId('cal-day-2026-08-03'));
    expect(screen.queryByTestId('chip-2026-08-03')).toBeNull();

    expect(screen.getByText('August 2026')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('cal-prev'));
    expect(screen.getByText('August 2026')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('cal-next'));
    expect(screen.getByText('September 2026')).toBeTruthy();
  });

  it('steppers respect the floor of 2 and the cap dropping back to No limit', async () => {
    await renderCreate();
    await screen.findByTestId('group-g1');

    expect(screen.getByTestId('min-value')).toHaveTextContent('4');
    expect(screen.getByTestId('cap-value')).toHaveTextContent('—');
    expect(screen.getByText('No limit')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('min-down'));
    await fireEvent.press(screen.getByTestId('min-down'));
    await fireEvent.press(screen.getByTestId('min-down'));
    expect(screen.getByTestId('min-value')).toHaveTextContent('2');

    await fireEvent.press(screen.getByTestId('cap-up'));
    expect(screen.getByTestId('cap-value')).toHaveTextContent('2');

    await fireEvent.press(screen.getByTestId('cap-down'));
    expect(screen.getByTestId('cap-value')).toHaveTextContent('—');
    expect(screen.getByText('No limit')).toBeTruthy();
  });

  it('cap can equal the min for an exact-headcount plan', async () => {
    await renderCreate();
    await screen.findByTestId('group-g1');

    await fireEvent.press(screen.getByTestId('cap-up'));
    expect(screen.getByTestId('cap-value')).toHaveTextContent('4');

    await fireEvent.changeText(screen.getByTestId('title-input'), 'Padel');
    await fireEvent.press(screen.getByTestId('cal-day-2026-08-07'));
    await fireEvent.press(screen.getByTestId('post-cta'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(plansChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ min_people: 4, max_people: 4 })
    );
  });

  it('raising the floor into the cap drags the cap along to match', async () => {
    await renderCreate();
    await screen.findByTestId('group-g1');

    await fireEvent.press(screen.getByTestId('cap-up'));
    expect(screen.getByTestId('cap-value')).toHaveTextContent('4');

    await fireEvent.press(screen.getByTestId('min-up'));
    expect(screen.getByTestId('min-value')).toHaveTextContent('5');
    expect(screen.getByTestId('cap-value')).toHaveTextContent('5');

    await fireEvent.press(screen.getByTestId('cap-down'));
    expect(screen.getByTestId('cap-value')).toHaveTextContent('—');
  });

  it('does not post until there is a title and a date', async () => {
    await renderCreate();
    await screen.findByTestId('group-g1');

    await fireEvent.press(screen.getByTestId('post-cta'));
    expect(plansChain.insert).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('title-input'), 'Padel + pizza');
    await fireEvent.press(screen.getByTestId('post-cta'));
    expect(plansChain.insert).not.toHaveBeenCalled();
  });

  it('posts a fixed plan with the date and default time', async () => {
    await renderCreate();
    await screen.findByTestId('group-g1');

    await fireEvent.changeText(screen.getByTestId('title-input'), 'Padel + pizza');
    await fireEvent.press(screen.getByTestId('cal-day-2026-08-07'));
    await fireEvent.press(screen.getByTestId('post-cta'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(plansChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'group',
        group_id: 'g1',
        created_by: 'me',
        title: 'Padel + pizza',
        plan_type: 'fixed',
        event_date: new Date(2026, 7, 7, 20, 30).toISOString(),
        min_people: 4,
        max_people: null,
        status: 'open',
      })
    );
    expect(optionsChain.insert).not.toHaveBeenCalled();
    expect(rsvpsChain.insert).toHaveBeenCalledWith({
      plan_id: 'new-plan',
      user_id: 'me',
      response: 'yes',
    });
    expect(pollsChain.insert).not.toHaveBeenCalled();
    // The plan it just made is where it goes, once the sheet is out of the way.
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(app)/plan/new-plan'));
  });

  /**
   * The posting counterpart of the cancel case above. `back()` is a no-op on a
   * cold `planazo://plan/create`, so the old back-then-push-in-100ms pair left
   * the sheet standing and pushed the new plan in behind it. A replace arrives
   * on its own and must not also schedule the push.
   */
  it('replaces the sheet with the new plan when there is nothing to go back to', async () => {
    mockCanGoBack = false;
    // Asserting the timer was never *armed* beats sleeping past when it would
    // have fired: same proof, no wall clock. Filtering on DISMISS_MS keeps
    // react-query's own setTimeout(fn, 0) out of it.
    const armed = jest.spyOn(globalThis, 'setTimeout');
    await renderCreate();
    await screen.findByTestId('group-g1');

    await fireEvent.changeText(screen.getByTestId('title-input'), 'Padel + pizza');
    await fireEvent.press(screen.getByTestId('cal-day-2026-08-07'));
    await fireEvent.press(screen.getByTestId('post-cta'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(app)/plan/new-plan'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(armed).not.toHaveBeenCalledWith(expect.any(Function), DISMISS_MS);
    expect(mockPush).not.toHaveBeenCalled();
    armed.mockRestore();
  });

  it('the question section starts collapsed and does not block a plain plan', async () => {
    await renderCreate();
    await screen.findByTestId('group-g1');

    expect(screen.queryByTestId('poll-question-input')).toBeNull();
    expect(screen.getByText('Add a question to vote on')).toBeTruthy();
  });

  it('a half-typed question blocks the post instead of being dropped', async () => {
    await renderCreate();
    await screen.findByTestId('group-g1');

    await fireEvent.changeText(screen.getByTestId('title-input'), 'Cinema night');
    await fireEvent.press(screen.getByTestId('cal-day-2026-08-07'));
    await fireEvent.press(screen.getByTestId('poll-toggle'));
    await fireEvent.changeText(screen.getByTestId('poll-question-input'), 'Which film?');
    await fireEvent.changeText(screen.getByTestId('poll-option-input-0'), 'Dune Part Two');
    // Only one option: not a question anyone can answer

    await fireEvent.press(screen.getByTestId('post-cta'));
    expect(plansChain.insert).not.toHaveBeenCalled();
  });

  it('posts the question and its options along with the plan', async () => {
    await renderCreate();
    await screen.findByTestId('group-g1');

    await fireEvent.changeText(screen.getByTestId('title-input'), 'Cinema night');
    await fireEvent.press(screen.getByTestId('cal-day-2026-08-07'));
    await fireEvent.press(screen.getByTestId('poll-toggle'));
    await fireEvent.changeText(screen.getByTestId('poll-question-input'), 'Which film?');
    await fireEvent.changeText(screen.getByTestId('poll-option-input-0'), 'Dune Part Two');
    await fireEvent.changeText(screen.getByTestId('poll-option-input-1'), 'Anora');
    await fireEvent.press(screen.getByTestId('post-cta'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(pollsChain.insert).toHaveBeenCalledWith({
      plan_id: 'new-plan',
      question: 'Which film?',
    });
    expect(pollOptionsChain.insert).toHaveBeenCalledWith([
      { poll_id: 'new-poll', plan_id: 'new-plan', label: 'Dune Part Two', position: 0 },
      { poll_id: 'new-poll', plan_id: 'new-plan', label: 'Anora', position: 1 },
    ]);
  });

  it('posts a flexible plan with one option row per date', async () => {
    await renderCreate();
    await screen.findByTestId('group-g1');

    await fireEvent.changeText(screen.getByTestId('title-input'), 'Escape room revenge');
    await fireEvent.press(screen.getByTestId('cal-day-2026-08-07'));
    await fireEvent.press(screen.getByTestId('cal-day-2026-08-09'));
    await fireEvent.press(screen.getByTestId('post-cta'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(plansChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ plan_type: 'flexible', event_date: null })
    );
    expect(optionsChain.insert).toHaveBeenCalledWith([
      { plan_id: 'new-plan', date: new Date(2026, 7, 7).toISOString() },
      { plan_id: 'new-plan', date: new Date(2026, 7, 9).toISOString() },
    ]);
    expect(availChain.insert).toHaveBeenCalledWith([
      { plan_id: 'new-plan', user_id: 'me', date_option_id: 'd1', available: true },
      { plan_id: 'new-plan', user_id: 'me', date_option_id: 'd2', available: true },
    ]);
    expect(rsvpsChain.insert).not.toHaveBeenCalled();
  });

  it('folds place & notes into the post', async () => {
    await renderCreate();
    await screen.findByTestId('group-g1');

    expect(screen.queryByTestId('location-input')).toBeNull();
    await fireEvent.press(screen.getByTestId('details-toggle'));
    expect(screen.getByText('Hide extras')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('location-input'), 'Padel Indoor Gràcia');
    await fireEvent.changeText(screen.getByTestId('notes-input'), 'Bring cash');
    await fireEvent.changeText(screen.getByTestId('title-input'), 'Padel');
    await fireEvent.press(screen.getByTestId('cal-day-2026-08-07'));
    await fireEvent.press(screen.getByTestId('post-cta'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(plansChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        location: 'Padel Indoor Gràcia',
        description: 'Bring cash',
      })
    );
  });
});

/**
 * PLA-140: a plan can go to all your friends, or to friends of friends, and
 * neither has a group. The two audience chips sit ahead of the groups, the
 * footer names the destination, and the post carries `audience` with no
 * group id.
 */
describe('CreatePlanScreen — audiences', () => {
  it('offers Friends and Friends of friends ahead of the groups, with the first group still the default', async () => {
    await renderCreate();
    await screen.findByTestId('group-g1');

    expect(screen.getByTestId('audience-friends')).toBeTruthy();
    expect(screen.getByTestId('audience-friends_of_friends')).toBeTruthy();
    expect(screen.getByTestId('group-g1')).toBeSelected();
    expect(screen.getByText('Post to Los de siempre')).toBeTruthy();
    // A group needs no join rule: you can see who is in it.
    expect(screen.queryByTestId('audience-helper')).toBeNull();
  });

  it('picking Friends names the destination, states the rule, and posts with no group', async () => {
    await renderCreate();
    await screen.findByTestId('audience-friends');

    await fireEvent.press(screen.getByTestId('audience-friends'));
    expect(screen.getByTestId('audience-friends')).toBeSelected();
    expect(screen.getByTestId('group-g1')).not.toBeSelected();
    expect(screen.getByText('Post to your friends')).toBeTruthy();
    expect(screen.getByText("Everyone you're friends with sees it and can join.")).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('title-input'), 'Birras del jueves');
    await fireEvent.press(screen.getByTestId('cal-day-2026-08-07'));
    await fireEvent.press(screen.getByTestId('post-cta'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(plansChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'friends', group_id: null, created_by: 'me' })
    );
  });

  it('Friends of friends explains its wider reach', async () => {
    await renderCreate();
    await screen.findByTestId('audience-friends_of_friends');

    await fireEvent.press(screen.getByTestId('audience-friends_of_friends'));
    expect(screen.getByText('Post to friends of friends')).toBeTruthy();
    expect(screen.getByText('Your friends and their friends see it and can join.')).toBeTruthy();
  });

  it('hides the audience chips from someone with no friends to reach', async () => {
    primeSupabase(MEMBERSHIPS, []);
    await renderCreate();
    await screen.findByTestId('group-g1');

    expect(screen.queryByTestId('audience-friends')).toBeNull();
    expect(screen.queryByTestId('audience-friends_of_friends')).toBeNull();
  });

  it('with a friend and no groups, Friends is the default and the form is offered', async () => {
    primeSupabase([], FRIENDS);
    await renderCreate();

    await screen.findByTestId('audience-friends');
    expect(screen.getByTestId('audience-friends')).toBeSelected();
    expect(screen.getByText('Post to your friends')).toBeTruthy();
    expect(screen.queryByText('Plans need people first')).toBeNull();
    expect(screen.getByTestId('title-input')).toBeTruthy();
  });

  it('opened from a group, the row collapses to that group and the audiences step aside', async () => {
    mockParams = { groupId: 'g2' };
    await renderCreate();
    await screen.findByTestId('group-g2');

    expect(screen.queryByTestId('audience-friends')).toBeNull();
    expect(screen.getByText('Post to Escapistas')).toBeTruthy();
  });

  it('an audience param preselects it, which is how "try again" keeps a friends plan among friends', async () => {
    mockParams = { audience: 'friends_of_friends' };
    await renderCreate();
    await screen.findByTestId('audience-friends_of_friends');

    expect(screen.getByTestId('audience-friends_of_friends')).toBeSelected();
    expect(screen.getByText('Post to friends of friends')).toBeTruthy();
  });
});
