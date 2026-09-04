import { describe, expect, it } from 'vitest';
import { planFingerprint } from '@/engine/evaluate';
import { planTrip } from '@/engine/orchestrator';
import { isFailure } from '@/engine/result';
import type { SourcedCandidates } from '@/engine/types';
import { rupees } from '@/lib/money';
import { isWhitelistedUrl } from '@/providers/links';
import { assertPlanInvariants, candidatesFor, makeBrief, plan, planOrThrow } from './helpers/plan';

/**
 * Edge cases.
 *
 * The point of these is not coverage. Each one is a situation where a naive
 * planner produces something wrong but plausible-looking — an empty day, a
 * budget that silently overruns, a trek scheduled for someone who cannot
 * walk — and the assertion is that this engine either handles it correctly or
 * refuses with a typed reason.
 */

const OPTIONS = { isWhitelistedUrl };

describe('party size', () => {
  it('plans for a single traveller', async () => {
    const planned = await planOrThrow(
      makeBrief({ travellerCount: 1, budgetTotalMinor: rupees(18_000) }),
    );
    assertPlanInvariants(planned);
  });

  it('plans for a large party and books enough rooms', async () => {
    const planned = await planOrThrow(
      makeBrief({ travellerCount: 12, budgetTotalMinor: rupees(140_000) }),
    );
    assertPlanInvariants(planned);
    expect(planned.selections.lodging.roomsRequired).toBeGreaterThanOrEqual(3);
  });

  it('scales cost with party size', async () => {
    const two = await planOrThrow(
      makeBrief({ travellerCount: 2, budgetTotalMinor: rupees(80_000) }),
    );
    const six = await planOrThrow(
      makeBrief({ travellerCount: 6, budgetTotalMinor: rupees(80_000) }),
    );
    expect(six.budget.totalEstimatedMinor).toBeGreaterThan(two.budget.totalEstimatedMinor);
  });
});

describe('budget extremes', () => {
  it('refuses an impossible budget with a typed failure, not a broken plan', async () => {
    // The critical negative case: silently returning something unaffordable
    // would be far worse than saying no.
    const result = await plan(makeBrief({ budgetTotalMinor: rupees(500) }));
    expect(result.ok).toBe(false);
    if (isFailure(result)) {
      expect(result.code).toBe('BUDGET_UNREACHABLE');
      expect(result.message).toMatch(/over the stated budget/);
    }
  });

  it('never reports success while over budget', async () => {
    // Swept across a range that straddles feasibility.
    for (const amount of [5_000, 15_000, 25_000, 35_000, 45_000, 80_000]) {
      const result = await plan(makeBrief({ budgetTotalMinor: rupees(amount) }));
      if (result.ok) {
        expect(
          result.plan.budget.totalEstimatedMinor,
          `budget ₹${amount} reported ok but is over`,
        ).toBeLessThanOrEqual(rupees(amount));
      }
    }
  });

  it('uses a generous budget without wasting it, and flags the surplus', async () => {
    const planned = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(200_000) }));
    assertPlanInvariants(planned);
    expect(planned.budget.status).toBe('UNDER');
    expect(planned.validation.violations.some((v) => v.code === 'BUDGET_UNDERUSED')).toBe(true);
  });

  it('picks better options when the budget allows', async () => {
    const tight = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(40_000) }));
    const generous = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(200_000) }));
    expect(generous.budget.totalEstimatedMinor).toBeGreaterThan(tight.budget.totalEstimatedMinor);
  });
});

