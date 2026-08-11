import {
  MAX_POLL_OPTIONS,
  cleanPollDraft,
  emptyPollDraft,
  pollDraftTouched,
  pollDraftValid,
} from '../pollDraft';

const draft = (question: string, options: string[]) => ({ question, options });

describe('emptyPollDraft', () => {
  it('starts with two blank options, the minimum a poll can ask', () => {
    expect(emptyPollDraft()).toEqual({ question: '', options: ['', ''] });
  });

  it('hands back a new object each time, so two sheets cannot share state', () => {
    const a = emptyPollDraft();
    a.options[0] = 'typed into the first sheet';
    expect(emptyPollDraft().options[0]).toBe('');
  });
});

describe('cleanPollDraft', () => {
  it('trims the question and every option', () => {
    expect(cleanPollDraft(draft('  Which film?  ', ['  Dune ', 'Alien  ']))).toEqual({
      question: 'Which film?',
      options: ['Dune', 'Alien'],
    });
  });

  it('drops blanks rather than posting an empty row', () => {
    expect(cleanPollDraft(draft('Q', ['Dune', '   ', '', 'Alien'])).options).toEqual([
      'Dune',
      'Alien',
    ]);
  });
});

describe('pollDraftValid', () => {
  it('accepts a question with two distinct options', () => {
    expect(pollDraftValid(draft('Which film?', ['Dune', 'Alien']))).toBe(true);
  });

  it.each([
    ['no question', draft('', ['Dune', 'Alien'])],
    ['a whitespace question', draft('   ', ['Dune', 'Alien'])],
    ['one real option', draft('Q', ['Dune', '  '])],
    ['no options at all', draft('Q', [])],
  ])('refuses %s', (_name, d) => {
    expect(pollDraftValid(d)).toBe(false);
  });

  it('refuses duplicate options, which would split the same vote in two', () => {
    expect(pollDraftValid(draft('Q', ['Dune', 'Dune']))).toBe(false);
  });

  it('compares duplicates after trimming, not before', () => {
    expect(pollDraftValid(draft('Q', ['Dune', '  Dune  ']))).toBe(false);
  });

  it('treats options differing only in case as distinct, as the host typed them', () => {
    expect(pollDraftValid(draft('Q', ['Dune', 'dune']))).toBe(true);
  });
});

describe('pollDraftTouched', () => {
  it('is false for a fresh draft, so the create sheet posts no half poll', () => {
    expect(pollDraftTouched(emptyPollDraft())).toBe(false);
  });

  it.each([
    ['the question', draft('Which film?', ['', ''])],
    ['one option', draft('', ['Dune', ''])],
  ])('is true once %s has anything in it', (_name, d) => {
    expect(pollDraftTouched(d)).toBe(true);
  });

  it('ignores whitespace, which is not something anyone meant to type', () => {
    expect(pollDraftTouched(draft('  ', ['  ', ' ']))).toBe(false);
  });
});

describe('MAX_POLL_OPTIONS', () => {
  it('is six, which is already generous for one host-written list', () => {
    expect(MAX_POLL_OPTIONS).toBe(6);
  });
});
