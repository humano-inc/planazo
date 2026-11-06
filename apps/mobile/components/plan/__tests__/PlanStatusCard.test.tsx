import { render, screen } from '@testing-library/react-native';
import { NO_MINIMUM } from '@planazo/shared';
import { PlanStatusCard } from '../PlanStatusCard';
import { derivePlanDetail, type PlanDetailRow } from '../../../lib/planDerived';
import { iso } from '../../../lib/testing/dates';
import { yes } from '../../../lib/testing/rsvps';

// The ui barrel reaches Supabase transitively; the card never calls it.
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const plan = (over: Partial<PlanDetailRow> = {}): PlanDetailRow => ({
  status: 'open',
  plan_type: 'fixed',
  title: 'Run by the river',
  description: null,
  location: null,
  audience: 'group',
  groups: { name: 'The Regulars', color: null },
  min_people: NO_MINIMUM,
  max_people: null,
  cancelled_at: null,
  cancelled_by: null,
  cancel_reason: null,
  created_by: 'u-marta',
  event_date: iso(3),
  locked_date: null,
  ...over,
});

async function renderCard(row: PlanDetailRow) {
  const d = derivePlanDetail({ plan: row, rsvps: [yes('u-marta')], userId: 'me' });
  if (!d) throw new Error('expected a derived plan');
  return render(<PlanStatusCard plan={row} d={d} />);
}

describe('PlanStatusCard with no minimum', () => {
  it('says it is on and draws no bar when there is no cap either', async () => {
    await renderCard(plan());

    expect(screen.getByText("It's on")).toBeTruthy();
    expect(screen.getByText('1 in')).toBeTruthy();
    expect(screen.getByText('Happens either way')).toBeTruthy();
    expect(screen.queryByTestId('slot-filled')).toBeNull();
  });

  it('draws the room left when there is a cap', async () => {
    await renderCard(plan({ max_people: 3 }));

    expect(screen.getByText('1 in · room for 2 more')).toBeTruthy();
    expect(screen.getAllByTestId('slot-filled')).toHaveLength(1);
    expect(screen.getAllByTestId('slot-optional')).toHaveLength(2);
  });
});

describe('PlanStatusCard with a minimum', () => {
  it('keeps its bar and its number', async () => {
    await renderCard(plan({ min_people: 3 }));

    expect(screen.getByText('Happens with 3')).toBeTruthy();
    expect(screen.getAllByTestId('slot-required')).toHaveLength(2);
  });
});
