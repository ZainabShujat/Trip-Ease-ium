import { sumMinor } from '@/lib/money';
import type {
  BudgetCategory,
  BudgetLine,
  BudgetStatus,
  BudgetSummary,
  ItineraryDay,
  LodgingOption,
  TransportOption,
  TripBrief,
} from '@/lib/schemas';
import { BUDGET, BUDGET_ALLOCATION } from '../config';
import type { Selections } from '../types';

/**
 * The budget engine.
 *
 * Every figure here is an integer count of paise and every total is computed
 * by summing the parts — never stored, never carried forward, never derived
 * from a model. `totalEstimatedMinor` is by construction the sum of the
 * category lines, and the category lines are by construction the sum of the
 * things in them, so the arithmetic on screen can be checked by hand against
 * the itinerary.
 */

const CATEGORIES: BudgetCategory[] = [
  'TRANSPORT',
  'ACCOMMODATION',
  'FOOD',
  'ACTIVITIES',
  'LOCAL_TRANSPORT',
  'MISC',
];

// ---------------------------------------------------------------------------
// Cost components
// ---------------------------------------------------------------------------

export function transportCostMinor(
  outbound: TransportOption,
  inbound: TransportOption,
  travellers: number,
): number {
  return (outbound.pricePerPersonMinor + inbound.pricePerPersonMinor) * travellers;
}

export function lodgingCostMinor(lodging: LodgingOption): number {
  // Already includes nights and rooms — computed by the provider, not here.
  return lodging.totalRateMinor;
}

/**
 * Local transport, per person per day.
 *
 * Uses the cheapest selected local mode as the daily rate. Travellers rarely
 * take a full-day taxi every day, so charging the most expensive option for
 * the whole trip would systematically overstate the cost and push good plans
 * out of budget.
 */
export function localTransportCostMinor(
  local: readonly TransportOption[],
  travellers: number,
  days: number,
): number {
  const paid = local.filter((o) => o.pricePerPersonMinor > 0);
  if (paid.length === 0 || days <= 0) return 0;
  const dailyRate = Math.min(...paid.map((o) => o.pricePerPersonMinor));
  return dailyRate * travellers * days;
}

/** Meal and café costs actually scheduled in the itinerary. */
export function scheduledFoodCostMinor(days: readonly ItineraryDay[]): number {
  return sumMinor(
    days.flatMap((day) =>
      day.items.filter((i) => i.category === 'MEAL' || i.category === 'CAFE').map(
        (i) => i.estimatedCostMinor,
      ),
    ),
  );
}

/** Sights, activities and shopping actually scheduled. */
export function scheduledActivityCostMinor(days: readonly ItineraryDay[]): number {
  return sumMinor(
    days.flatMap((day) =>
      day.items
        .filter((i) => i.category === 'SIGHT' || i.category === 'ACTIVITY' || i.category === 'SHOPPING')
        .map((i) => i.estimatedCostMinor),
    ),
  );
}

/**
 * Top up food to a realistic figure.
 *
 * The scheduler places meals where it can find an open eatery. Days where it
 * could not still involve eating, so the ledger adds a fallback rather than
 * quietly reporting a trip where nobody has lunch — an understated total is a
 * worse failure than a slightly conservative one.
 */
