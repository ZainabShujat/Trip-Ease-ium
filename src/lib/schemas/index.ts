/**
 * The domain contracts.
 *
 * Everything downstream — engine, providers, API routes, UI — imports its
 * types from here. Zod schemas are the source of truth and the TypeScript
 * types are inferred, so there is exactly one definition of each shape.
 */

export * from './common';
export * from './link';
export * from './poi';
export * from './transport';
export * from './lodging';
export * from './trip';
export * from './itinerary';
export * from './budget';
export * from './violation';
export * from './replan';
