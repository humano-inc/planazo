import {
  audienceChipLabel,
  audienceHelper,
  audienceLabel,
  isPlanAudience,
  needsPeople,
  postLabel,
  reachCaption,
} from '../planAudience';
import { colors } from '../../theme/tokens';

describe('isPlanAudience', () => {
  it('accepts the three audiences and nothing else', () => {
    expect(isPlanAudience('group')).toBe(true);
    expect(isPlanAudience('friends')).toBe(true);
    expect(isPlanAudience('friends_of_friends')).toBe(true);
    expect(isPlanAudience('everyone')).toBe(false);
    expect(isPlanAudience(null)).toBe(false);
    expect(isPlanAudience(undefined)).toBe(false);
  });
});

describe('audienceChipLabel', () => {
  it('names the two chips', () => {
    expect(audienceChipLabel('friends')).toBe('Friends');
    expect(audienceChipLabel('friends_of_friends')).toBe('Friends of friends');
  });
});

describe('audienceLabel', () => {
  it('a group plan shows its group, colour as stored', () => {
    expect(
      audienceLabel({ audience: 'group', groups: { name: 'Domingueros', color: '#123456' } })
    ).toEqual({ label: 'Domingueros', color: '#123456', people: false });
  });

  it('a group with no colour of its own leaves the colour to the card', () => {
    expect(audienceLabel({ audience: 'group', groups: { name: 'Domingueros', color: null } }))
      .toEqual({ label: 'Domingueros', color: null, people: false });
  });

  it('a friends plan says so, in ember, with the people mark', () => {
    expect(audienceLabel({ audience: 'friends', groups: null })).toEqual({
      label: 'Your friends',
      color: colors.accent,
      people: true,
    });
  });

  it('a friends-of-friends plan names the bridge when there is one', () => {
    expect(
      audienceLabel({ audience: 'friends_of_friends', groups: null, plan_bridge: 'Marta' })
    ).toEqual({ label: 'Friends of friends · via Marta', color: colors.accent, people: true });
  });

  it('a friends-of-friends plan you reach directly names no bridge', () => {
    expect(audienceLabel({ audience: 'friends_of_friends', groups: null, plan_bridge: null }))
      .toEqual({ label: 'Friends of friends', color: colors.accent, people: true });
    expect(audienceLabel({ audience: 'friends_of_friends', groups: null }).label).toBe(
      'Friends of friends'
    );
  });

  it('a group plan whose group is somehow missing falls back to friends rather than crashing', () => {
    expect(audienceLabel({ audience: 'group', groups: null }).label).toBe('Your friends');
  });
});

describe('postLabel', () => {
  it('names the destination', () => {
    expect(postLabel('friends', null)).toBe('Post to your friends');
    expect(postLabel('friends_of_friends', null)).toBe('Post to friends of friends');
    expect(postLabel('group', 'Escapistas')).toBe('Post to Escapistas');
  });

  it('waits for the group name rather than printing "Post to …"', () => {
    expect(postLabel('group', null)).toBe('Post');
  });
});

describe('audienceHelper', () => {
  it('states the join rule for each audience and nothing for a group', () => {
    expect(audienceHelper('friends')).toBe("Everyone you're friends with sees it and can join.");
    expect(audienceHelper('friends_of_friends')).toBe(
      'Your friends and their friends see it and can join.'
    );
    expect(audienceHelper('group')).toBeNull();
  });
});

describe('reachCaption', () => {
  it('says nothing on a group plan', () => {
    expect(
      reachCaption({ audience: 'group', hostName: 'Lucas', bridge: null, youCreated: false })
    ).toBeNull();
  });

  it('a friends plan names the host, or you', () => {
    expect(
      reachCaption({ audience: 'friends', hostName: 'Lucas', bridge: null, youCreated: false })
    ).toBe('Lucas shares this with all their friends.');
    expect(
      reachCaption({ audience: 'friends', hostName: 'Lucas', bridge: null, youCreated: true })
    ).toBe('You share this with all your friends.');
  });

  it('a friends-of-friends plan names the bridge you came through', () => {
    expect(
      reachCaption({
        audience: 'friends_of_friends',
        hostName: 'Lucas',
        bridge: 'Marta',
        youCreated: false,
      })
    ).toBe("Lucas shares plans with friends of friends. You're here through Marta.");
  });

  it('a direct friend on a friends-of-friends plan gets the reach without a bridge', () => {
    expect(
      reachCaption({
        audience: 'friends_of_friends',
        hostName: 'Lucas',
        bridge: null,
        youCreated: false,
      })
    ).toBe('Lucas shares plans with friends of friends.');
  });

  it('the creator of a friends-of-friends plan is told in the second person', () => {
    expect(
      reachCaption({
        audience: 'friends_of_friends',
        hostName: 'Lucas',
        bridge: null,
        youCreated: true,
      })
    ).toBe('You share this with friends of friends.');
  });

  it('a host with no name is still a host', () => {
    expect(
      reachCaption({ audience: 'friends', hostName: '  ', bridge: null, youCreated: false })
    ).toBe('The host shares this with all their friends.');
    expect(
      reachCaption({ audience: 'friends', hostName: undefined, bridge: null, youCreated: false })
    ).toBe('The host shares this with all their friends.');
  });
});

describe('needsPeople', () => {
  it('is only true with neither a group nor a friend', () => {
    expect(needsPeople(false, false)).toBe(true);
    expect(needsPeople(true, false)).toBe(false);
    expect(needsPeople(false, true)).toBe(false);
    expect(needsPeople(true, true)).toBe(false);
  });
});
