import { planTrip, type PlanOptions } from '@/engine/orchestrator';
import type { EngineResult } from '@/engine/result';
import type { PlannedTrip } from '@/engine/types';
import type { TripBrief } from '@/lib/schemas';
import { isWhitelistedUrl } from '@/providers/links';
import { getProviders } from '@/providers/registry';
import type { ProviderSet } from '@/providers/types';
import { gatherCandidates, type GatherOptions } from './gather';

/**
 * Composition root for planning.
 *
 * Wires providers to the pure engine and injects the URL whitelist predicate,
 * which is how the engine enforces the no-fabricated-links rule without ever
 * importing provider code.
 *
 * This layer performs I/O. Everything it calls into does not.
 */

export interface PlanTripOptions extends GatherOptions {
  providers?: ProviderSet;
  autoReduceToBudget?: boolean;
  now?: () => number;
}

export async function planTripFromBrief(
  brief: TripBrief,
  options: PlanTripOptions = {},
): Promise<EngineResult<{ plan: PlannedTrip }>> {
  const providers = options.providers ?? getProviders();
  const candidates = await gatherCandidates(brief, providers, options);

  const planOptions: PlanOptions = { isWhitelistedUrl };
  if (options.autoReduceToBudget !== undefined) {
    planOptions.autoReduceToBudget = options.autoReduceToBudget;
  }
  if (options.now) planOptions.now = options.now;

  return planTrip(brief, candidates, planOptions);
}

export { gatherCandidates };
export type { GatherOptions };
