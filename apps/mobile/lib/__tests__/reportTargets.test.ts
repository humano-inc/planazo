import { reportTargets, reportValid } from '../reportTargets';

const ME = 'u-me';

describe('reportTargets: what the sheet is pointed at', () => {
  it('defaults to a plan when the route carries no type', () => {
    expect(reportTargets({}, ME).subjectType).toBe('plan');
  });

  it('keeps the subject id, or an empty string when the link had none', () => {
    expect(reportTargets({ id: 'p1' }, ME).subjectId).toBe('p1');
    expect(reportTargets({}, ME).subjectId).toBe('');
  });
});

describe('reportTargets: where Cancel lands', () => {
  it.each([
    ['plan with an id', { type: 'plan' as const, id: 'p1' }, '/(app)/plan/p1'],
    ['group with an id', { type: 'group' as const, id: 'g1' }, '/(app)/group/g1'],
    // Neither has a route of its own, so the feed is the honest answer.
    ['profile', { type: 'profile' as const, id: 'u9' }, '/(app)/(tabs)'],
    ['photo', { type: 'photo' as const, id: 'ph1' }, '/(app)/(tabs)'],
    // A link with a type but no id cannot address the thing it names.
    ['plan with no id', { type: 'plan' as const }, '/(app)/(tabs)'],
    ['group with no id', { type: 'group' as const }, '/(app)/(tabs)'],
    ['nothing at all', {}, '/(app)/(tabs)'],
  ])('%s', (_name, params, expected) => {
    expect(reportTargets(params, ME).dismissTo).toBe(expected);
  });
});

describe('reportTargets: the self-block guard', () => {
  it('offers the block when the person is someone else', () => {
    expect(reportTargets({ personId: 'u-them' }, ME).personId).toBe('u-them');
  });

  it('never offers to block yourself', () => {
    // Reporting your own plan by accident is a real thing people do.
    expect(reportTargets({ personId: ME }, ME).personId).toBeNull();
  });

  it('offers nothing when the link named no person', () => {
    expect(reportTargets({}, ME).personId).toBeNull();
  });

  it('holds the block back while the viewer is unknown', () => {
    // Signed out there is nobody to compare against, so the guard cannot say
    // this is not you. It still resolves to a person, and reportValid is what
    // stops the report going anywhere.
    expect(reportTargets({ personId: 'u-them' }, null).personId).toBe('u-them');
    expect(reportValid({ subjectId: 'p1' }, 'spam', null)).toBe(false);
  });
});

describe('reportTargets: the person name', () => {
  it('uses the name the link carried', () => {
    expect(reportTargets({ personName: 'Marta' }, ME).personName).toBe('Marta');
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['whitespace only', '   '],
  ])('falls back to a neutral noun when the name is %s', (_name, personName) => {
    expect(reportTargets({ personName }, ME).personName).toBe('this person');
  });
});

describe('reportValid', () => {
  it('needs a reason, a subject and a signed-in reporter', () => {
    expect(reportValid({ subjectId: 'p1' }, 'spam', ME)).toBe(true);
  });

  it.each([
    ['no reason', { subjectId: 'p1' }, null, ME],
    ['no subject', { subjectId: '' }, 'spam', ME],
    ['signed out', { subjectId: 'p1' }, 'spam', null],
    ['nothing at all', { subjectId: '' }, null, null],
  ])('refuses with %s', (_name, targets, reason, userId) => {
    expect(reportValid(targets, reason, userId)).toBe(false);
  });
});
