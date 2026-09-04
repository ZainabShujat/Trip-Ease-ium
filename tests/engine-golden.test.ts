import { describe, expect, it } from 'vitest';
import { evaluatePlan, planFingerprint } from '@/engine/evaluate';
import { isOpenDuring, toMinutes, type Poi } from '@/lib/schemas';
import { rupees } from '@/lib/money';
import { weekdayOf } from '@/engine/schedule/frames';
import { isWhitelistedUrl } from '@/providers/links';
import { assertPlanInvariants, makeBrief, plan, planOrThrow } from './helpers/plan';

/**
 * Golden fixtures: three complete trips, end to end, entirely offline.
 *
 * These are the completion criterion for Phase 2 — TripBrief in, validated
 * itinerary and exact budget out, with no API key, no database, no network and
 * no model.
 *
 * Each trip is checked against the shared invariant set plus properties
 * specific to its shape.
 */

const DELHI_MANALI = makeBrief({
  interests: ['NATURE', 'CAFES', 'HERITAGE'],
  transportModes: ['BUS'],
  pace: 'BALANCED',
});

const MUMBAI_GOA = makeBrief({
  origin: { name: 'Mumbai', geo: { lat: 19.076, lng: 72.8777 } },
  destination: { name: 'Goa', geo: { lat: 15.5, lng: 73.83 } },
  startDate: '2026-11-02',
  endDate: '2026-11-05',
  travellerCount: 2,
  budgetTotalMinor: rupees(30_000),
  interests: ['NATURE', 'FOOD', 'HERITAGE'],
  pace: 'RELAXED',
});

const JAIPUR = makeBrief({
  origin: { name: 'Delhi', geo: { lat: 28.6139, lng: 77.209 } },
  destination: { name: 'Jaipur', geo: { lat: 26.9124, lng: 75.7873 } },
  startDate: '2026-12-05',
  endDate: '2026-12-07',
  travellerCount: 2,
  budgetTotalMinor: rupees(22_000),
  interests: ['HERITAGE', 'SHOPPING', 'CULTURE'],
  pace: 'BALANCED',
});

const SCENARIOS = [
  { name: 'Delhi → Manali, 6 days, 4 travellers, ₹40,000', brief: DELHI_MANALI },
  { name: 'Mumbai → Goa, 4 days, 2 travellers, ₹30,000', brief: MUMBAI_GOA },
  { name: 'Delhi → Jaipur, 3 days, 2 travellers, ₹22,000', brief: JAIPUR },
] as const;

describe.each(SCENARIOS)('$name', ({ brief }) => {
  it('produces a plan that satisfies every invariant', async () => {
    const planned = await planOrThrow(brief);
    assertPlanInvariants(planned);
  });

  it('is byte-identical across repeated runs', async () => {
    // Determinism is what makes every other assertion here meaningful.
    const a = await planOrThrow(brief);
    const b = await planOrThrow(brief);
    expect(planFingerprint(a)).toBe(planFingerprint(b));
  });

  it('never schedules a place outside its opening hours', async () => {
    const planned = await planOrThrow(brief);
    const poiById = new Map<string, Poi>(planned.selections.shortlist.map((p) => [p.id, p]));

    for (const day of planned.days) {
      const weekday = weekdayOf(day.date);
      for (const item of day.items) {
        if (!item.poiId) continue;
        const poi = poiById.get(item.poiId);
        if (!poi || poi.openingHours.kind === 'unknown') continue;
        expect(
          isOpenDuring(poi.openingHours, weekday, item.startTime, item.endTime),
          `${poi.name} on ${day.date} at ${item.startTime}-${item.endTime}`,
        ).toBe(true);
      }
    }
  });

  it('respects travel time between consecutive stops', async () => {
    const planned = await planOrThrow(brief);
    for (const day of planned.days) {
      const items = [...day.items].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
      for (let i = 1; i < items.length; i += 1) {
        const previous = items[i - 1]!;
        const current = items[i]!;
        const gap = toMinutes(current.startTime) - toMinutes(previous.endTime);
        expect(gap, `${previous.title} → ${current.title}`).toBeGreaterThanOrEqual(
          current.travelFromPrev?.durationMins ?? 0,
        );
      }
    }
  });

  it('keeps the budget exact and within the stated total', async () => {
    const planned = await planOrThrow(brief);
    const lineSum = planned.budget.lines.reduce((s, l) => s + l.estimatedMinor, 0);
    expect(planned.budget.totalEstimatedMinor).toBe(lineSum);
    expect(planned.budget.totalEstimatedMinor).toBeLessThanOrEqual(brief.budgetTotalMinor);
  });

  it('carries mock provenance all the way through the pipeline', async () => {
    // A plan built on fixtures must never emerge claiming to be live.
    const planned = await planOrThrow(brief);
    expect(planned.overallSourceKind).toBe('mock');
    expect(planned.selections.lodging.provenance.sourceKind).toBe('mock');
    expect(planned.selections.outbound.provenance.sourceKind).toBe('mock');
  });

  it('emits only whitelisted links', async () => {
    const planned = await planOrThrow(brief);
    for (const day of planned.days) {
      for (const item of day.items) {
        if (item.link) expect(isWhitelistedUrl(item.link.url), item.link.url).toBe(true);
      }
    }
    for (const option of planned.selections.alternatives.lodging) {
      if (option.link) expect(isWhitelistedUrl(option.link.url)).toBe(true);
    }
  });

  it('offers genuine alternatives, not the same option relabelled', async () => {
    const planned = await planOrThrow(brief);
    const lodgingIds = planned.selections.alternatives.lodging.map((l) => l.id);
    expect(new Set(lodgingIds).size).toBe(lodgingIds.length);
    expect(lodgingIds.length).toBeGreaterThanOrEqual(2);
  });

  it('schedules at least one meal on every day holding activities', async () => {
    const planned = await planOrThrow(brief);
    for (const day of planned.days) {
      const activities = day.items.filter(
        (i) => i.category === 'SIGHT' || i.category === 'ACTIVITY' || i.category === 'SHOPPING',
      );
      if (activities.length === 0) continue;
      const meals = day.items.filter((i) => i.category === 'MEAL' || i.category === 'CAFE');
      expect(meals.length, `day ${day.dayIndex} has activities but no meal`).toBeGreaterThan(0);
    }
  });

  it('includes both intercity legs', async () => {
    const planned = await planOrThrow(brief);
    const legs = planned.days.flatMap((d) => d.items.filter((i) => i.category === 'TRANSPORT'));
    expect(legs.length).toBeGreaterThanOrEqual(2);
  });

  it('reports metrics in sane ranges', async () => {
    const planned = await planOrThrow(brief);
    const metrics = evaluatePlan(planned);
    expect(metrics.budgetAdherence).toBeGreaterThan(0);
    expect(metrics.budgetAdherence).toBeLessThanOrEqual(1);
    expect(metrics.hardViolations).toBe(0);
    expect(metrics.travelTimeRatio).toBeGreaterThanOrEqual(0);
    expect(metrics.travelTimeRatio).toBeLessThan(1);
    expect(metrics.preferenceSatisfaction).toBeGreaterThanOrEqual(0);
    expect(metrics.preferenceSatisfaction).toBeLessThanOrEqual(1);
  });
});

