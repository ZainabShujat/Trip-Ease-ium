import { describe, expect, it } from 'vitest';
import { formatMoney, ratioOf, rupees, splitMinor, sumMinor, toMajor, toMinor } from '@/lib/money';

describe('money', () => {
  it('converts rupees to paise as integers', () => {
    expect(toMinor(1450)).toBe(145_000);
    expect(toMinor(0)).toBe(0);
    expect(rupees(38_450)).toBe(3_845_000);
  });

  it('round-trips through major units', () => {
    expect(toMajor(toMinor(2399.5))).toBe(2399.5);
  });

  it('sums without floating-point drift', () => {
    // The float version of this (0.1 + 0.2 !== 0.3) is exactly the bug that
    // would let a plan report itself as under budget when it is not.
    const parts = [rupees(0.1), rupees(0.2)];
    expect(sumMinor(parts)).toBe(rupees(0.3));
  });

  it('adds a realistic trip to an exact total', () => {
    const total = sumMinor([
      rupees(10_200), // transport
      rupees(14_000), // accommodation
      rupees(7_200), //  food
      rupees(4_500), //  activities
      rupees(2_550), //  local transport
    ]);
    expect(total).toBe(rupees(38_450));
    expect(formatMoney(total)).toBe('₹38,450');
  });

  describe('splitMinor', () => {
    it('splits evenly when it divides cleanly', () => {
      expect(splitMinor(rupees(400), 4)).toEqual([
        rupees(100),
        rupees(100),
        rupees(100),
        rupees(100),
      ]);
    });

    it('never loses or invents a paisa on an uneven split', () => {
      const total = 1000;
      for (const ways of [3, 6, 7, 9, 11]) {
        const parts = splitMinor(total, ways);
        expect(parts).toHaveLength(ways);
        expect(sumMinor(parts)).toBe(total);
        // Parts differ by at most one minor unit.
        expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
      }
    });

    it('rejects a non-positive party size', () => {
      expect(() => splitMinor(100, 0)).toThrow(RangeError);
    });
  });

  it('treats a zero budget as zero ratio rather than dividing by zero', () => {
    expect(ratioOf(rupees(100), 0)).toBe(0);
    expect(ratioOf(rupees(38_450), rupees(40_000))).toBeCloseTo(0.961, 3);
  });

  it('formats Indian digit grouping', () => {
    expect(formatMoney(rupees(100_000))).toBe('₹1,00,000');
    expect(formatMoney(rupees(1250), 'INR', { showMinor: true })).toBe('₹1,250.00');
  });
});
