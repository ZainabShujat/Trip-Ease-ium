/**
 * Money handling for the planner.
 *
 * RULE: every monetary value in this system is an integer number of MINOR
 * UNITS (paise for INR). Floats never touch a price, a subtotal or a budget.
 *
 * Why this matters here specifically: the budget engine sums dozens of costs
 * and then asserts `total <= budget`. With floats, 0.1 + 0.2 !== 0.3 and a
 * plan can be reported as over budget by a fraction of a paisa. Integers make
 * the arithmetic exact and the assertion trustworthy.
 *
 * The `Minor` suffix on every field name keeps the unit visible at the call
 * site, so `pricePerPersonMinor` can never be mistaken for rupees.
 */

/** An integer count of minor currency units (paise for INR). */
export type Minor = number;

export const MINOR_UNITS_PER_MAJOR = 100;

/** Rupees (or other major unit) to minor units. Rounds to the nearest paisa. */
export function toMinor(major: number): Minor {
  return Math.round(major * MINOR_UNITS_PER_MAJOR);
}

/** Minor units back to a major-unit number. For display and charts only. */
export function toMajor(minor: Minor): number {
  return minor / MINOR_UNITS_PER_MAJOR;
}

/** Convenience alias that reads well in fixtures: `rupees(1450)`. */
export const rupees = toMinor;

/**
 * Sum minor amounts. Trivial, but everything routes through it so there is a
 * single place to add overflow or currency-mismatch checks later.
 */
export function sumMinor(amounts: readonly Minor[]): Minor {
  let total = 0;
  for (const amount of amounts) total += amount;
  return total;
}

/**
 * Split a cost across travellers without losing or inventing paise.
 * The remainder is distributed one unit at a time across the first shares, so
 * the parts always add back up to exactly the original amount.
 */
export function splitMinor(total: Minor, ways: number): Minor[] {
  if (ways <= 0) throw new RangeError(`splitMinor: ways must be positive, got ${ways}`);
  const base = Math.floor(total / ways);
  const remainder = total - base * ways;
  return Array.from({ length: ways }, (_, i) => (i < remainder ? base + 1 : base));
}

/** Percentage of a budget consumed, 0..1+. Returns 0 for a zero budget. */
export function ratioOf(amount: Minor, budget: Minor): number {
  if (budget === 0) return 0;
  return amount / budget;
}

const CURRENCY_SYMBOL: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
};

/**
 * Format for display, e.g. 3845000 -> "₹38,450". Fractional paise are dropped
 * because travel prices are quoted in whole rupees; pass `showMinor` when the
 * exact figure matters (an expense split, say).
 */
export function formatMoney(
  minor: Minor,
  currency = 'INR',
  options: { showMinor?: boolean; locale?: string } = {},
): string {
  const { showMinor = false, locale = 'en-IN' } = options;
  const symbol = CURRENCY_SYMBOL[currency] ?? `${currency} `;
  const major = toMajor(minor);
  const formatted = major.toLocaleString(locale, {
    minimumFractionDigits: showMinor ? 2 : 0,
    maximumFractionDigits: showMinor ? 2 : 0,
  });
  return `${symbol}${formatted}`;
}
