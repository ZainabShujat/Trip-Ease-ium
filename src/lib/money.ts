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

export const SUPPORTED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  INR: 'INR (₹)',
  USD: 'USD ($)',
  EUR: 'EUR (€)',
  GBP: 'GBP (£)',
};

export const CURRENCY_SYMBOL: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

/**
 * Standard benchmark exchange rates relative to Indian Rupee (INR).
 * 1 USD ≈ 86.5 INR, 1 EUR ≈ 93.0 INR, 1 GBP ≈ 111.0 INR.
 */
export const INR_EXCHANGE_RATES: Record<string, number> = {
  INR: 1,
  USD: 1 / 86.5,
  EUR: 1 / 93.0,
  GBP: 1 / 111.0,
};

/**
 * Convert an amount from one currency to another in real-time.
 * Strictly maintains whole currency units (no fractional paise/cents).
 */
export function convertMinor(amountMinor: Minor, fromCurrency = 'INR', toCurrency = 'INR'): Minor {
  if (fromCurrency === toCurrency) return amountMinor;
  const inrRate = INR_EXCHANGE_RATES[fromCurrency] ?? 1;
  const toRate = INR_EXCHANGE_RATES[toCurrency] ?? 1;
  const inrAmount = amountMinor / inrRate;
  const converted = inrAmount * toRate;
  return Math.round(converted);
}

/**
 * Format money cleanly for display.
 * Always formats in whole currency units (Rupees, Dollars, etc.) without fractional paise.
 */
export function formatMoney(
  minor: Minor,
  currency = 'INR',
  options: { showMinor?: boolean; locale?: string } = {},
): string {
  const { showMinor = false, locale = 'en-US' } = options;
  const symbol = CURRENCY_SYMBOL[currency] ?? `${currency} `;
  // Strictly whole rupees / currency units — drops all fractional paise
  const major = Math.round(toMajor(minor));
  const formatted = major.toLocaleString(locale, {
    minimumFractionDigits: showMinor ? 2 : 0,
    maximumFractionDigits: showMinor ? 2 : 0,
  });
  return `${symbol}${formatted}`;
}

/**
 * Format a major rupee amount cleanly as a whole integer without paise.
 * e.g., 40000 -> "₹40,000"
 */
export function formatRupees(amountInRupees: number): string {
  return `₹${Math.round(amountInRupees).toLocaleString('en-US')}`;
}
