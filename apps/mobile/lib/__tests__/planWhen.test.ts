import { planWhenLabel, planWhenRows, spansDays } from '../planWhen';
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

describe('with an end', () => {
  const at = iso;

  describe('spansDays', () => {
    it('is false on one day, however long', () => {
      expect(spansDays(at(3, 8), at(3, 23))).toBe(false);
    });

    it('is false for one night out past midnight', () => {
      expect(spansDays(at(3, 22), at(4, 2))).toBe(false);
    });

    it('is true once crossing midnight takes twelve hours or more', () => {
      expect(spansDays(at(3, 18), at(4, 6))).toBe(true);
      expect(spansDays(at(3, 18), at(5, 12))).toBe(true);
    });
  });

  describe('planWhenLabel', () => {
    it('reads one day as a time range', () => {
      const start = at(3, 20);
      const end = at(3, 22);
      expect(planWhenLabel({ event_date: start, ends_at: end }, [])).toBe(
        `${fmtDay(start)} · ${fmtTime(start)} – ${fmtTime(end)}`
      );
    });

    it('reads one night past midnight as a time range on the day it starts', () => {
      const start = at(3, 22);
      const end = at(4, 2);
      expect(planWhenLabel({ locked_date: start, ends_at: end }, [])).toBe(
        `${fmtDay(start)} · ${fmtTime(start)} – ${fmtTime(end)}`
      );
    });

    it('names both days when it runs over several', () => {
      const start = at(3, 18);
      const end = at(5, 12);
      expect(planWhenLabel({ event_date: start, ends_at: end }, [])).toBe(
        `${fmtDay(start)} ${fmtTime(start)} – ${fmtDay(end)} ${fmtTime(end)}`
      );
    });

    it('stays a count on a vote, which has no end to show', () => {
      expect(planWhenLabel({ ends_at: null }, opts(2))).toBe('2 dates on the table');
    });
  });

  describe('planWhenRows', () => {
    it('is one row with the start alone when there is no end', () => {
      const start = at(3, 20);
      expect(planWhenRows(start, null)).toEqual([{ title: fmtDay(start), value: fmtTime(start) }]);
    });

    it('is one row with a range for one day or one night', () => {
      const start = at(3, 22);
      const end = at(4, 2);
      expect(planWhenRows(start, end)).toEqual([
        { title: fmtDay(start), value: `${fmtTime(start)} – ${fmtTime(end)}` },
      ]);
    });

    it('is a row per day when it runs over several', () => {
      const start = at(3, 18);
      const end = at(5, 12);
      expect(planWhenRows(start, end)).toEqual([
        { title: fmtDay(start), value: fmtTime(start) },
        { title: `Until ${fmtDay(end)}`, value: fmtTime(end) },
      ]);
    });
  });
});
