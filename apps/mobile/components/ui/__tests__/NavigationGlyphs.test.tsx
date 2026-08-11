import { render, screen } from '@testing-library/react-native';
import {
  BackGlyph,
  BlockGlyph,
  CloseGlyph,
  DisclosureGlyph,
  ForwardGlyph,
  MinusGlyph,
  MoreGlyph,
  PlusGlyph,
  RemoveGlyph,
  SearchGlyph,
} from '../NavigationGlyphs';

describe('NavigationGlyphs', () => {
  it.each([
    ['back-glyph', <BackGlyph />, 'chevron.backward'],
    ['forward-glyph', <ForwardGlyph />, 'chevron.forward'],
    ['more-glyph', <MoreGlyph />, 'ellipsis'],
    ['close-glyph', <CloseGlyph />, 'xmark'],
    ['plus-glyph', <PlusGlyph />, 'plus'],
    ['minus-glyph', <MinusGlyph />, 'minus'],
    ['search-glyph', <SearchGlyph />, 'magnifyingglass'],
    ['remove-glyph', <RemoveGlyph />, 'minus.circle'],
    ['block-glyph', <BlockGlyph />, 'nosign'],
  ])('uses the expected platform symbol for %s', async (testID, glyph, name) => {
    await render(glyph);

    expect(screen.getByTestId(testID).props.name).toBe(name);
  });

  it('lets a caller set the optical size and colour', async () => {
    await render(<PlusGlyph size={30} color="#fff" />);

    expect(screen.getByTestId('plus-glyph').props).toMatchObject({
      size: 30,
      tintColor: '#fff',
    });
  });

  it.each([
    [false, 'chevron.down'],
    [true, 'chevron.up'],
  ])('points the disclosure glyph at its %s state', async (expanded, name) => {
    await render(<DisclosureGlyph expanded={expanded} />);

    expect(screen.getByTestId('disclosure-glyph').props.name).toBe(name);
  });
});
