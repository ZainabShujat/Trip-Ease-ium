import type { Violation } from '@/lib/schemas';

/**
 * Typed engine outcomes.
 *
 * The engine never returns a plan it knows to be wrong, and never signals
 * failure by returning an empty itinerary. Callers get a discriminated union
 * they must narrow, so "the schedule was impossible" cannot be mistaken for
 * "the schedule is empty".
 */

export type EngineFailureCode =
  /** No feasible schedule exists, even after every permitted relaxation. */
  | 'INFEASIBLE_CONSTRAINTS'
  /** The plan cannot be brought within the stated budget by substitution. */
  | 'BUDGET_UNREACHABLE'
  /** Providers returned nothing usable — no POIs, no lodging, no transport. */
  | 'NO_CANDIDATES'
  /** The finished plan failed the validation gate. A bug, surfaced not hidden. */
  | 'VALIDATION_FAILED';

export interface EngineFailure {
  ok: false;
  code: EngineFailureCode;
  message: string;
  /** What specifically could not be satisfied. */
  violations: Violation[];
  /** Soft constraints already surrendered before giving up — evidence that
   *  the engine tried, and material for the user-facing explanation. */
  relaxedConstraints: string[];
}

export type EngineResult<T> = ({ ok: true } & T) | EngineFailure;

export function failure(
  code: EngineFailureCode,
  message: string,
  violations: Violation[] = [],
  relaxedConstraints: string[] = [],
): EngineFailure {
  return { ok: false, code, message, violations, relaxedConstraints };
}

export function isFailure<T>(result: EngineResult<T>): result is EngineFailure {
  return result.ok === false;
}
