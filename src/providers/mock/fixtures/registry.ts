import { DELHI_JAIPUR } from './delhi-jaipur';
import { DELHI_MANALI } from './delhi-manali';
import { MUMBAI_GOA } from './mumbai-goa';
import type { DestinationFixture } from './types';

/**
 * Every destination the mock providers know about, keyed by destination city.
 *
 * Three deliberately different geographic shapes, so the engine is exercised
 * against more than one kind of place:
 *
 *   Manali — one valley, sights strung along a road, a far outlier at Rohtang
 *   Goa    — two beach clusters, an inland heritage cluster, distant outliers
 *   Jaipur — a dense walled-city core plus a northern hill-fort group
 */
export const FIXTURES_BY_DESTINATION: Record<string, DestinationFixture> = {
  manali: DELHI_MANALI,
  goa: MUMBAI_GOA,
  jaipur: DELHI_JAIPUR,
};

/** Case- and whitespace-insensitive lookup. Undefined when unknown. */
export function findFixture(destinationCity: string): DestinationFixture | undefined {
  return FIXTURES_BY_DESTINATION[destinationCity.trim().toLowerCase()];
}

export { DELHI_MANALI, MUMBAI_GOA, DELHI_JAIPUR };
export type { DestinationFixture };