describe('impossible constraints', () => {
  it('refuses when the waking window leaves no usable day', async () => {
    const result = await plan(makeBrief({ wakeTime: '11:00', sleepTime: '12:00' }));
    expect(result.ok).toBe(false);
    if (isFailure(result)) {
      expect(['INFEASIBLE_CONSTRAINTS', 'BUDGET_UNREACHABLE']).toContain(result.code);
    }
  });

  it('refuses a single-day trip that is entirely consumed by travel', async () => {
    const result = await plan(makeBrief({ startDate: '2026-10-12', endDate: '2026-10-12' }));
    expect(result.ok).toBe(false);
    // Day trips are out of MVP scope: with no night booked there is no
    // accommodation to plan around, which surfaces as NO_CANDIDATES rather
    // than an exception escaping from a provider.
    if (isFailure(result)) {
      expect(['NO_CANDIDATES', 'INFEASIBLE_CONSTRAINTS']).toContain(result.code);
    }
  });

  it('refuses when no transport is available at all', async () => {
    const brief = makeBrief();
    const candidates = await candidatesFor(brief);
    const stripped: SourcedCandidates = {
      ...candidates,
      outboundTransport: [],
      returnTransport: [],
    };
    const result = planTrip(brief, stripped, OPTIONS);
    expect(result.ok).toBe(false);
    if (isFailure(result)) expect(result.code).toBe('NO_CANDIDATES');
  });

  it('refuses when there is nowhere to stay', async () => {
    const brief = makeBrief();
    const candidates = await candidatesFor(brief);
    const result = planTrip(brief, { ...candidates, lodging: [] }, OPTIONS);
    expect(result.ok).toBe(false);
    if (isFailure(result)) expect(result.code).toBe('NO_CANDIDATES');
  });

  it('honours avoid-overnight even when it removes the cheapest service', async () => {
    const planned = await planOrThrow(
      makeBrief({ avoidOvernightTransport: true, budgetTotalMinor: rupees(70_000) }),
    );
    expect(planned.selections.outbound.isOvernight).toBe(false);
    expect(planned.selections.inbound.isOvernight).toBe(false);
  });

  it('excludes strenuous places for a traveller who cannot walk far', async () => {
    // Accessibility is a hard exclusion, not a ranking penalty.
    const planned = await planOrThrow(
      makeBrief({
        budgetTotalMinor: rupees(90_000),
        travellerCount: 2,
        travellers: [
          { ageBand: 'ADULT', accessibilityNeeds: ['LIMITED_WALKING'] },
          { ageBand: 'ADULT' },
        ],
      }),
    );

    const scheduledIds = new Set(
      planned.days.flatMap((d) => d.items.map((i) => i.poiId).filter(Boolean)),
    );
    // Jogini Falls and the Beas Kund trail are tagged trekking/steep.
    expect(scheduledIds.has('poi-jogini-falls')).toBe(false);
    expect(scheduledIds.has('poi-beas-kund-trail')).toBe(false);
  });
});

describe('sparse and degenerate POI sets', () => {
  it('handles fewer POIs than days without inventing filler', async () => {
    const brief = makeBrief({ budgetTotalMinor: rupees(90_000) });
    const candidates = await candidatesFor(brief);
    const two = candidates.pois.filter((p) => p.id === 'poi-hadimba' || p.id === 'poi-mall-road');
    const eateries = candidates.pois.filter(
      (p) => p.category === 'CAFE' || p.category === 'RESTAURANT',
    );

    const result = planTrip(brief, { ...candidates, pois: [...two, ...eateries] }, OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      assertPlanInvariants(result.plan);
      expect(result.plan.clusterStrategy).toBe('ONE_PER_DAY');
    }
  });

  it('handles POIs all clustered in one small area', async () => {
    const brief = makeBrief({ budgetTotalMinor: rupees(90_000) });
    const candidates = await candidatesFor(brief);
    // Collapse every POI to within a few hundred metres of each other.
    const tight = candidates.pois.map((poi, i) => ({
      ...poi,
      geo: { lat: 32.2432 + i * 0.0005, lng: 77.1892 + i * 0.0005 },
    }));
    const result = planTrip(brief, { ...candidates, pois: tight }, OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) assertPlanInvariants(result.plan);
  });

  it('handles POIs spread far apart without an impossible schedule', async () => {
    const brief = makeBrief({ budgetTotalMinor: rupees(120_000) });
    const candidates = await candidatesFor(brief);
    const spread = candidates.pois.map((poi, i) => ({
      ...poi,
      geo: { lat: 32.1 + i * 0.04, lng: 77.1 + i * 0.03 },
    }));
    const result = planTrip(brief, { ...candidates, pois: spread }, OPTIONS);
    // Either a valid plan, or an honest refusal — never a plan with an
    // impossible hop in it.
    if (result.ok) assertPlanInvariants(result.plan);
    else expect(result.code).toBe('INFEASIBLE_CONSTRAINTS');
  });

  it('does not schedule a duplicate POI twice', async () => {
    const brief = makeBrief({ budgetTotalMinor: rupees(90_000) });
    const candidates = await candidatesFor(brief);
    const duplicated = [...candidates.pois, ...candidates.pois.slice(0, 5)];

    const result = planTrip(brief, { ...candidates, pois: duplicated }, OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const sightIds = result.plan.days
        .flatMap((d) => d.items)
        .filter((i) => i.category === 'SIGHT' || i.category === 'ACTIVITY')
        .map((i) => i.poiId)
        .filter((id): id is string => Boolean(id));
      expect(new Set(sightIds).size).toBe(sightIds.length);
    }
  });

  it('produces transport- and meal-only days when there are no sights', async () => {
    const brief = makeBrief({ budgetTotalMinor: rupees(90_000) });
    const candidates = await candidatesFor(brief);
    const eateriesOnly = candidates.pois.filter(
      (p) => p.category === 'CAFE' || p.category === 'RESTAURANT',
    );
    const result = planTrip(brief, { ...candidates, pois: eateriesOnly }, OPTIONS);
    // A trip with nothing to see is a poor trip, not an invalid one.
    expect(result.ok).toBe(true);
    if (result.ok) {
      assertPlanInvariants(result.plan);
      expect(result.plan.clusterStrategy).toBe('EMPTY');
    }
  });

  it('handles a POI whose opening hours are unknown by not scheduling it', async () => {
    const brief = makeBrief({ budgetTotalMinor: rupees(90_000) });
    const candidates = await candidatesFor(brief);
    const withUnknown = candidates.pois.map((poi) =>
      poi.id === 'poi-hadimba' ? { ...poi, openingHours: { kind: 'unknown' as const } } : poi,
    );
    const result = planTrip(brief, { ...candidates, pois: withUnknown }, OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const scheduled = result.plan.days.flatMap((d) => d.items.map((i) => i.poiId));
      // Conservative by design: unknown hours are never assumed open.
      expect(scheduled).not.toContain('poi-hadimba');
    }
  });

  it('handles an attraction closed on every day of the trip', async () => {
    const brief = makeBrief({ budgetTotalMinor: rupees(90_000) });
    const candidates = await candidatesFor(brief);
    const alwaysClosed = candidates.pois.map((poi) =>
      poi.id === 'poi-hadimba'
        ? {
            ...poi,
            openingHours: {
              kind: 'weekly' as const,
              intervals: [{ weekday: 0, opens: '09:00', closes: '10:00' }],
              closedWeekdays: [1, 2, 3, 4, 5, 6],
            },
          }
        : poi,
    );
    const result = planTrip(brief, { ...candidates, pois: alwaysClosed }, OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      assertPlanInvariants(result.plan);
      // It must be reported as unplaced, not quietly forgotten.
      const scheduled = result.plan.days.flatMap((d) => d.items.map((i) => i.poiId));
      if (!scheduled.includes('poi-hadimba')) {
        expect(result.plan.unplaced.some((u) => u.poiId === 'poi-hadimba')).toBe(true);
      }
    }
  });

  it('handles free activities without dividing by zero', async () => {
    const brief = makeBrief({ budgetTotalMinor: rupees(90_000) });
    const candidates = await candidatesFor(brief);
    const free = candidates.pois.map((poi) => ({ ...poi, typicalCostPerPersonMinor: 0 }));
    const result = planTrip(brief, { ...candidates, pois: free }, OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      assertPlanInvariants(result.plan);
      expect(
        result.plan.budget.lines.find((l) => l.category === 'ACTIVITIES')!.estimatedMinor,
      ).toBe(0);
    }
  });
});

