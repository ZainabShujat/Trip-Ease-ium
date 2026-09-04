import { describe, expect, it } from 'vitest';
import {
  allocateEnvelopes,
  localTransportCostMinor,
  reduceToBudget,
  runBudgetStage,
  statusFor,
  transportCostMinor,
} from '@/engine/budget';
import { BUDGET_ALLOCATION } from '@/engine/config';
import type { Selections } from '@/engine/types';
import { rupees } from '@/lib/money';
import {
  TripBriefSchema,
  type ItineraryDay,
  type LodgingOption,
  type TransportOption,
  type TripBrief,
} from '@/lib/schemas';

/**
 * The budget engine.
 *
 * The properties that matter are arithmetic ones, and they are asserted as
 * invariants rather than against hand-copied expected numbers: the total
 * equals the sum of its lines, substitution genuinely reduces cost, and the
 * optimiser never reports a total it did not derive from the plan.
 */

const PROV = {
  sourceKind: 'mock' as const,
  provider: 'test',
  fetchedAt: '2026-01-01T00:00:00+05:30',
  confidence: 'medium' as const,
};

function transport(id: string, priceMinor: number, score = 0.5): TransportOption {
  return {
    id,
    direction: 'OUTBOUND',
    mode: 'BUS',
    operator: id,
    fromName: 'Delhi',
    toName: 'Manali',
    durationMins: 780,
    pricePerPersonMinor: priceMinor,
    comfortTier: 'STANDARD',
    isOvernight: true,
    link: null,
    score,
    provenance: PROV,
  };
}

function lodging(id: string, totalMinor: number, score = 0.5): LodgingOption {
  return {
    id,
    name: id,
    geo: { lat: 32.25, lng: 77.18 },
    nightlyRateMinor: Math.round(totalMinor / 5),
    totalRateMinor: totalMinor,
    roomsRequired: 1,
    tier: 'MID',
    amenities: [],
    checkInTime: '14:00',
    checkOutTime: '11:00',
    link: null,
    score,
    provenance: PROV,
  };
}

function brief(budgetMinor: number, travellers = 2): TripBrief {
  return TripBriefSchema.parse({
    origin: { name: 'Delhi' },
    destination: { name: 'Manali' },
    startDate: '2026-10-12',
    endDate: '2026-10-17',
    travellerCount: travellers,
    budgetTotalMinor: budgetMinor,
  });
}

function selections(over: Partial<Selections> = {}): Selections {
  return {
    outbound: transport('out-mid', rupees(1500), 0.7),
    inbound: transport('in-mid', rupees(1500), 0.7),
    local: [],
    lodging: lodging('lodge-mid', rupees(15_000), 0.7),
    shortlist: [],
    scored: [],
    alternatives: { transport: [], lodging: [] },
    ...over,
  };
}

function dayWith(items: Array<{ id: string; cost: number; category: string }>): ItineraryDay {
  return {
    id: 'day-0',
    dayIndex: 0,
    date: '2026-10-13',
    items: items.map((i, seq) => ({
      id: i.id,
      seq,
      title: i.id,
      category: i.category as ItineraryDay['items'][number]['category'],
      startTime: `${String(9 + seq).padStart(2, '0')}:00`,
      endTime: `${String(10 + seq).padStart(2, '0')}:00`,
      durationMins: 60,
      estimatedCostMinor: i.cost,
      travelFromPrev: null,
      link: null,
      bookingStatus: 'NOT_REQUIRED',
      isLocked: false,
    })),
    totalCostMinor: items.reduce((s, i) => s + i.cost, 0),
    totalTravelMins: 0,
  };
}

