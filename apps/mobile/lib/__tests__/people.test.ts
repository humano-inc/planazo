import {
  MIN_SEARCH_LENGTH,
  cleanPeopleQuery,
  partitionPendingFriendships,
  relationOf,
  searchResultsWithNotes,
  sharedPeopleFrom,
  type PersonRow,
  type SharedGroupRow,
} from '../people';

const profile = (id: string, name: string) => ({
  id,
  display_name: name,
  handle: `${id}handle`,
  avatar_url: null,
});

const group = (name: string, members: Array<{ profile: any }>): SharedGroupRow => ({
  groups: { name, group_members: members },
});

describe('partitionPendingFriendships', () => {
  it('splits by which end of the arrow I am on', () => {
    const { outgoing, incoming } = partitionPendingFriendships(
      [
        { requester_id: 'me', addressee_id: 'p1' },
        { requester_id: 'p2', addressee_id: 'me' },
      ],
      'me'
    );

    expect([...outgoing]).toEqual(['p1']);
    expect([...incoming]).toEqual(['p2']);
  });

  it('is two empty sets before the user is known', () => {
    const { outgoing, incoming } = partitionPendingFriendships([], undefined);

    expect(outgoing.size).toBe(0);
    expect(incoming.size).toBe(0);
  });
});

describe('sharedPeopleFrom', () => {
  it('names the group that introduced you and leaves you out of your own list', () => {
    const rows = [group('Piso Gràcia', [{ profile: profile('me', 'Rocío') }, { profile: profile('p1', 'Jordi Puig') }])];

    expect(sharedPeopleFrom(rows, 'me')).toEqual([
      {
        id: 'p1',
        name: 'Jordi Puig',
        handle: 'p1handle',
        avatarUrl: null,
        note: 'both in Piso Gràcia',
      },
    ]);
  });

  it('lists someone in two of my groups once, under the group that came back first', () => {
    const rows = [
      group('Piso Gràcia', [{ profile: profile('p1', 'Jordi Puig') }]),
      group('Padel', [{ profile: profile('p1', 'Jordi Puig') }]),
    ];

    const people = sharedPeopleFrom(rows, 'me');

    expect(people).toHaveLength(1);
    expect(people[0]?.note).toBe('both in Piso Gràcia');
  });

  it('skips a membership row whose profile did not come back', () => {
    const rows = [group('Piso Gràcia', [{ profile: null }, { profile: profile('p1', 'Jordi Puig') }])];

    expect(sharedPeopleFrom(rows, 'me').map((p) => p.id)).toEqual(['p1']);
  });

  it('sorts by name across groups, not by the order the groups arrived', () => {
    const rows = [
      group('Padel', [{ profile: profile('p2', 'Zoe Marín') }]),
      group('Piso Gràcia', [{ profile: profile('p1', 'Aina Roig') }]),
    ];

    expect(sharedPeopleFrom(rows, 'me').map((p) => p.name)).toEqual(['Aina Roig', 'Zoe Marín']);
  });

  it('is empty when a group row carries no group at all', () => {
    expect(sharedPeopleFrom([{ groups: null }], 'me')).toEqual([]);
  });
});

describe('relationOf', () => {
  const sources = (over: Partial<Parameters<typeof relationOf>[0]> = {}) => ({
    friendIds: new Set<string>(),
    sentTo: {} as Record<string, true>,
    pending: { outgoing: new Set<string>(), incoming: new Set<string>() },
    ...over,
  });

  it('is none for a stranger', () => {
    expect(relationOf(sources(), 'p1')).toBe('none');
  });

  it('reads a request this screen just sent, before any refetch', () => {
    expect(relationOf(sources({ sentTo: { p1: true } }), 'p1')).toBe('requested');
  });

  it('reads a request the server already knew about', () => {
    const pending = { outgoing: new Set(['p1']), incoming: new Set<string>() };

    expect(relationOf(sources({ pending }), 'p1')).toBe('requested');
  });

  it('offers Accept to someone who asked me', () => {
    const pending = { outgoing: new Set<string>(), incoming: new Set(['p1']) };

    expect(relationOf(sources({ pending }), 'p1')).toBe('incoming');
  });

  it('lets a friendship outrank a pending row left behind by it', () => {
    const pending = { outgoing: new Set(['p1']), incoming: new Set(['p1']) };

    expect(relationOf(sources({ friendIds: new Set(['p1']), pending }), 'p1')).toBe('friend');
  });

  it('reads a crossing pair as Requested, so my own ask is what I see', () => {
    const pending = { outgoing: new Set(['p1']), incoming: new Set(['p1']) };

    expect(relationOf(sources({ pending }), 'p1')).toBe('requested');
  });

  it('answers before the pending query lands', () => {
    expect(relationOf(sources({ pending: undefined }), 'p1')).toBe('none');
    expect(relationOf(sources({ pending: undefined, friendIds: new Set(['p1']) }), 'p1')).toBe(
      'friend'
    );
  });
});

describe('cleanPeopleQuery', () => {
  it('trims without touching the letters', () => {
    expect(cleanPeopleQuery('  Aina  ')).toBe('Aina');
  });

  it('strips the characters that mean something to the search', () => {
    expect(cleanPeopleQuery('Aina%,()')).toBe('Aina');
  });

  it('leaves a name made only of those characters too short to search', () => {
    expect(cleanPeopleQuery('()').length).toBeLessThan(MIN_SEARCH_LENGTH);
    expect(cleanPeopleQuery('a(').length).toBeLessThan(MIN_SEARCH_LENGTH);
  });

  it('counts two real letters as enough', () => {
    expect(cleanPeopleQuery('ai(').length).toBeGreaterThanOrEqual(MIN_SEARCH_LENGTH);
  });
});

describe('searchResultsWithNotes', () => {
  const shared: PersonRow[] = [
    {
      id: 'p1',
      name: 'Jordi Puig',
      handle: 'jordipuig',
      avatarUrl: null,
      note: 'both in Piso Gràcia',
    },
  ];

  it('carries the shared-group note onto someone found by name', () => {
    const found = searchResultsWithNotes(
      [{ id: 'p1', display_name: 'Jordi Puig', handle: 'jordipuig', avatar_url: null }],
      shared
    );

    expect(found[0]?.note).toBe('both in Piso Gràcia');
  });

  it('leaves a stranger without one', () => {
    const found = searchResultsWithNotes(
      [{ id: 'p9', display_name: 'Pau Serra', handle: 'pauserra', avatar_url: null }],
      shared
    );

    expect(found).toEqual([
      {
        id: 'p9',
        name: 'Pau Serra',
        handle: 'pauserra',
        avatarUrl: null,
        note: null,
      },
    ]);
  });
});
