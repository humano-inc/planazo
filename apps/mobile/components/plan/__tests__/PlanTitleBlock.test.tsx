import { render, screen } from '@testing-library/react-native';
import { PlanTitleBlock } from '../PlanTitleBlock';
import { derivePlanDetail, type PlanDetailRow } from '../../../lib/planDerived';
import { iso } from '../../../lib/testing/dates';

// The ui barrel reaches Supabase transitively; the block never calls it.
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

/**
 * PLA-140: the chip row under the badge. A group plan shows its group's
 * swatch and name; a plan with no group shows the people mark and who it is
 * for, naming the bridge on a friends-of-friends plan.
 */
const plan = (over: Partial<PlanDetailRow> = {}): PlanDetailRow => ({
  status: 'open',
  plan_type: 'fixed',
  title: 'Padel',
  description: null,
  location: null,
  audience: 'group',
  groups: { name: 'The Regulars', color: null },
  min_people: 3,
  max_people: null,
  cancelled_at: null,
  cancelled_by: null,
  cancel_reason: null,
  created_by: 'u-marta',
  event_date: iso(3),
  locked_date: null,
  ...over,
});

async function renderBlock(row: PlanDetailRow) {
  const d = derivePlanDetail({ plan: row, userId: 'me' });
  if (!d) throw new Error('expected a derived plan');
  return render(<PlanTitleBlock plan={row} d={d} />);
}

describe('PlanTitleBlock — who it is for', () => {
  it('a group plan names its group without the people mark', async () => {
    await renderBlock(plan());

    expect(screen.getByText('The Regulars')).toBeTruthy();
    expect(screen.queryByTestId('plan-title-people')).toBeNull();
  });

  it('a friends plan says "Your friends" behind the people mark', async () => {
    await renderBlock(plan({ audience: 'friends', groups: null }));

    expect(screen.getByText('Your friends')).toBeTruthy();
    expect(screen.getByTestId('plan-title-people')).toBeTruthy();
  });

  it('a friends-of-friends plan names the bridge you share', async () => {
    await renderBlock(plan({ audience: 'friends_of_friends', groups: null, plan_bridge: 'Marta' }));
    expect(screen.getByText('Friends of friends · via Marta')).toBeTruthy();
  });

  it('a friends-of-friends plan you reach directly names nobody', async () => {
    await renderBlock(plan({ audience: 'friends_of_friends', groups: null, plan_bridge: null }));
    expect(screen.getByText('Friends of friends')).toBeTruthy();
  });
});
