import { rupees } from '@/lib/money';
import { MOCK_PROVENANCE } from '../helpers';
import type { LodgingSeed } from '../types';

/**
 * Manali accommodation — development fixture.
 *
 * ALL PROPERTY NAMES ARE FICTIONAL. Coordinates place them in real
 * neighbourhoods so geographic clustering has realistic structure to work
 * with, but attaching invented rates and ratings to real hotels would
 * misrepresent actual businesses. Rate bands reflect published ranges for the
 * area and season; they are not quotes.
 *
 * `totalRateMinor` is left at 0 here and computed by the provider once the
 * number of nights and rooms is known — a stay total is arithmetic, not data.
 */

export const MANALI_LODGING: LodgingSeed[] = [
  {
    id: 'lodge-pine-hollow',
    name: 'Pine Hollow Guesthouse',
    geo: { lat: 32.2536, lng: 77.1822 },
    area: 'Old Manali',
    address: 'Old Manali, near the river footbridge',
    nightlyRateMinor: rupees(1800),
    rating: 4.1,
    reviewCount: 640,
    tier: 'BUDGET',
    amenities: ['wifi', 'hot water', 'cafe', 'mountain view'],
    checkInTime: '13:00',
    checkOutTime: '11:00',
    occupancyPerRoom: 2,
  },
  {
    id: 'lodge-cedar-rest',
    name: 'Cedar Rest Inn',
    geo: { lat: 32.2449, lng: 77.1871 },
    area: 'Mall Road',
    address: 'Off Mall Road, Manali',
    nightlyRateMinor: rupees(2400),
    rating: 4.0,
    reviewCount: 1120,
    tier: 'BUDGET',
    amenities: ['wifi', 'hot water', 'room service', 'parking'],
    checkInTime: '14:00',
    checkOutTime: '11:00',
    occupancyPerRoom: 3,
  },
  {
    id: 'lodge-manalsu-homestay',
    name: 'Manalsu Homestay',
    geo: { lat: 32.2513, lng: 77.1795 },
    area: 'Old Manali',
    address: 'Manalsu Nala, Old Manali',
    nightlyRateMinor: rupees(2600),
    rating: 4.2,
    reviewCount: 430,
    tier: 'BUDGET',
    amenities: ['wifi', 'hot water', 'kitchen', 'family room', 'mountain view'],
    checkInTime: '12:00',
    checkOutTime: '10:00',
    // A four-bed family room. Without an option like this a party of four is
    // forced into two rooms everywhere, which is what a real budget traveller
    // in Manali would simply not do.
    occupancyPerRoom: 4,
  },
  {
    id: 'lodge-beas-view',
    name: 'Beas View Residency',
    geo: { lat: 32.2478, lng: 77.1849 },
    area: 'Central Manali',
    address: 'Circuit House Road, Manali',
    nightlyRateMinor: rupees(3500),
    rating: 4.3,
    reviewCount: 2050,
    tier: 'MID',
    amenities: ['wifi', 'breakfast', 'restaurant', 'parking', 'river view', 'heater'],
    checkInTime: '14:00',
    checkOutTime: '11:00',
    occupancyPerRoom: 3,
  },
  {
    id: 'lodge-apple-orchard',
    name: 'Apple Orchard Lodge',
    geo: { lat: 32.2654, lng: 77.1873 },
    area: 'Vashisht',
    address: 'Vashisht Village, Manali',
    nightlyRateMinor: rupees(4200),
    rating: 4.4,
    reviewCount: 1480,
    tier: 'MID',
    amenities: ['wifi', 'breakfast', 'heater', 'valley view', 'parking', 'bonfire'],
    checkInTime: '13:00',
    checkOutTime: '10:00',
    occupancyPerRoom: 4,
  },
  {
    id: 'lodge-snowline-retreat',
    name: 'Snowline Retreat',
    geo: { lat: 32.2596, lng: 77.1742 },
    area: 'Log Huts Area',
    address: 'Log Huts Road, Manali',
    nightlyRateMinor: rupees(6500),
    rating: 4.6,
    reviewCount: 980,
    tier: 'PREMIUM',
    amenities: ['wifi', 'breakfast', 'spa', 'restaurant', 'heater', 'parking', 'mountain view'],
    checkInTime: '14:00',
    checkOutTime: '12:00',
    occupancyPerRoom: 2,
  },
  {
    id: 'lodge-deodar-heights',
    name: 'Deodar Heights Resort',
    geo: { lat: 32.2381, lng: 77.1938 },
    area: 'Prini',
    address: 'Prini, Naggar Road',
    nightlyRateMinor: rupees(8200),
    rating: 4.7,
    reviewCount: 1310,
    tier: 'PREMIUM',
    amenities: [
      'wifi',
      'breakfast',
      'spa',
      'pool',
      'restaurant',
      'heater',
      'parking',
      'valley view',
    ],
    checkInTime: '14:00',
    checkOutTime: '12:00',
    occupancyPerRoom: 2,
  },
];

export const LODGING_PROVENANCE = MOCK_PROVENANCE;
