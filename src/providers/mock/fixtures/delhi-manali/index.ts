import type { Provenance } from '@/lib/schemas';
import { LODGING_PROVENANCE, MANALI_LODGING, type LodgingSeed } from './lodging';
import { MANALI_POIS } from './pois';
import {
  DELHI_GEO,
  DELHI_MANALI_SERVICES,
  MANALI_GEO,
  MANALI_LOCAL_TRANSPORT,
  type IntercityServiceSeed,
  type LocalTransportSeed,
} from './transport';

/**
 * The Delhi → Manali fixture, assembled.
 *
 * This is the corpus the mock providers serve, the Phase 2 engine tests assert
 * against, and the demo runs on. It requires no network and no API key, and it
 * is deliberately the same data every run — a golden test that changed between
 * runs would be worthless.
 *
 * Read README.md in this directory before trusting any figure here.
 */

export interface CityFixture {
  name: string;
  geo: { lat: number; lng: number };
}

export interface DestinationFixture {
  origin: CityFixture;
  destination: CityFixture;
  pois: typeof MANALI_POIS;
  lodging: LodgingSeed[];
  intercity: IntercityServiceSeed[];
  localTransport: LocalTransportSeed[];
  provenance: Provenance;
}

export const DELHI_MANALI: DestinationFixture = {
  origin: { name: 'Delhi', geo: DELHI_GEO },
  destination: { name: 'Manali', geo: MANALI_GEO },
  pois: MANALI_POIS,
  lodging: MANALI_LODGING,
  intercity: DELHI_MANALI_SERVICES,
  localTransport: MANALI_LOCAL_TRANSPORT,
  provenance: LODGING_PROVENANCE,
};

/** Every fixture the mock providers know about, keyed by destination city. */
export const FIXTURES_BY_DESTINATION: Record<string, DestinationFixture> = {
  manali: DELHI_MANALI,
};

/** Case- and whitespace-insensitive lookup. Returns undefined when unknown. */
export function findFixture(destinationCity: string): DestinationFixture | undefined {
  return FIXTURES_BY_DESTINATION[destinationCity.trim().toLowerCase()];
}

export { MANALI_POIS, MANALI_LODGING, DELHI_MANALI_SERVICES, MANALI_LOCAL_TRANSPORT };
export type { LodgingSeed, IntercityServiceSeed, LocalTransportSeed };
