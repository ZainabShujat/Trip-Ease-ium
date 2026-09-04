/**
 * Test-facing entry point for the Delhi → Manali fixture.
 *
 * The fixture DATA lives with the code that serves it, at
 * `src/providers/mock/fixtures/delhi-manali/` — the mock providers are
 * application code, and application code must not import from `tests/`.
 *
 * This module re-exports it so tests have a stable import path, and is where
 * golden expectations (the Phase 2 scheduler's asserted output for this trip)
 * will live alongside it.
 */

export * from '@/providers/mock/fixtures/delhi-manali';