describe('Delhi → Manali reference scenario', () => {
  it('lands inside the ₹40,000 budget with a full itinerary', async () => {
    // The scenario from the approved architecture, and the demo path.
    const planned = await planOrThrow(DELHI_MANALI);

    expect(planned.budget.totalEstimatedMinor).toBeLessThanOrEqual(rupees(40_000));
    expect(planned.budget.status).toMatch(/ON_TRACK|NEARLY_EXHAUSTED|UNDER/);

    const activityDays = planned.days.filter((d) =>
      d.items.some((i) => i.category === 'SIGHT' || i.category === 'ACTIVITY'),
    );
    expect(activityDays.length).toBeGreaterThanOrEqual(3);
    expect(planned.validation.hardCount).toBe(0);
  });

  it('serves every stated interest', async () => {
    const planned = await planOrThrow(DELHI_MANALI);
    expect(evaluatePlan(planned).preferenceSatisfaction).toBe(1);
  });

  it('reports which soft constraints it had to surrender', async () => {
    // A tight budget forces trade-offs; hiding them would be dishonest.
    const planned = await planOrThrow(DELHI_MANALI);
    expect(Array.isArray(planned.relaxedConstraints)).toBe(true);
    for (const relaxed of planned.relaxedConstraints) {
      expect(typeof relaxed).toBe('string');
    }
  });
});

describe('Goa scenario shape', () => {
  it('spreads a multi-cluster destination across days', async () => {
    const planned = await planOrThrow(MUMBAI_GOA);
    expect(['KMEANS', 'ONE_PER_DAY', 'SCORE_ORDERED']).toContain(planned.clusterStrategy);
  });

  it('does not schedule the Wednesday-only market on another weekday', async () => {
    // The fixture's flea market opens on Wednesdays only. If it appears at
    // all, it must be on a Wednesday.
    const planned = await planOrThrow(MUMBAI_GOA);
    for (const day of planned.days) {
      const market = day.items.find((i) => i.poiId === 'goa-anjuna-market');
      if (market) expect(weekdayOf(day.date)).toBe(3);
    }
  });
});

describe('Jaipur scenario shape', () => {
  it('plans a short trip without over-relaxing', async () => {
    const planned = await planOrThrow(JAIPUR);
    assertPlanInvariants(planned);
    expect(planned.days.length).toBe(3);
  });

  it('does not schedule the closed-on-Sunday bazaars on a Sunday', async () => {
    const planned = await planOrThrow(JAIPUR);
    for (const day of planned.days) {
      if (weekdayOf(day.date) !== 0) continue;
      const bazaar = day.items.find(
        (i) => i.poiId === 'jai-johari-bazaar' || i.poiId === 'jai-bapu-bazaar',
      );
      expect(bazaar, `bazaar scheduled on Sunday ${day.date}`).toBeUndefined();
    }
  });
});

describe('offline guarantee', () => {
  it('plans all three trips with the network disabled', async () => {
    // The completion criterion, asserted rather than assumed.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error('the engine attempted a network request');
    }) as typeof fetch;

    try {
      for (const scenario of SCENARIOS) {
        const result = await plan(scenario.brief);
        expect(result.ok, `${scenario.name} failed offline`).toBe(true);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
