import type { ItineraryDay, PipelineStage, Poi, SourceKind, TripBrief } from '@/lib/schemas';
import { runBudgetStage, reduceToBudget } from './budget';
import { runClusterStage } from './cluster';
import { createTravelLookup } from './matrix';
import { failure, type EngineResult } from './result';
import { runScoreStage } from './score';
import { runScheduleStage } from './schedule';
import { buildDayFrames } from './schedule/frames';
import type { PlannedTrip, SourcedCandidates, StageTimings } from './types';
import { runValidateStage } from './validate';

/**
 * The engine orchestrator.
 *
 * Runs the deterministic pipeline end to end. Pure: it takes a brief and
 * already-fetched candidates and returns a plan or a typed failure. It opens
 * no connections, reads no clock for decisions (only for timings), and calls
 * no model.
 *
 *   score → cluster → route → schedule → budget → validate
 *
 * Routing is not a separate top-level pass: it runs inside scheduling, per
 * day, because the order of a day's stops and their placement on the clock are
 * the same decision. Splitting them would mean optimising an order the
 * scheduler then has to discard when a stop turns out to be closed.
 */

export interface PlanOptions {
  /** Whitelist predicate, injected so the engine imports no provider code. */
  isWhitelistedUrl: (url: string) => boolean;
  /**
   * Attempt substitution when the first plan is over budget. On by default;
   * disable to inspect the unmodified plan.
   */
  autoReduceToBudget?: boolean;
  /** Clock injected for testability. Only affects reported timings. */
  now?: () => number;
}

const STAGE_ORDER: PipelineStage[] = [
  'SOURCE',
  'SCORE',
  'CLUSTER',
  'ROUTE',
  'SCHEDULE',
  'BUDGET',
  'VALIDATE',
];

/** Weakest provenance wins: a plan touching any mock data is a mock plan. */
export function weakestSourceKind(kinds: readonly SourceKind[]): SourceKind {
  const rank: Record<SourceKind, number> = { live: 3, cached: 2, estimated: 1, mock: 0 };
  return kinds.reduce<SourceKind>(
    (weakest, kind) => (rank[kind] < rank[weakest] ? kind : weakest),
    'live',
  );
}