describe('envelope allocation', () => {
  it('allocates every category and never more than the budget', () => {
    const envelopes = allocateEnvelopes(rupees(40_000));
    const total = [...envelopes.values()].reduce((s, v) => s + v, 0);
    expect(total).toBeLessThanOrEqual(rupees(40_000));
    expect(envelopes.size).toBe(6);
  });

  it('matches the documented allocation shares', () => {
    const envelopes = allocateEnvelopes(rupees(100_000));
    expect(envelopes.get('ACCOMMODATION')).toBe(
      Math.floor(rupees(100_000) * BUDGET_ALLOCATION.ACCOMMODATION),
    );
  });

  it('produces integers only', () => {
    for (const value of allocateEnvelopes(rupees(33_333)).values()) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe('ledger arithmetic', () => {
  it('total is exactly the sum of the category lines', () => {
    // The single most important budget invariant: there is no independent
    // running total that could disagree with what is displayed per category.
    const summary = runBudgetStage(brief(rupees(40_000)), selections(), [
      dayWith([
        { id: 'a', cost: rupees(500), category: 'SIGHT' },
        { id: 'b', cost: rupees(300), category: 'MEAL' },
      ]),
    ]);
    const lineSum = summary.lines.reduce((s, l) => s + l.estimatedMinor, 0);
    expect(summary.totalEstimatedMinor).toBe(lineSum);
  });

  it('remaining is exactly budget minus estimated', () => {
    const summary = runBudgetStage(brief(rupees(40_000)), selections(), [
      dayWith([{ id: 'a', cost: rupees(500), category: 'SIGHT' }]),
    ]);
    expect(summary.remainingMinor).toBe(summary.totalBudgetMinor - summary.totalEstimatedMinor);
  });

  it('every figure is an integer', () => {
    const summary = runBudgetStage(brief(rupees(37_777), 3), selections(), [
      dayWith([{ id: 'a', cost: rupees(333), category: 'SIGHT' }]),
    ]);
    expect(Number.isInteger(summary.totalEstimatedMinor)).toBe(true);
    expect(Number.isInteger(summary.remainingMinor)).toBe(true);
    for (const line of summary.lines) {
      expect(Number.isInteger(line.estimatedMinor), line.category).toBe(true);
    }
  });

  it('goes negative rather than clamping when over budget', () => {
    // Clamping at zero would hide the overage from the dashboard.
    const summary = runBudgetStage(brief(rupees(1_000)), selections(), []);
    expect(summary.remainingMinor).toBeLessThan(0);
    expect(summary.status).toBe('EXCEEDED');
  });

  it('is deterministic', () => {
    const days = [dayWith([{ id: 'a', cost: rupees(500), category: 'SIGHT' }])];
    const a = runBudgetStage(brief(rupees(40_000)), selections(), days);
    const b = runBudgetStage(brief(rupees(40_000)), selections(), days);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('scales transport cost by the party size', () => {
    expect(transportCostMinor(transport('a', rupees(1000)), transport('b', rupees(800)), 4)).toBe(
      rupees(7200),
    );
  });

  it('charges local transport at the cheapest paid mode, per person per day', () => {
    const modes = [
      { ...transport('walk', rupees(0)), mode: 'WALK' as const },
      { ...transport('taxi', rupees(700)), mode: 'TAXI' as const },
      { ...transport('bus', rupees(80)), mode: 'BUS' as const },
    ];
    // Cheapest paid mode is 80; free modes are ignored rather than making the
    // whole category zero.
    expect(localTransportCostMinor(modes, 4, 5)).toBe(rupees(80) * 4 * 5);
  });

  it('charges nothing for local transport when every mode is free', () => {
    const modes = [{ ...transport('walk', rupees(0)), mode: 'WALK' as const }];
    expect(localTransportCostMinor(modes, 4, 5)).toBe(0);
  });
});

describe('budget status', () => {
  it('classifies each band', () => {
    expect(statusFor(rupees(20_000), rupees(40_000))).toBe('UNDER');
    expect(statusFor(rupees(34_000), rupees(40_000))).toBe('ON_TRACK');
    expect(statusFor(rupees(39_000), rupees(40_000))).toBe('NEARLY_EXHAUSTED');
    expect(statusFor(rupees(41_000), rupees(40_000))).toBe('EXCEEDED');
  });

  it('treats exactly on budget as not exceeded', () => {
    expect(statusFor(rupees(40_000), rupees(40_000))).toBe('NEARLY_EXHAUSTED');
  });

  it('does not divide by a zero budget', () => {
    expect(statusFor(0, 0)).toBe('ON_TRACK');
    expect(statusFor(rupees(1), 0)).toBe('EXCEEDED');
  });
});

describe('reduceToBudget', () => {
  const pool = {
    outbound: [transport('out-cheap', rupees(600), 0.4), transport('out-mid', rupees(1500), 0.7)],
    inbound: [transport('in-cheap', rupees(600), 0.4), transport('in-mid', rupees(1500), 0.7)],
    lodging: [
      lodging('lodge-cheap', rupees(6_000), 0.4),
      lodging('lodge-mid', rupees(15_000), 0.7),
    ],
  };

  it('reports a total it actually derived from the resulting plan', () => {
    // The guard against an optimiser that claims a total by subtracting its
    // own estimated savings instead of recomputing.
    const b = brief(rupees(20_000));
    const days = [dayWith([{ id: 'a', cost: rupees(2_000), category: 'ACTIVITY' }])];
    const result = reduceToBudget(b, selections(), days, b.budgetTotalMinor, pool);
    const recomputed = runBudgetStage(b, result.selections, result.days).totalEstimatedMinor;
    expect(result.totalEstimatedMinor).toBe(recomputed);
  });

  it('never claims success while still over target', () => {
    const b = brief(rupees(5_000));
    const result = reduceToBudget(b, selections(), [], b.budgetTotalMinor, pool);
    if (result.ok) expect(result.totalEstimatedMinor).toBeLessThanOrEqual(b.budgetTotalMinor);
    else expect(result.totalEstimatedMinor).toBeGreaterThan(b.budgetTotalMinor);
  });

  it('every applied substitution genuinely reduces the total', () => {
    const b = brief(rupees(18_000));
    const days = [dayWith([{ id: 'a', cost: rupees(1_500), category: 'ACTIVITY' }])];
    const before = runBudgetStage(b, selections(), days).totalEstimatedMinor;
    const result = reduceToBudget(b, selections(), days, b.budgetTotalMinor, pool);

    expect(result.applied.length).toBeGreaterThan(0);
    for (const sub of result.applied) expect(sub.savingMinor).toBeGreaterThan(0);
    expect(result.totalEstimatedMinor).toBeLessThan(before);
  });

  it('only ever substitutes options from the supplied pool', () => {
    // Nothing may be invented to hit a number.
    const b = brief(rupees(15_000));
    const result = reduceToBudget(b, selections(), [], b.budgetTotalMinor, pool);
    expect(pool.outbound.map((o) => o.id)).toContain(result.selections.outbound.id);
    expect(pool.lodging.map((l) => l.id)).toContain(result.selections.lodging.id);
  });

  it('does nothing when the plan is already within budget', () => {
    const b = brief(rupees(90_000));
    const result = reduceToBudget(b, selections(), [], b.budgetTotalMinor, pool);
    expect(result.ok).toBe(true);
    expect(result.applied).toHaveLength(0);
    expect(result.selections.lodging.id).toBe('lodge-mid');
  });

  it('returns a typed failure for an impossible budget', () => {
    const b = brief(rupees(100));
    const result = reduceToBudget(b, selections(), [], b.budgetTotalMinor, pool);
    expect(result.ok).toBe(false);
    expect(result.shortfallMinor).toBeGreaterThan(0);
    // Even in failure it must report the true cost, not the target.
    expect(result.totalEstimatedMinor).toBeGreaterThan(b.budgetTotalMinor);
  });

  it('prefers a cheaper like-for-like swap over dropping an activity', () => {
    // Dropping something the traveller wanted is a bigger loss than a
    // downgrade, and the efficiency ranking should reflect that.
    const b = brief(rupees(22_000));
    const days = [dayWith([{ id: 'sight', cost: rupees(800), category: 'ACTIVITY' }])];
    const result = reduceToBudget(b, selections(), days, b.budgetTotalMinor, pool);
    const kinds = result.applied.map((s) => s.kind);
    if (kinds.includes('DROP_ACTIVITY')) {
      expect(kinds.indexOf('DROP_ACTIVITY')).toBeGreaterThan(0);
    }
    expect(result.ok).toBe(true);
  });

  it('is deterministic', () => {
    const b = brief(rupees(18_000));
    const days = [dayWith([{ id: 'a', cost: rupees(1_500), category: 'ACTIVITY' }])];
    const a1 = reduceToBudget(b, selections(), days, b.budgetTotalMinor, pool);
    const a2 = reduceToBudget(b, selections(), days, b.budgetTotalMinor, pool);
    expect(a1.applied.map((s) => s.description)).toEqual(a2.applied.map((s) => s.description));
    expect(a1.totalEstimatedMinor).toBe(a2.totalEstimatedMinor);
  });

  it('terminates rather than looping on an unreachable target', () => {
    const b = brief(rupees(1));
    const started = Date.now();
    const result = reduceToBudget(b, selections(), [], b.budgetTotalMinor, pool);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(result.ok).toBe(false);
  });
});
