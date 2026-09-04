import { LODGING_PROVENANCE, MANALI_LODGING } from './lodging';
import { MANALI_POIS } from './pois';
import { DELHI_GEO, DELHI_MANALI_SERVICES, MANALI_GEO, MANALI_LOCAL_TRANSPORT } from './transport';
import type { DestinationFixture } from '../types';

/**
 * The Delhi -> Manali fixture, assembled.
 *
 * Read README.md in this directory before trusting any figure here.
 */
export const DELHI_MANALI: DestinationFixture = {
  origin: { name: 'Delhi', geo: DELHI_GEO },
  destination: { name: 'Manali', geo: MANALI_GEO },
  pois: MANALI_POIS,
  lodging: MANALI_LODGING,
  intercity: DELHI_MANALI_SERVICES,
  localTransport: MANALI_LOCAL_TRANSPORT,
};

export { MANALI_POIS, MANALI_LODGING, DELHI_MANALI_SERVICES, MANALI_LOCAL_TRANSPORT };
export { LODGING_PROVENANCE };
export type { DestinationFixture } from '../types';
