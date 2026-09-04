import { rupees, type Minor } from '@/lib/money';
import type { ComfortTier, TransportMode } from '@/lib/schemas';

/**
 * Delhi ↔ Manali transport — development fixture.
 *
 * OPERATORS ARE SERVICE CLASSES, NOT COMPANIES. Naming a real bus operator and
 * attaching invented departure times and fares to it would misrepresent a real
 * business, so services are described by the class a traveller actually
 * chooses between.
 *
 * Journey durations sit in the real 12–15 hour band for the ~530 km road route;
 * fares sit in published ranges. Neither is a quotation, and no seat here
 * exists.
 *
 * Departure times are stored as local `HH:MM` templates rather than instants:
 * the provider combines a template with the requested date, so the fixture
 * works for any travel date without going stale.
 */

export interface IntercityServiceSeed {
  id: string;
  mode: TransportMode;
  /** Service class, e.g. "State Roadways (Ordinary)". */
  operator: string;
  /** Local departure time at the origin, HH:MM. */
  departTime: string;
  durationMins: number;
  pricePerPersonMinor: Minor;
  comfortTier: ComfortTier;
  isOvernight: boolean;
  /** Shown in the option card; explains the trade-off in plain terms. */
  note: string;
}

export const DELHI_MANALI_SERVICES: IntercityServiceSeed[] = [
  {
    id: 'svc-state-ordinary',
    mode: 'BUS',
    operator: 'State Roadways (Ordinary)',
    departTime: '17:30',
    durationMins: 15 * 60,
    pricePerPersonMinor: rupees(950),
    comfortTier: 'BASIC',
    isOvernight: true,
    note: 'Cheapest option. Non-AC seating, several halts, arrives early morning.',
  },
  {
    id: 'svc-state-semideluxe',
    mode: 'BUS',
    operator: 'State Roadways (Semi-Deluxe)',
    departTime: '18:30',
    durationMins: 14 * 60,
    pricePerPersonMinor: rupees(1250),
    comfortTier: 'BASIC',
    isOvernight: true,
    note: 'Reclining seats, fewer halts than the ordinary service.',
  },
  {
    id: 'svc-volvo-seater',
    mode: 'BUS',
    operator: 'Private Volvo A/C Semi-Sleeper',
    departTime: '20:00',
    durationMins: 13 * 60,
    pricePerPersonMinor: rupees(1650),
    comfortTier: 'STANDARD',
    isOvernight: true,
    note: 'The common choice: air-conditioned, reclining, one dinner halt.',
  },
  {
    id: 'svc-volvo-sleeper',
    mode: 'BUS',
    operator: 'Private Volvo A/C Sleeper',
    departTime: '21:00',
    durationMins: 12 * 60 + 30,
    pricePerPersonMinor: rupees(2300),
    comfortTier: 'PREMIUM',
    isOvernight: true,
    note: 'Flat berths. Most comfortable overnight option.',
  },
  {
    id: 'svc-day-volvo',
    mode: 'BUS',
    operator: 'Private Volvo A/C (Day Service)',
    departTime: '06:00',
    durationMins: 14 * 60,
    pricePerPersonMinor: rupees(1750),
    comfortTier: 'STANDARD',
    isOvernight: false,
    note: 'Daytime journey for travellers avoiding overnight buses. Arrives late evening.',
  },
  {
    id: 'svc-train-road-combo',
    mode: 'TRAIN',
    operator: 'Train to Chandigarh + road transfer',
    departTime: '07:40',
    durationMins: 16 * 60,
    pricePerPersonMinor: rupees(1400),
    comfortTier: 'STANDARD',
    isOvernight: false,
    note: 'Rail as far as Chandigarh, then road. Two legs, two bookings.',
  },
  {
    id: 'svc-private-cab',
    mode: 'CAR',
    operator: 'Private cab (whole vehicle)',
    departTime: '05:00',
    durationMins: 12 * 60,
    pricePerPersonMinor: rupees(2750),
    comfortTier: 'PREMIUM',
    isOvernight: false,
    note: 'Fastest and most flexible. Priced per person assuming a full vehicle of four.',
  },
];

/** Ways of getting around Manali once you are there. */
export interface LocalTransportSeed {
  id: string;
  mode: TransportMode;
  operator: string;
  /** Typical per-person daily spend on this mode. */
  pricePerPersonMinor: Minor;
  comfortTier: ComfortTier;
  note: string;
}

export const MANALI_LOCAL_TRANSPORT: LocalTransportSeed[] = [
  {
    id: 'local-walk',
    mode: 'WALK',
    operator: 'On foot',
    pricePerPersonMinor: rupees(0),
    comfortTier: 'BASIC',
    note: 'Central Manali, Mall Road and Old Manali are walkable in good weather.',
  },
  {
    id: 'local-auto',
    mode: 'AUTO_RICKSHAW',
    operator: 'Auto-rickshaw',
    pricePerPersonMinor: rupees(250),
    comfortTier: 'BASIC',
    note: 'Short hops within town. Negotiate the fare before setting off.',
  },
  {
    id: 'local-bus',
    mode: 'BUS',
    operator: 'Local bus',
    pricePerPersonMinor: rupees(80),
    comfortTier: 'BASIC',
    note: 'Cheapest way to reach Vashisht, Naggar and Solang. Infrequent after dark.',
  },
  {
    id: 'local-taxi',
    mode: 'TAXI',
    operator: 'Taxi (day hire)',
    pricePerPersonMinor: rupees(700),
    comfortTier: 'STANDARD',
    note: 'Full-day hire for Solang, Rohtang or Naggar. Priced per person for a party of four.',
  },
];

/** City coordinates used for the intercity legs. */
export const DELHI_GEO = { lat: 28.6139, lng: 77.209 } as const;
export const MANALI_GEO = { lat: 32.2432, lng: 77.1892 } as const;
