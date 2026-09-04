import { expect } from 'vitest';
import type { PlannedTrip } from '@/engine/types';
import { toMinutes, type TripBrief } from '@/lib/schemas';
import { TripBriefSchema } from '@/lib/schemas';
import { rupees } from '@/lib/money';
import { planTripFromBrief } from '@/planning';
import { gatherCandidates } from '@/planning/gather';
import { createMockProviders } from '@/providers/mock';

/**
 * Shared helpers for the plan-level suites.
 *
 * `assertPlanInvariants` is the important one: a single place holding the
 * properties every plan must satisfy, applied to every fixture and every edge
 * case. Adding a scenario therefore gets the whole invariant set for free,
 * and a new invariant applies retroactively to every scenario.
 */

export function makeBrief(overrides: Record<string, unknown> = {}): TripBrief {
  return TripBriefSchema.parse({
    origin: { name: 'Delhi', geo: { lat: 28.6139, lng: 77.209 } },
    destination: { name: 'Manali', geo: { lat: 32.2432, lng: 77.1892 } },
    startDate: '2026-10-12',
    endDate: '2026-10-17',
    travellerCount: 4,
    budgetTotalMinor: rupees(40_000),
    ...overrides,
  });
}

export async function plan(brief: TripBrief) {
  return planTripFromBrief(brief);
}

/** Plan, and fail the test with the engine's reason if it did not succeed. */
export async function planOrThrow(brief: TripBrief): Promise<PlannedTrip> {
  const result = await plan(brief);
  if (!result.ok) {
    throw new Error(`planning failed: ${result.code} — ${result.message}`);
  }
  return result.plan;
}

export async function candidatesFor(brief: TripBrief) {
  return gatherCandidates(brief, createMockProviders());
}

/**
 * Every property a returned plan must satisfy, regardless of scenario.
 *
 * These are the assertions that make the engine trustworthy: they are checked
 * against the persisted itinerary, independently of whatever the scheduler
 * believed it was doing.
 */
export function assertPlanInvariants(planned: PlannedTrip): void {
  // Travel assertions read the values persisted on each item, so this checks
  // what was actually written rather than re-deriving it from the matrix the
  // scheduler used — a checker sharing its subject's inputs checks nothing.
  const { brief, days, budget, validation } = planned;

  // --- the gate -------------------------------------------------------------
  expect(validation.hardCount, 'a returned plan must have no hard violations').toBe(0);

  // --- budget ---------------------------------------------------------------
  const lineSum = budget.lines.reduce((s, l) => s + l.estimatedMinor, 0);
  expect(budget.totalEstimatedMinor, 'total must equal the sum of category lines').toBe(lineSum);
  expect(budget.totalEstimatedMinor).toBeLessThanOrEqual(budget.totalBudgetMinor);
  expect(budget.remainingMinor).toBe(budget.totalBudgetMinor - budget.totalEstimatedMinor);
  expect(Number.isInteger(budget.totalEstimatedMinor)).toBe(true);

  const wake = toMinutes(brief.wakeTime);
  const sleep = toMinutes(brief.sleepTime);

  for (const day of days) {
    const items = [...day.items].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

    // Day totals are derived, never asserted from storage alone.
    expect(day.totalCostMinor, `day ${day.dayIndex} cost`).toBe(
      items.reduce((s, i) => s + i.estimatedCostMinor, 0),
    );

    let previousEnd: number | null = null;
    let previousTitle = '';

    for (const item of items) {
      const start = toMinutes(item.startTime);
      const end = toMinutes(item.endTime);

      // startTime < endTime, and the duration agrees with them.
      expect(start, `${item.title} start<end`).toBeLessThan(end);
      expect(end - start, `${item.title} duration`).toBe(item.durationMins);

      // Within the waking window, transport excepted.
      if (item.category !== 'TRANSPORT') {
        expect(start, `${item.title} after wake`).toBeGreaterThanOrEqual(wake);
        expect(end, `${item.title} before sleep`).toBeLessThanOrEqual(sleep);
      }

      // nextStart >= previousEnd + travelTime
      if (previousEnd !== null) {
        expect(start, `"${item.title}" overlaps "${previousTitle}"`).toBeGreaterThanOrEqual(
          previousEnd,
        );
        const travel = item.travelFromPrev?.durationMins ?? 0;
        expect(
          start - previousEnd,
          `not enough time to travel from "${previousTitle}" to "${item.title}"`,
        ).toBeGreaterThanOrEqual(travel);
      }

      expect(item.estimatedCostMinor).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(item.estimatedCostMinor)).toBe(true);

      previousEnd = end;
      previousTitle = item.title;
    }
  }
}
