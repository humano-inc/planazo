import { useState } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { PlaceField } from '../PlaceField';
import { type PlaceDraft, placeDraftFrom } from '../../../lib/placeDraft';
import { supabase } from '../../../lib/supabase';
import { renderWithQuery } from '../../../lib/testing/render';

jest.mock('../../../lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));

const invoke = supabase.functions.invoke as jest.Mock;
const ARENA = { id: 'p1', title: 'Arena Padel Mendoza', subtitle: 'Pedro del Castillo, Mendoza' };
const LIBERTAD = { id: 'p2', title: 'Pádel Club Libertad', subtitle: 'Ing. Huergo, Godoy Cruz' };

const changes = jest.fn();
/** The draft after the most recent change. */
const latest = (): PlaceDraft => changes.mock.lastCall![0];

function Harness({ initial }: { initial: PlaceDraft }) {
  const [draft, setDraft] = useState(initial);
  return (
    <PlaceField
      draft={draft}
      onChange={(next) => {
        changes(next);
        setDraft(next);
      }}
      cityId="c1"
    />
  );
}

const renderField = (initial = placeDraftFrom('', null)) =>
  renderWithQuery(<Harness initial={initial} />);

const type = (text: string) => fireEvent.changeText(screen.getByTestId('location-input'), text);

beforeEach(() => {
  changes.mockClear();
  invoke.mockReset();
  invoke.mockResolvedValue({ data: { suggestions: [ARENA, LIBERTAD] }, error: null });
});

describe('PlaceField', () => {
  it('offers real places while someone types, credited to Google Maps', async () => {
    await renderField();
    await type('Arena');

    expect(await screen.findByText('Arena Padel Mendoza')).toBeTruthy();
    expect(screen.getByText('Pedro del Castillo, Mendoza')).toBeTruthy();
    expect(screen.getByText('Google Maps')).toBeTruthy();
    expect(invoke).toHaveBeenCalledWith('place-search', { body: { q: 'Arena', cityId: 'c1' } });
  });

  it('spends nothing just because a plan already has words', async () => {
    await renderField(placeDraftFrom('Club Vall d’Hebron', null));
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(invoke).not.toHaveBeenCalled();
    expect(screen.queryByTestId('place-suggestions')).toBeNull();
  });

  it('picking keeps the host\'s words, confirms the place and closes the list', async () => {
    await renderField();
    await type('Arena Pad');
    await fireEvent.press(await screen.findByTestId('place-suggestion-0'));

    expect(screen.getByTestId('location-input').props.value).toBe('Arena Pad');
    expect(latest().placeId).toBe('p1');
    expect(screen.getByTestId('place-picked')).toBeTruthy();
    expect(screen.getByText('Arena Padel Mendoza')).toBeTruthy();
    expect(screen.getByText('Google Maps opens this place. People see what you wrote above.')).toBeTruthy();
    expect(screen.queryByTestId('place-suggestions')).toBeNull();
  });

  it('remains usable as plain free text with no pick', async () => {
    invoke.mockResolvedValue({ data: { suggestions: [] }, error: null });
    await renderField();
    await type('casa de Juan');
    await waitFor(() => expect(invoke).toHaveBeenCalled());

    expect(latest()).toEqual(placeDraftFrom('casa de Juan', null));
    expect(screen.queryByTestId('place-suggestions')).toBeNull();
    expect(screen.queryByTestId('place-picked')).toBeNull();
  });

  it('a search that fails leaves the field working, with no list and no alert', async () => {
    invoke.mockRejectedValue(new Error('down'));
    await renderField();
    await type('Arena');
    await waitFor(() => expect(invoke).toHaveBeenCalled());

    expect(screen.queryByTestId('place-suggestions')).toBeNull();
    expect(latest().words).toBe('Arena');
  });

  it('removing the place keeps the words', async () => {
    await renderField();
    await type('Arena');
    await fireEvent.press(await screen.findByTestId('place-suggestion-0'));
    await fireEvent.press(screen.getByTestId('place-remove'));

    expect(latest()).toEqual(placeDraftFrom('Arena', null));
    expect(screen.queryByTestId('place-picked')).toBeNull();
  });

  it('finishing the sentence keeps the pick, without searching again', async () => {
    await renderField();
    await type('Arena');
    await fireEvent.press(await screen.findByTestId('place-suggestion-0'));
    invoke.mockClear();
    await type('Arena Padel');
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(latest().placeId).toBe('p1');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('replacing the words drops the pick and searches again', async () => {
    await renderField();
    await type('Arena');
    await fireEvent.press(await screen.findByTestId('place-suggestion-0'));
    await type('Club Libertad');

    expect(latest().placeId).toBeNull();
    expect(screen.queryByTestId('place-picked')).toBeNull();
    expect(await screen.findByTestId('place-suggestions')).toBeTruthy();
  });

  it('a pick saved earlier has no name to show, because none is stored', async () => {
    await renderField(placeDraftFrom('Arena', 'p1'));

    expect(screen.getByText('Exact place saved')).toBeTruthy();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('tells the form once when the list opens, so it can make room', async () => {
    const onSuggestionsOpen = jest.fn();
    await renderWithQuery(
      <PlaceField
        draft={placeDraftFrom('Arena', null)}
        onChange={() => {}}
        cityId="c1"
        onSuggestionsOpen={onSuggestionsOpen}
      />
    );
    expect(onSuggestionsOpen).not.toHaveBeenCalled();

    await type('Arena Padel');
    await screen.findByTestId('place-suggestions');
    expect(onSuggestionsOpen).toHaveBeenCalledTimes(1);
  });

  it('the list closes when the field loses focus', async () => {
    await renderField();
    await type('Arena');
    await screen.findByTestId('place-suggestions');
    await fireEvent(screen.getByTestId('location-input'), 'blur');

    expect(screen.queryByTestId('place-suggestions')).toBeNull();
  });
});
