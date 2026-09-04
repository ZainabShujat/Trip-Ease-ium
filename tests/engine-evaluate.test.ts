import { describe, expect, it } from 'vitest';
import { evaluatePlan, planFingerprint, summariseRouteImprovement } from '@/engine/evaluate';
import { weakestSourceKind } from '@/engine/orchestrator';
import { rupees } from '@/lib/money';
import { makeBrief, planOrThrow } from './helpers/plan';

/**
 * Evaluation hooks.
 *
 * These are the numbers the project's evaluation chapter reports, so they need
 * to be correct and stable rather than merely present.
 */

describe('provenance aggregation', () => {
  it('takes the weakest source across all inputs', () => {
    // A plan touching any mock data is a mock plan, however good the rest is.
    expect(weakestSourceKind(['live', 'live', 'mock'])).toBe('mock');
    expect(weakestSourceKind(['live', 'estimated'])).toBe('estimated');
    expect(weakestSourceKind(['live', 'cached'])).toBe('cached');
    expect(weakestSourceKind(['live', 'live'])).toBe('live');
  });

  it('defaults to live for an empty set rather than claiming mock', () => {
    expect(weakestSourceKind([])).toBe('live');
  });
});

describe('route improvement summary', () => {
  it('aggregates savings across days', () => {
    const summary = summariseRouteImprovement([
      { seedMins: 100, optimisedMins: 80 },
      { seedMins: 60, optimisedMins: 60 },
    ]);
    expect(summary.seedMins).toBe(160);
    expect(summary.optimisedMins).toBe(140);
    expect(summary.savedMins).toBe(20);
    expect(summary.improvementRatio).toBeCloseTo(0.125);
  });

  it('never reports a negative saving', () => {
    const summary = summariseRouteImprovement([{ seedMins: 50, optimisedMins: 60 }]);
    expect(summary.savedMins).toBe(0);
  });

  it('handles an empty set without dividing by zero', () => {
    const summary = summariseRouteImprovement([]);
    expect(summary.improvementRatio).toBe(0);
  });
});

describe('plan metrics', () => {
  it('computes every metric in range for a real plan', async () => {
    const planned = await planOrThrow(
      makeBrief({ interests: ['NATURE', 'CAFES'], budgetTotalMinor: rupees(60_000) }),
    );
    const metrics = evaluatePlan(planned);

    expect(metrics.budgetAdherence).toBeGreaterThan(0);
    expect(metrics.budgetAdherence).toBeLessThanOrEqual(1);
    expect(metrics.budgetRemainingMinor).toBe(planned.budget.remainingMinor);
    expect(metrics.hardViolations).toBe(0);
    expect(metrics.travelTimeRatio).toBeGreaterThanOrEqual(0);
    expect(metrics.travelTimeRatio).toBeLessThan(1);
    expect(metrics.poiUtilisation).toBeGreaterThan(0);
    expect(metrics.poiUtilisation).toBeLessThanOrEqual(1);
    expect(metrics.activityCount).toBeGreaterThan(0);
    expect(metrics.planningLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('reports full preference satisfaction when no interests were stated', async () => {
    // Nothing was asked for, so nothing is unmet. Reporting 0 would be a
    // misleading denominator.
    const planned = await planOrThrow(
      makeBrief({ interests: [], budgetTotalMinor: rupees(60_000) }),
    );
    expect(evaluatePlan(planned).preferenceSatisfaction).toBe(1);
  });

  it('derives travel minutes from the itinerary, not from a stored total', async () => {
    const planned = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(60_000) }));
    const metrics = evaluatePlan(planned);
    const recomputed = planned.days
      .flatMap((d) => d.items)
      .reduce((s, i) => s + (i.travelFromPrev?.durationMins ?? 0), 0);
    expect(metrics.totalTravelMins).toBe(recomputed);
  });

  it('is stable across repeated evaluation', async () => {
    const planned = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(60_000) }));
    expect(JSON.stringify(evaluatePlan(planned))).toBe(JSON.stringify(evaluatePlan(planned)));
  });
});

describe('plan fingerprint', () => {
  it('is identical for identical plans', async () => {
    const brief = makeBrief({ budgetTotalMinor: rupees(60_000) });
    expect(planFingerprint(await planOrThrow(brief))).toBe(
      planFingerprint(await planOrThrow(brief)),
    );
  });

  it('differs when a decision differs', async () => {
    const a = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(40_000) }));
    const b = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(200_000) }));
    expect(planFingerprint(a)).not.toBe(planFingerprint(b));
  });

  it('ignores wall-clock timings', async () => {
    // Timings legitimately vary; decisions must not. This is what makes the
    // fingerprint usable as a reproducibility check.
    const brief = makeBrief({ budgetTotalMinor: rupees(60_000) });
    const planned = await planOrThrow(brief);
    const withOtherTimings = { ...planned, timings: { SCORE: 999, SCHEDULE: 12345 } };
    expect(planFingerprint(withOtherTimings)).toBe(planFingerprint(planned));
  });

  it('captures the itinerary, not just the headline choices', async () => {
    const planned = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(60_000) }));
    const fingerprint = planFingerprint(planned);
    for (const day of planned.days) {
      expect(fingerprint).toContain(day.date);
    }
  });
});

describe('stage timings', () => {
  it('records a timing for every stage that ran', async () => {
    const planned = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(60_000) }));
    for (const stage of ['SCORE', 'CLUSTER', 'SCHEDULE', 'BUDGET', 'VALIDATE'] as const) {
      expect(planned.timings[stage], `${stage} timing`).toBeGreaterThanOrEqual(0);
    }
  });

  it('sums to the reported latency', async () => {
    const planned = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(60_000) }));
    const sum = Object.values(planned.timings).reduce<number>((s, ms) => s + (ms ?? 0), 0);
    expect(evaluatePlan(planned).planningLatencyMs).toBe(sum);
  });
});
