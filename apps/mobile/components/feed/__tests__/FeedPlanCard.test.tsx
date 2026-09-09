import { render, screen } from '@testing-library/react-native';
import { FeedPlanCard } from '../FeedPlanCard';
import { deriveFeedItems } from '../../../lib/feedDerived';
import { iso } from '../../../lib/testing/dates';

// The ui barrel reaches Supabase transitively; the card never calls it.
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const animation: any = {
    duration: () => animation,
    easing: () => animation,
    reduceMotion: () => animation,
  };
  const MotionView = ({ entering: _entering, exiting: _exiting, layout: _layout, ...props }: any) =>
    React.createElement(View, props);
  return {
    __esModule: true,
    default: { View: MotionView },
    FadeIn: animation,
    FadeOut: animation,
    FadeInDown: animation,
    FadeOutUp: animation,
    LinearTransition: animation,
    ZoomIn: animation,
    useReducedMotion: () => false,
  };
});

/**
 * PLA-140: the context slot at the top of the card. A group plan shows its
 * group; a plan with no group says who it is for, and a friends-of-friends
 * plan names the friend you share.
 */
const basePlan = {
  id: 'p1',
  title: 'Padel + pizza',
  description: null,
  location: 'Padel Indoor Gràcia',
  plan_type: 'fixed',
  status: 'open',
  min_people: 3,
  max_people: null,
  created_by: 'u-marta',
  event_date: iso(2),
  locked_date: null,
  rsvps: [{ user_id: 'u-marta', response: 'yes', profile: { display_name: 'Marta' } }],
  plan_date_options: [],
} as const;

function renderCard(plan: Record<string, unknown>) {
  const [item] = deriveFeedItems([{ ...basePlan, ...plan }] as any, 'me');
  return render(
    <FeedPlanCard
      item={item as any}
      picked={[]}
      onTogglePicked={jest.fn()}
      onOpen={jest.fn()}
      onAnswer={jest.fn()}
      onClearAnswer={jest.fn()}
      onSendDates={jest.fn()}
      onDecline={jest.fn()}
    />
  );
}

describe('FeedPlanCard — who it is for', () => {
  it('a group plan shows its group and no people mark', async () => {
    await renderCard({ audience: 'group', groups: { name: 'Domingueros', color: null } });

    expect(screen.getByText('Domingueros')).toBeTruthy();
    expect(screen.queryByTestId('plan-card-people')).toBeNull();
  });

  it('a friends plan says "Your friends" behind the people mark', async () => {
    await renderCard({ audience: 'friends', groups: null });

    expect(screen.getByText('Your friends')).toBeTruthy();
    expect(screen.getByTestId('plan-card-people')).toBeTruthy();
  });

  it('a friends-of-friends plan names the bridge you share', async () => {
    await renderCard({ audience: 'friends_of_friends', groups: null, plan_bridge: 'Marta' });
    expect(screen.getByText('Friends of friends · via Marta')).toBeTruthy();
  });

  it('a friends-of-friends plan you reach directly names nobody', async () => {
    await renderCard({ audience: 'friends_of_friends', groups: null, plan_bridge: null });
    expect(screen.getByText('Friends of friends')).toBeTruthy();
  });
});