export function foodCostMinor(
  days: readonly ItineraryDay[],
  travellers: number,
  activityDays: number,
): number {
  const scheduled = scheduledFoodCostMinor(days);
  const scheduledMeals = days.reduce(
    (count, day) =>
      count + day.items.filter((i) => i.category === 'MEAL' || i.category === 'CAFE').length,
    0,
  );
  const expectedMeals = Math.max(0, activityDays * BUDGET.mealsPerDay);
  const missing = Math.max(0, expectedMeals - scheduledMeals);
  return scheduled + missing * BUDGET.fallbackMealCostPerPersonMinor * travellers;
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export function allocateEnvelopes(budgetTotalMinor: number): Map<BudgetCategory, number> {
  const map = new Map<BudgetCategory, number>();
  for (const category of CATEGORIES) {
    map.set(category, Math.floor(budgetTotalMinor * BUDGET_ALLOCATION[category]));
  }
  return map;
}

export function statusFor(estimatedMinor: number, budgetMinor: number): BudgetStatus {
  if (budgetMinor <= 0) return estimatedMinor > 0 ? 'EXCEEDED' : 'ON_TRACK';
  if (estimatedMinor > budgetMinor) return 'EXCEEDED';
  const ratio = estimatedMinor / budgetMinor;
  if (ratio >= BUDGET.nearlyExhaustedRatio) return 'NEARLY_EXHAUSTED';
  if (ratio < BUDGET.underUtilisedRatio) return 'UNDER';
  return 'ON_TRACK';
}

export function runBudgetStage(
  brief: TripBrief,
  selections: Selections,
  days: readonly ItineraryDay[],
): BudgetSummary {
  const travellers = brief.travellerCount;
  const activityDays = days.filter((d) => d.items.length > 0).length;
  const envelopes = allocateEnvelopes(brief.budgetTotalMinor);

  const estimates: Record<BudgetCategory, number> = {
    TRANSPORT: transportCostMinor(selections.outbound, selections.inbound, travellers),
    ACCOMMODATION: lodgingCostMinor(selections.lodging),
    FOOD: foodCostMinor(days, travellers, activityDays),
    ACTIVITIES: scheduledActivityCostMinor(days),
    LOCAL_TRANSPORT: localTransportCostMinor(selections.local, travellers, activityDays),
    MISC: 0,
  };

  const lines: BudgetLine[] = CATEGORIES.map((category) => ({
    category,
    allocatedMinor: envelopes.get(category) ?? 0,
    estimatedMinor: estimates[category],
    actualMinor: 0,
  }));

  // The total is the sum of the lines. There is deliberately no independent
  // running total that could disagree with them.
  const totalEstimatedMinor = sumMinor(lines.map((l) => l.estimatedMinor));

  return {
    currency: brief.currency,
    totalBudgetMinor: brief.budgetTotalMinor,
    totalEstimatedMinor,
    remainingMinor: brief.budgetTotalMinor - totalEstimatedMinor,
    lines,
    status: statusFor(totalEstimatedMinor, brief.budgetTotalMinor),
  };
}

// ---------------------------------------------------------------------------
// reduceToBudget — substitution search
// ---------------------------------------------------------------------------

export interface Substitution {
  kind: 'TRANSPORT_OUTBOUND' | 'TRANSPORT_RETURN' | 'LODGING' | 'DROP_ACTIVITY';
  description: string;
  savingMinor: number;
  /** Preference score given up. Lower is better. */
  scoreCostDelta: number;
}

export interface ReduceResult {
  ok: boolean;
  selections: Selections;
  days: ItineraryDay[];
  applied: Substitution[];
  /** Recomputed from the substituted selections — never assumed. */
  totalEstimatedMinor: number;
  shortfallMinor: number;
}

/**
 * Bring a plan under `targetMinor` by substitution.
 *
 * Greedy by efficiency: at each round, take the swap that saves the most per
 * unit of preference score surrendered. That is a heuristic, not an optimum —
 * a true multiple-choice knapsack would be exact, and is a documented Phase 9
 * comparison. The greedy version is deterministic, explainable in a sentence
 * ("we moved you to the semi-sleeper, which saved ₹2,600"), and fast.
 *
 * Cheaper alternatives come only from candidates already scored and offered;
 * nothing is invented to hit a number.
 *
 * IMPORTANT: the returned total is recomputed from the resulting selections,
 * never accumulated from the savings. An optimiser that reports a total it did
 * not derive from the actual plan is the exact failure the tests guard.
 */
export function reduceToBudget(
  brief: TripBrief,
  selections: Selections,
  days: readonly ItineraryDay[],
  targetMinor: number,
  pool: {
    outbound: readonly TransportOption[];
    inbound: readonly TransportOption[];
    lodging: readonly LodgingOption[];
  },
): ReduceResult {
  let current: Selections = { ...selections };
  let currentDays = days.map((d) => ({ ...d, items: [...d.items] }));
  const applied: Substitution[] = [];

  const totalOf = (sel: Selections, ds: readonly ItineraryDay[]) =>
    runBudgetStage(brief, sel, ds).totalEstimatedMinor;

  let total = totalOf(current, currentDays);

  for (let round = 0; round < BUDGET.maxSubstitutionRounds && total > targetMinor; round += 1) {
    const options: Array<{ sub: Substitution; apply: () => void }> = [];

    // --- cheaper outbound transport -----------------------------------------
    for (const candidate of pool.outbound) {
      if (candidate.pricePerPersonMinor >= current.outbound.pricePerPersonMinor) continue;
      const next: Selections = { ...current, outbound: candidate };
      const saving = total - totalOf(next, currentDays);
      if (saving <= 0) continue;
      options.push({
        sub: {
          kind: 'TRANSPORT_OUTBOUND',
          description: `Outbound: ${current.outbound.operator} → ${candidate.operator}`,
          savingMinor: saving,
          scoreCostDelta: Math.max(0, (current.outbound.score ?? 0) - (candidate.score ?? 0)),
        },
        apply: () => {
          current = next;
        },
      });
    }

    // --- cheaper return transport -------------------------------------------
    for (const candidate of pool.inbound) {
      if (candidate.pricePerPersonMinor >= current.inbound.pricePerPersonMinor) continue;
      const next: Selections = { ...current, inbound: candidate };
      const saving = total - totalOf(next, currentDays);
      if (saving <= 0) continue;
      options.push({
        sub: {
          kind: 'TRANSPORT_RETURN',
          description: `Return: ${current.inbound.operator} → ${candidate.operator}`,
          savingMinor: saving,
          scoreCostDelta: Math.max(0, (current.inbound.score ?? 0) - (candidate.score ?? 0)),
        },
        apply: () => {
          current = next;
        },
      });
    }

    // --- cheaper lodging ------------------------------------------------------
    for (const candidate of pool.lodging) {
      if (candidate.totalRateMinor >= current.lodging.totalRateMinor) continue;
      const next: Selections = { ...current, lodging: candidate };
      const saving = total - totalOf(next, currentDays);
      if (saving <= 0) continue;
      options.push({
        sub: {
          kind: 'LODGING',
          description: `Stay: ${current.lodging.name} → ${candidate.name}`,
          savingMinor: saving,
          scoreCostDelta: Math.max(0, (current.lodging.score ?? 0) - (candidate.score ?? 0)),
        },
        apply: () => {
          current = next;
        },
      });
    }

    // --- drop the least valuable paid activity --------------------------------
    const paidItems = currentDays
      .flatMap((day) =>
        day.items
          .filter(
            (i) =>
              i.estimatedCostMinor > 0 &&
              (i.category === 'ACTIVITY' || i.category === 'SIGHT' || i.category === 'SHOPPING'),
          )
          .map((item) => ({ dayIndex: day.dayIndex, item })),
      )
      .sort(
        (a, b) =>
          b.item.estimatedCostMinor - a.item.estimatedCostMinor ||
          a.item.id.localeCompare(b.item.id),
      );

    const dropTarget = paidItems[0];
    if (dropTarget) {
      const nextDays = currentDays.map((day) =>
        day.dayIndex === dropTarget.dayIndex
          ? {
              ...day,
              items: day.items.filter((i) => i.id !== dropTarget.item.id),
              totalCostMinor: day.items
                .filter((i) => i.id !== dropTarget.item.id)
                .reduce((s, i) => s + i.estimatedCostMinor, 0),
            }
          : day,
      );
      const saving = total - totalOf(current, nextDays);
      if (saving > 0) {
        options.push({
          sub: {
            kind: 'DROP_ACTIVITY',
            description: `Remove: ${dropTarget.item.title}`,
            savingMinor: saving,
            // Dropping an activity costs real preference; weight it above a
            // like-for-like downgrade so it is chosen last.
            scoreCostDelta: 0.5,
          },
          apply: () => {
            currentDays = nextDays;
          },
        });
      }
    }

    if (options.length === 0) break;

    // Most saving per unit of preference surrendered. The epsilon keeps a
    // zero-cost swap from dividing by zero while still ranking it first.
    options.sort(
      (a, b) =>
        b.sub.savingMinor / (b.sub.scoreCostDelta + 0.01) -
          a.sub.savingMinor / (a.sub.scoreCostDelta + 0.01) ||
        a.sub.description.localeCompare(b.sub.description),
    );

    const chosen = options[0]!;
    chosen.apply();
    applied.push(chosen.sub);
    total = totalOf(current, currentDays);
  }

  return {
    ok: total <= targetMinor,
    selections: current,
    days: currentDays,
    applied,
    totalEstimatedMinor: total,
    shortfallMinor: Math.max(0, total - targetMinor),
  };
}
