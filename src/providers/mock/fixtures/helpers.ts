import type { OpeningHours, Poi, Provenance } from '@/lib/schemas';

/**
 * Shared fixture builders.
 *
 * Every destination fixture uses these so the provenance marking and the
 * opening-hours shape are identical across them — a fixture that forgot to
 * mark itself `mock` would be rendered by the UI as live availability.
 */

export const MOCK_PROVENANCE: Provenance = {
  sourceKind: 'mock',
  provider: 'fixture',
  fetchedAt: '2026-01-01T00:00:00+05:30',
  confidence: 'medium',
};

export const ALWAYS_OPEN: OpeningHours = { kind: 'always' };

/** Same hours every day of the week. */
export function daily(opens: string, closes: string): OpeningHours {
  return {
    kind: 'weekly',
    intervals: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens, closes })),
    closedWeekdays: [],
  };
}

/** Same hours, but shut on the given weekdays (0 = Sunday). */
export function dailyExcept(opens: string, closes: string, closedWeekdays: number[]): OpeningHours {
  return {
    kind: 'weekly',
    intervals: [0, 1, 2, 3, 4, 5, 6]
      .filter((d) => !closedWeekdays.includes(d))
      .map((weekday) => ({ weekday, opens, closes })),
    closedWeekdays,
  };
}

export type PoiSeed = Omit<Poi, 'provenance' | 'tags' | 'typicalCostPerPersonMinor'> & {
  tags?: string[];
  typicalCostPerPersonMinor?: number;
};

export function poi(seed: PoiSeed): Poi {
  return {
    ...seed,
    tags: seed.tags ?? [],
    typicalCostPerPersonMinor: seed.typicalCostPerPersonMinor ?? 0,
    provenance: MOCK_PROVENANCE,
  };
}
