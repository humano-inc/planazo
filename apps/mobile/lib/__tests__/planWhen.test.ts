import { planWhenLabel } from '../planWhen';
import { fmtDay, fmtTime } from '../dates';
import { iso } from '../testing/dates';

const opts = (n: number) => Array.from({ length: n }, (_, i) => ({ date: iso(i + 1) }));

describe('planWhenLabel', () => {
  it('reads a locked date as a day and a time', () => {
    const at = iso(3, 20);
    expect(planWhenLabel({ locked_date: at }, opts(3))).toBe(`${fmtDay(at)} · ${fmtTime(at)}`);
  });

  it('prefers the locked date over the date a fixed plan was created with', () => {
    const locked = iso(3, 20);
    expect(planWhenLabel({ locked_date: locked, event_date: iso(9) }, [])).toBe(
      `${fmtDay(locked)} · ${fmtTime(locked)}`
    );
  });

  it("reads a fixed plan's own date when nothing is locked", () => {
    const at = iso(5, 18);
    expect(planWhenLabel({ event_date: at }, [])).toBe(`${fmtDay(at)} · ${fmtTime(at)}`);
  });

  it('counts what is still on the table while a flexible plan is open', () => {
    expect(planWhenLabel({}, opts(3))).toBe('3 dates on the table');
  });

  it('says date, not dates, when one is left', () => {
    expect(planWhenLabel({}, opts(1))).toBe('1 date on the table');
  });

  it('says none rather than nothing when a flexible plan has no options', () => {
    expect(planWhenLabel({ locked_date: null, event_date: null }, [])).toBe(
      '0 dates on the table'
    );
  });
});
