import { z } from 'zod';

/**
 * Typed validation failures.
 *
 * The validator is the gate between "the engine produced something" and "the
 * user is shown a plan". A trip with any HARD violation is stored as
 * DRAFT_INVALID and never presented as finished, which is the mechanism that
 * makes the impossible-itinerary failure mode structurally impossible rather
 * than merely unlikely.
 */

export const ViolationSeveritySchema = z.enum(['HARD', 'SOFT']);
export type ViolationSeverity = z.infer<typeof ViolationSeveritySchema>;

export const ViolationCodeSchema = z.enum([
  // --- HARD: the plan is wrong and must not ship -------------------------
  /** Two items on the same day occupy overlapping time. */
  'OVERLAP',
  /** Arrival or departure falls outside the place's opening hours. */
  'CLOSED_AT_TIME',
  /** The gap between two stops is shorter than the travel time between them. */
  'TRAVEL_TIME_IMPOSSIBLE',
  /** Estimated cost exceeds the stated budget. */
  'BUDGET_EXCEEDED',
  /** An activity is scheduled before check-in or after check-out. */
  'CHECKIN_CONFLICT',
  /** No transport option connects two consecutive locations. */
  'UNREACHABLE_LEG',
  /** A URL was found whose host is not on the link whitelist — the tripwire
   *  for a fabricated link reaching persistence. */
  'NON_WHITELISTED_URL',
  /** A scheduled item has no coordinates, so travel time is unknowable. */
  'MISSING_COORDINATES',
  /** An item runs before the party wakes or after they sleep. */
  'OUTSIDE_WAKING_HOURS',
  /** A day's schedule runs past midnight. */
  'DAY_OVERFLOW',

  // --- SOFT: the plan is valid but worse than it should be ---------------
  /** More scheduled hours than the requested pace allows. */
  'DAY_OVERPACKED',
  /** Daily travel exceeds the user's stated tolerance. */
  'EXCESSIVE_DAILY_TRAVEL',
  /** No meal scheduled inside a mealtime window. */
  'MISSING_MEAL',
  /** A stated interest has no representation in the plan. */
  'INTEREST_UNSERVED',
  /** Large share of the budget left unspent. */
  'BUDGET_UNDERUSED',
  /** Scheduled against a place whose opening hours we do not know. */
  'UNKNOWN_OPENING_HOURS',
]);
export type ViolationCode = z.infer<typeof ViolationCodeSchema>;

export const ViolationSchema = z.object({
  code: ViolationCodeSchema,
  severity: ViolationSeveritySchema,
  /** Plain sentence naming what is wrong and where. Shown to the user. */
  message: z.string().min(1),

  dayIndex: z.number().int().nonnegative().optional(),
  itemIds: z.array(z.string()).default([]),
  subject: z.string().optional(),

  /** Structured detail for the UI and the evaluation harness, e.g.
   *  `{ requiredMins: 45, availableMins: 20 }`. */
  detail: z.record(z.string(), z.unknown()).default({}),
});
export type Violation = z.infer<typeof ViolationSchema>;

export const ValidationReportSchema = z.object({
  violations: z.array(ViolationSchema),
  hardCount: z.number().int().nonnegative(),
  softCount: z.number().int().nonnegative(),
  /** Constraints the scheduler had to relax to produce any feasible plan.
   *  Surfaced to the user — a relaxation is a decision, not a detail. */
  relaxedConstraints: z.array(z.string()).default([]),
});
export type ValidationReport = z.infer<typeof ValidationReportSchema>;

/** Severity for each code. Single source of truth for the validator. */
export const VIOLATION_SEVERITY: Record<ViolationCode, ViolationSeverity> = {
  OVERLAP: 'HARD',
  CLOSED_AT_TIME: 'HARD',
  TRAVEL_TIME_IMPOSSIBLE: 'HARD',
  BUDGET_EXCEEDED: 'HARD',
  CHECKIN_CONFLICT: 'HARD',
  UNREACHABLE_LEG: 'HARD',
  NON_WHITELISTED_URL: 'HARD',
  MISSING_COORDINATES: 'HARD',
  OUTSIDE_WAKING_HOURS: 'HARD',
  DAY_OVERFLOW: 'HARD',
  DAY_OVERPACKED: 'SOFT',
  EXCESSIVE_DAILY_TRAVEL: 'SOFT',
  MISSING_MEAL: 'SOFT',
  INTEREST_UNSERVED: 'SOFT',
  BUDGET_UNDERUSED: 'SOFT',
  UNKNOWN_OPENING_HOURS: 'SOFT',
};

/** A plan may only be shown as finished when this returns true. */
export function isPresentable(report: ValidationReport): boolean {
  return report.hardCount === 0;
}
