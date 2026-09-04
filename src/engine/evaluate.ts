import { toMinutes } from '@/lib/schemas';
import type { PlannedTrip } from './types';

/**
 * Evaluation hooks.
 *
 * Small, dependency-free functions that turn a plan into the numbers the
 * project's evaluation chapter reports. Deliberately not a dashboard: these
 * are the measurements, and how they are presented is a later concern.
 *
 * Every metric is computed from the finished plan rather than instrumented
 * into the stages, so the engine stays free of measurement code and a metric
 * can be added later without touching the algorithms.
 */

export interface PlanMetrics {
  /** Estimated cost as a fraction of budget. 1.0 is exactly on budget;
   *  above 1.0 means over. */
  budgetAdherence: number;
  budgetRemainingMinor: number;

  /** Minutes of travel per scheduled activity. Lower is more efficient. */
  travelMinsPerActivity: number;
  totalTravelMins: number;
  totalScheduledMins: number;
  /** Share of scheduled time spent travelling rather than doing things. */
  travelTimeRatio: number;

  hardViolations: number;
  softViolations: number;
  relaxedConstraintCount: number;

  /** Fraction of the traveller's stated interests represented in the plan. */
  preferenceSatisfaction: number;
  /** Shortlisted POIs that made it onto the itinerary. */
  poiUtilisation: number;
  unplacedCount: number;

  activityCount: number;
  activityDays: number;
  /** Total engine wall-clock across all stages, in milliseconds. */
  planningLatencyMs: number;
}

export function evaluatePlan(plan: PlannedTrip): PlanMetrics {
  const { brief, days, budget, validation } = plan;

  const allItems = days.flatMap((d) => d.items);
  const activities = allItems.filter(
    (i) => i.category === 'SIGHT' || i.category === 'ACTIVITY' || i.category === 'SHOPPING',
  );

  const totalTravelMins = allItems.reduce(
    (sum, item) => sum + (item.travelFromPrev?.durationMins ?? 0),
    0,
  );
  const totalScheduledMins = allItems.reduce(
    (sum, item) => sum + (toMinutes(item.endTime) - toMinutes(item.startTime)),
    0,
  );

  // Interests represented among scheduled POIs.
  const scheduledPoiIds = new Set(
    allItems.map((i) => i.poiId).filter((id): id is string => Boolean(id)),
  );
  const scheduledTags = new Set(
    plan.selections.shortlist
      .filter((p) => scheduledPoiIds.has(p.id))
      .flatMap((p) => p.tags.map((t) => t.toLowerCase())),
  );
  const servedInterests = brief.interests.filter((interest) =>
    [...scheduledTags].some((tag) => tag.includes(interest.toLowerCase())),
  );

  const shortlistSize = plan.selections.shortlist.length;
  const latency = Object.values(plan.timings).reduce<number>((sum, ms) => sum + (ms ?? 0), 0);

  return {
    budgetAdherence:
      budget.totalBudgetMinor > 0 ? budget.totalEstimatedMinor / budget.totalBudgetMinor : 0,
    budgetRemainingMinor: budget.remainingMinor,

    travelMinsPerActivity: activities.length > 0 ? totalTravelMins / activities.length : 0,
    totalTravelMins,
    totalScheduledMins,
    travelTimeRatio:
      totalScheduledMins + totalTravelMins > 0
        ? totalTravelMins / (totalScheduledMins + totalTravelMins)
        : 0,

    hardViolations: validation.hardCount,
    softViolations: validation.softCount,
    relaxedConstraintCount: plan.relaxedConstraints.length,

    preferenceSatisfaction:
      brief.interests.length > 0 ? servedInterests.length / brief.interests.length : 1,
    poiUtilisation: shortlistSize > 0 ? scheduledPoiIds.size / shortlistSize : 0,
    unplacedCount: plan.unplaced.length,

    activityCount: activities.length,
    activityDays: days.filter((d) => d.items.length > 0).length,
    planningLatencyMs: latency,
  };
}

/**
 * Stable digest of a plan's decisions, for reproducibility testing.
 *
 * Deliberately excludes timings and ids — those vary legitimately between
 * runs. What must not vary is *what was decided*: which options, in what
 * order, at what times, for what money.
 */
export function planFingerprint(plan: PlannedTrip): string {
  const parts: string[] = [
    `outbound=${plan.selections.outbound.providerRef ?? plan.selections.outbound.id}`,
    `inbound=${plan.selections.inbound.providerRef ?? plan.selections.inbound.id}`,
    `lodging=${plan.selections.lodging.id}`,
    `total=${plan.budget.totalEstimatedMinor}`,
    `strategy=${plan.clusterStrategy}`,
    `relaxed=[${[...plan.relaxedConstraints].sort().join(',')}]`,
  ];

  for (const day of plan.days) {
    const items = day.items
      .map((i) => `${i.startTime}-${i.endTime}:${i.poiId ?? i.category}:${i.estimatedCostMinor}`)
      .join('|');
    parts.push(`d${day.dayIndex}(${day.date})=${items}`);
  }

  return parts.join(';');
}

/** Route improvement attributable to 2-opt, aggregated across days. */
export interface RouteImprovement {
  seedMins: number;
  optimisedMins: number;
  savedMins: number;
  /** Fraction of seeded travel time removed. */
  improvementRatio: number;
}

export function summariseRouteImprovement(
  perDay: ReadonlyArray<{ seedMins: number; optimisedMins: number }>,
): RouteImprovement {
  const seedMins = perDay.reduce((s, d) => s + d.seedMins, 0);
  const optimisedMins = perDay.reduce((s, d) => s + d.optimisedMins, 0);
  const savedMins = Math.max(0, seedMins - optimisedMins);
  return {
    seedMins,
    optimisedMins,
    savedMins,
    improvementRatio: seedMins > 0 ? savedMins / seedMins : 0,
  };
}
