import type { GeoPoint, TransportMode } from '@/lib/schemas';

/**
 * Distance and travel-time estimation for the mock routing provider.
 *
 * This is a MODEL, not a measurement, and everything it returns is tagged
 * `estimated`. Phase 5 replaces it with the Google Routes API behind the same
 * RoutingProvider interface; no caller changes.
 *
 * Two corrections make it usable for Himachal rather than laughable:
 *
 *   1. A road-winding factor. Straight-line distance badly understates
 *      mountain roads — the 51 km to Rohtang is nothing like 51 km of
 *      driving. We inflate by a factor that grows with distance.
 *   2. Speeds by mode that reflect hill roads, not motorways.
 */

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in metres. */
export function haversineMetres(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Straight-line to road distance. Short hops within a town are close to
 * direct; long mountain routes wind considerably.
 */
function windingFactor(straightMetres: number): number {
  if (straightMetres < 2_000) return 1.25;
  if (straightMetres < 10_000) return 1.45;
  if (straightMetres < 40_000) return 1.7;
  return 1.9;
}

/** Average speed in km/h on hill roads. */
const MODE_SPEED_KMH: Record<TransportMode, number> = {
  WALK: 4,
  AUTO_RICKSHAW: 18,
  SCOOTER: 22,
  TAXI: 25,
  CAR: 25,
  BUS: 20,
  TRAIN: 45,
  FLIGHT: 500,
};

/** Fixed overhead per journey: finding the vehicle, parking, boarding. */
const MODE_OVERHEAD_MINS: Record<TransportMode, number> = {
  WALK: 0,
  AUTO_RICKSHAW: 5,
  SCOOTER: 5,
  TAXI: 8,
  CAR: 8,
  BUS: 12,
  TRAIN: 30,
  FLIGHT: 120,
};

export interface EstimatedLeg {
  distanceMetres: number;
  durationMins: number;
}

/**
 * Estimate a single leg. Deterministic: the same two points always produce
 * the same answer, which is what makes the golden tests meaningful.
 */
export function estimateLeg(from: GeoPoint, to: GeoPoint, mode: TransportMode): EstimatedLeg {
  const straight = haversineMetres(from, to);
  if (straight === 0) return { distanceMetres: 0, durationMins: 0 };

  const roadMetres = Math.round(straight * windingFactor(straight));
  const speedKmh = MODE_SPEED_KMH[mode];
  const travelMins = (roadMetres / 1000 / speedKmh) * 60;

  return {
    distanceMetres: roadMetres,
    // Round up: a schedule built on optimistic travel times is the exact
    // failure mode this project exists to avoid.
    durationMins: Math.ceil(travelMins + MODE_OVERHEAD_MINS[mode]),
  };
}

/** Centroid of a set of points. Used for "close to most of your activities". */
export function centroid(points: readonly GeoPoint[]): GeoPoint | null {
  if (points.length === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / points.length, lng: lng / points.length };
}
