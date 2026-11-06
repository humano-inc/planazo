import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { NO_MINIMUM } from '@planazo/shared';
import { DateVoteList } from '../DateVoteList';
import { iso } from '../../../lib/testing/dates';

// The ui barrel reaches Supabase transitively; the list never calls it.
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const nobody = { id: 'o-nobody', date: iso(2) };
const someone = { id: 'o-someone', date: iso(3) };

const widthOf = (optionId: string) =>
  StyleSheet.flatten(screen.getByTestId(`vote-fill-${optionId}`).props.style).width;

async function renderList(minPeople: number) {
  await render(
    <DateVoteList
      dateOptions={[nobody, someone]}
      countByDate={{
        [nobody.id]: { count: 0, date: nobody.date },
        [someone.id]: { count: 1, date: someone.date },
      }}
      leadId={someone.id}
      picked={[]}
      minPeople={minPeople}
      onToggle={jest.fn()}
    />
  );
}

describe('DateVoteList fill', () => {
  it('measures availability against the minimum', async () => {
    await renderList(4);

    expect(widthOf(nobody.id)).toBe('0%');
    expect(widthOf(someone.id)).toBe('25%');
  });

  it('fills on any availability when there is no minimum, and stays a real width at zero', async () => {
    await renderList(NO_MINIMUM);

    expect(widthOf(nobody.id)).toBe('0%');
    expect(widthOf(someone.id)).toBe('100%');
  });
});
