import type { Minor } from '@/lib/money';
import type { ComfortTier, GeoPoint, LodgingOption, Poi, TransportMode } from '@/lib/schemas';

/**
 * Shapes every destination fixture conforms to.
 *
 * Seeds, not finished domain objects: a stay total depends on how many nights
 * and rooms a particular trip needs, and a departure instant depends on the
 * date being planned. The mock providers do that arithmetic, so the fixture
 * stays a description of a place rather than of one trip.
 */

export interface CityFixture {
  name: string;
  geo: GeoPoint;
}

/** A property before stay-specific arithmetic is applied. */
export type LodgingSeed = Omit<
  LodgingOption,
  'provenance' | 'totalRateMinor' | 'roomsRequired' | 'link' | 'amenities'
> & {
  amenities: string[];
  /** Guests one room sleeps. Drives how many rooms the party needs. */
  occupancyPerRoom: number;
};

export interface IntercityServiceSeed {
  id: string;
  mode: TransportMode;
  /** Service class, e.g. "State Roadways (Ordinary)". Never a real company. */
  operator: string;
  /** Local departure time at the origin, HH:MM. */
  departTime: string;
  durationMins: number;
  pricePerPersonMinor: Minor;
  comfortTier: ComfortTier;
  isOvernight: boolean;
  /** Shown on the option card; explains the trade-off in plain terms. */
  note: string;
}

export interface LocalTransportSeed {
  id: string;
  mode: TransportMode;
  operator: string;
  /** Typical per-person daily spend on this mode. */
  pricePerPersonMinor: Minor;
  comfortTier: ComfortTier;
  note: string;
}

export interface DestinationFixture {
  origin: CityFixture;
  destination: CityFixture;
  pois: Poi[];
  lodging: LodgingSeed[];
  intercity: IntercityServiceSeed[];
  localTransport: LocalTransportSeed[];
}
