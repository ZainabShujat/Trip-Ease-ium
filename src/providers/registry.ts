import { createMockProviders } from './mock';
import { ProviderNotImplementedError, type ProviderSet } from './types';

/**
 * Provider selection.
 *
 * The engine and the UI call `getProviders()` and never construct a provider
 * themselves. Swapping mocks for real integrations in Phase 5 happens here and
 * nowhere else.
 *
 * PROVIDER_MODE=live deliberately THROWS in Phase 1 rather than falling back
 * to mocks. A silent fallback is how a demo ends up presenting fixture data as
 * live availability — the exact failure the architecture forbids (§15.11).
 */

export type ProviderMode = 'mock' | 'live';

/** Narrow env shape — deliberately not NodeJS.ProcessEnv, so tests can pass a
 *  bare object without having to satisfy Next's required NODE_ENV. */
export type EnvLike = Record<string, string | undefined>;

export function resolveProviderMode(env: EnvLike = process.env): ProviderMode {
  const raw = (env.PROVIDER_MODE ?? 'mock').trim().toLowerCase();
  if (raw === 'live') return 'live';
  if (raw === 'mock' || raw === '') return 'mock';
  throw new Error(
    `PROVIDER_MODE must be "mock" or "live" (got "${raw}"). Leave it unset to use mocks.`,
  );
}

let cached: { mode: ProviderMode; set: ProviderSet } | null = null;

export function getProviders(env: EnvLike = process.env): ProviderSet {
  const mode = resolveProviderMode(env);

  if (cached && cached.mode === mode) return cached.set;

  if (mode === 'live') {
    // Phase 5 constructs the Google Places, Routes and affiliate providers
    // here. Until then this is an honest error, not a placeholder that
    // pretends to work.
    throw new ProviderNotImplementedError('live', 'Phase 5: Real data');
  }

  const set = createMockProviders();
  cached = { mode, set };
  return set;
}

/** Test hook: drop the memoised set so a test can change PROVIDER_MODE. */
export function resetProviderCache(): void {
  cached = null;
}

/**
 * Per-provider status for the /api/health route and the settings page, so the
 * running mode is always visible rather than assumed.
 */
export function describeProviders(env: EnvLike = process.env) {
  const mode = resolveProviderMode(env);
  if (mode === 'live') {
    return {
      mode,
      providers: [] as Array<{ name: string; sourceKind: string; configured: boolean }>,
    };
  }
  const set = getProviders(env);
  return {
    mode,
    providers: Object.values(set).map((p) => ({
      name: p.name,
      sourceKind: p.defaultSourceKind,
      configured: p.isConfigured(),
    })),
  };
}