export function planTrip(
  brief: TripBrief,
  candidates: SourcedCandidates,
  options: PlanOptions,
): EngineResult<{ plan: PlannedTrip }> {
  const now = options.now ?? (() => Date.now());
  const timings: StageTimings = {};
  const mark = <T>(stage: PipelineStage, fn: () => T): T => {
    const started = now();
    const result = fn();
    timings[stage] = now() - started;
    return result;
  };

  const lookup = createTravelLookup(candidates.matrix);

  // --- score ----------------------------------------------------------------
  const selections = mark('SCORE', () => runScoreStage(brief, candidates));
  if (!selections) {
    return failure(
      'NO_CANDIDATES',
      'Planning needs transport in both directions and at least one place to stay. ' +
        'The providers returned too little to build a trip.',
    );
  }

  // --- day frames -----------------------------------------------------------
  const frames = mark('SOURCE', () => buildDayFrames(brief, selections));
  if (!frames.some((f) => f.isActivityDay)) {
    return failure(
      'INFEASIBLE_CONSTRAINTS',
      'No day has enough usable time for activities once travel, the waking window ' +
        'and check-in times are accounted for.',
      [],
      [],
    );
  }

  // --- cluster --------------------------------------------------------------
  const clustering = mark('CLUSTER', () => runClusterStage(brief, selections, frames));

  // --- schedule (routing runs inside, per day) ------------------------------
  const scheduled = mark('SCHEDULE', () =>
    runScheduleStage(brief, selections, clustering.clusters, frames, lookup),
  );
  timings.ROUTE = 0; // routing time is counted inside SCHEDULE

  let workingSelections = selections;
  let workingDays: ItineraryDay[] = scheduled.days;
  let relaxedConstraints = scheduled.relaxedConstraints;
  let unplaced = scheduled.unplaced;

  // --- budget ---------------------------------------------------------------
  let budget = mark('BUDGET', () => runBudgetStage(brief, workingSelections, workingDays));

  // --- bringing the plan within budget --------------------------------------
  //
  // Three ordered steps, deliberately not a loop. Rescheduling regenerates the
  // itinerary from the clusters, which would restore any activity a previous
  // round had dropped — so every step that can trigger a reschedule runs
  // BEFORE the step that drops activities, and never after it.
  //
  //   1. Swap selections (transport, lodging) for cheaper ones.
  //   2. Reschedule cost-sensitively: eat to the budget rather than to
  //      convenience. Food is roughly a third of a trip like this, and leaving
  //      it untouchable is why a plan reads as "unreachable" when a real
  //      traveller would just pick a dhaba over a cafe.
  //   3. Drop the most expensive optional activities, no rescheduling after.
  //
  // Each step is skipped once the plan is inside the budget.
  if (options.autoReduceToBudget !== false) {
    const pool = {
      outbound: candidates.outboundTransport,
      inbound: candidates.returnTransport,
      lodging: candidates.lodging,
    };

    // --- step 1: cheaper selections ----------------------------------------
    if (budget.totalEstimatedMinor > brief.budgetTotalMinor) {
      const swapped = reduceToBudget(
        brief,
        workingSelections,
        workingDays,
        brief.budgetTotalMinor,
        pool,
      );
      const changed =
        swapped.selections.lodging.id !== workingSelections.lodging.id ||
        swapped.selections.outbound.id !== workingSelections.outbound.id ||
        swapped.selections.inbound.id !== workingSelections.inbound.id;

      workingSelections = swapped.selections;

      if (changed) {
        const rescheduled = runScheduleStage(
          brief,
          workingSelections,
          clustering.clusters,
          frames,
          lookup,
        );
        workingDays = rescheduled.days;
        relaxedConstraints = rescheduled.relaxedConstraints;
        unplaced = rescheduled.unplaced;
      }
      budget = runBudgetStage(brief, workingSelections, workingDays);
    }

    // --- step 2: eat to the budget -----------------------------------------
    if (budget.totalEstimatedMinor > brief.budgetTotalMinor) {
      const frugal = runScheduleStage(
        brief,
        workingSelections,
        clustering.clusters,
        frames,
        lookup,
        { costSensitive: true },
      );
      const frugalBudget = runBudgetStage(brief, workingSelections, frugal.days);

      // Only keep the frugal schedule if it actually saved money.
      if (frugalBudget.totalEstimatedMinor < budget.totalEstimatedMinor) {
        workingDays = frugal.days;
        relaxedConstraints = frugal.relaxedConstraints;
        unplaced = frugal.unplaced;
        budget = frugalBudget;
        relaxedConstraints = [...relaxedConstraints, 'FOOD_PREFERENCE'];
      }
    }

    // --- step 3: drop optional paid activities ------------------------------
    if (budget.totalEstimatedMinor > brief.budgetTotalMinor) {
      const trimmed = reduceToBudget(
        brief,
        workingSelections,
        workingDays,
        brief.budgetTotalMinor,
        // Empty pool: selections are already final, so nothing here can
        // trigger a reschedule that would undo the drops.
        { outbound: [], inbound: [], lodging: [] },
      );
      workingSelections = trimmed.selections;
      workingDays = trimmed.days;
      budget = runBudgetStage(brief, workingSelections, workingDays);
      if (trimmed.applied.length > 0) {
        relaxedConstraints = [...relaxedConstraints, 'DROP_PAID_ACTIVITIES'];
      }
    }

    if (budget.totalEstimatedMinor > brief.budgetTotalMinor) {
      return failure(
        'BUDGET_UNREACHABLE',
        `The cheapest combination available still costs ${budget.totalEstimatedMinor} paise, ` +
          `which is ${budget.totalEstimatedMinor - brief.budgetTotalMinor} paise over the ` +
          `stated budget.`,
        [],
        relaxedConstraints,
      );
    }
  }

  // --- validate -------------------------------------------------------------
  const poiById = new Map<string, Poi>(workingSelections.shortlist.map((p) => [p.id, p]));
  const validation = mark('VALIDATE', () =>
    runValidateStage({
      brief,
      selections: workingSelections,
      days: workingDays,
      budget,
      lookup,
      poiById,
      isWhitelistedUrl: options.isWhitelistedUrl,
      relaxedConstraints,
    }),
  );

  // The gate. A plan with hard violations is never returned as a success.
  if (validation.hardCount > 0) {
    return failure(
      'INFEASIBLE_CONSTRAINTS',
      `The plan violates ${validation.hardCount} hard constraint(s) and cannot be presented.`,
      validation.violations.filter((v) => v.severity === 'HARD'),
      relaxedConstraints,
    );
  }

  const plan: PlannedTrip = {
    brief,
    selections: workingSelections,
    clusters: clustering.clusters,
    days: workingDays,
    budget,
    validation,
    relaxedConstraints,
    unplaced,
    timings,
    overallSourceKind: weakestSourceKind([
      candidates.provenance.transport.sourceKind,
      candidates.provenance.lodging.sourceKind,
      candidates.provenance.places.sourceKind,
      candidates.provenance.routing.sourceKind,
    ]),
    clusterStrategy: clustering.strategy,
  };

  return { ok: true, plan };
}

export { STAGE_ORDER };
