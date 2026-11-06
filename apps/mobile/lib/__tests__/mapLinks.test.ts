import { appleMapsUrl, googleMapsUrl } from '../mapLinks';

describe.each([
  ['googleMapsUrl', googleMapsUrl, 'https://www.google.com/maps/search/?api=1&query='],
  [
    'appleMapsUrl',
    (location: string) => appleMapsUrl(location, null),
    'https://maps.apple.com/?q=',
  ],
])('%s', (_name, mapUrl, prefix) => {
  it('searches for what the host wrote', () => {
    expect(mapUrl('Parque')).toBe(`${prefix}Parque`);
  });

  it.each([
    ['accents', 'Arístides Villanueva', 'Ar%C3%ADstides%20Villanueva'],
    ['an ampersand, which would otherwise start a new parameter', 'Pizza & Birra', 'Pizza%20%26%20Birra'],
    ['a hash, which would otherwise end the query', 'Local #3', 'Local%20%233'],
    ['inner spaces', 'Plaza Independencia', 'Plaza%20Independencia'],
  ])('encodes %s', (_case, location, encoded) => {
    expect(mapUrl(location)).toBe(`${prefix}${encoded}`);
  });

  it('drops the whitespace around the words', () => {
    expect(mapUrl('  Parque \n')).toBe(`${prefix}Parque`);
  });
});

describe('appleMapsUrl near a city', () => {
  it('tells Apple where to search', () => {
    expect(appleMapsUrl('Plaza Independencia', { lat: -32.8895, lon: -68.8458 })).toBe(
      'https://maps.apple.com/?q=Plaza%20Independencia&sll=-32.8895,-68.8458'
    );
  });

  it('keeps a coordinate of zero rather than reading it as missing', () => {
    expect(appleMapsUrl('Parque', { lat: 0, lon: 0 })).toBe(
      'https://maps.apple.com/?q=Parque&sll=0,0'
    );
  });
});
