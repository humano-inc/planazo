import { placeSearchCity } from '../placeSearchCity';

const groups = [
  { id: 'g1', city_id: 'mendoza' },
  { id: 'g2', city_id: 'rosario' },
];

describe('placeSearchCity', () => {
  it('uses the plan\'s group', () => {
    expect(placeSearchCity(groups, 'g2')).toBe('rosario');
  });

  it.each([null, undefined])('falls back to the first group on a plan with no group (%s)', (id) => {
    expect(placeSearchCity(groups, id)).toBe('mendoza');
  });

  it('falls back to the first group when the plan\'s group is not one of mine', () => {
    expect(placeSearchCity(groups, 'g9')).toBe('mendoza');
  });

  it('is null for someone with no groups', () => {
    expect(placeSearchCity([], null)).toBeNull();
  });

  it('is null when the group has no city loaded', () => {
    expect(placeSearchCity([{ id: 'g1' }], 'g1')).toBeNull();
  });
});