describe('pace', () => {
  it('schedules fewer activities per day at a relaxed pace', async () => {
    const relaxed = await planOrThrow(
      makeBrief({ pace: 'RELAXED', budgetTotalMinor: rupees(120_000) }),
    );
    const packed = await planOrThrow(
      makeBrief({ pace: 'PACKED', budgetTotalMinor: rupees(120_000) }),
    );

    const countActivities = (p: typeof relaxed) =>
      Math.max(
        ...p.days.map(
          (d) =>
            d.items.filter(
              (i) =>
                i.category === 'SIGHT' || i.category === 'ACTIVITY' || i.category === 'SHOPPING',
            ).length,
        ),
      );

    expect(countActivities(relaxed)).toBeLessThanOrEqual(countActivities(packed));
  });

  it('respects a late wake time', async () => {
    const planned = await planOrThrow(
      makeBrief({ wakeTime: '10:00', budgetTotalMinor: rupees(90_000) }),
    );
    for (const day of planned.days) {
      for (const item of day.items) {
        if (item.category === 'TRANSPORT') continue;
        expect(item.startTime >= '10:00', `${item.title} at ${item.startTime}`).toBe(true);
      }
    }
  });
});

describe('determinism under variation', () => {
  it('produces identical plans for identical briefs across many scenarios', async () => {
    const briefs = [
      makeBrief(),
      makeBrief({ travellerCount: 1, budgetTotalMinor: rupees(20_000) }),
      makeBrief({ pace: 'PACKED', budgetTotalMinor: rupees(90_000) }),
      makeBrief({ wakeTime: '09:30', budgetTotalMinor: rupees(60_000) }),
    ];
    for (const brief of briefs) {
      const a = await plan(brief);
      const b = await plan(brief);
      expect(a.ok).toBe(b.ok);
      if (a.ok && b.ok) {
        // Compare the DECISIONS, not the wall-clock stage timings, which
        // legitimately differ run to run.
        expect(planFingerprint(a.plan)).toBe(planFingerprint(b.plan));
        expect(JSON.stringify({ ...a.plan, timings: null })).toBe(
          JSON.stringify({ ...b.plan, timings: null }),
        );
      }
    }
  });
});
