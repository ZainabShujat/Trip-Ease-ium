import type { GeoPoint, TravelMatrix } from '@/lib/schemas';

/**
 * Travel-matrix lookup.
 *
 * `TravelMatrix` is indexed by position in its `points` array, which is the
 * right shape for a provider to return but the wrong shape for a scheduler
 * that thinks in POI ids. This wraps it with an id-keyed lookup and a
 * documented fallback.
 *
 * The fallback matters: if a caller asks for a pair the matrix does not
 * contain, returning 0 would silently declare two places adjacent and produce
 * exactly the impossible itinerary this project exists to prevent. Instead the
 * lookup reports the miss, and the validator turns an unresolved pair into a
 * MISSING_COORDINATES violation.
 */

const COORD_PRECISION = 5;

function key(point: GeoPoint): string {
  return `${point.lat.toFixed(COORD_PRECISION)},${point.lng.toFixed(COORD_PRECISION)}`;
}

export interface TravelLookup {
  /** Minutes between two points, or null when the pair is not in the matrix. */
  minutes(from: GeoPoint, to: GeoPoint): number | null;
  /** Metres between two points, or null when the pair is not in the matrix. */
  metres(from: GeoPoint, to: GeoPoint): number | null;
  /** True when both points are present in the matrix. */
  has(from: GeoPoint, to: GeoPoint): boolean;
  readonly size: number;
}

export function createTravelLookup(matrix: TravelMatrix): TravelLookup {
  const index = new Map<string, number>();
  matrix.points.forEach((point, i) => {
    // First writer wins, so a duplicated coordinate resolves consistently.
    if (!index.has(key(point))) index.set(key(point), i);
  });

  const cell = (from: GeoPoint, to: GeoPoint, grid: number[][]): number | null => {
    const i = index.get(key(from));
    const j = index.get(key(to));
    if (i === undefined || j === undefined) return null;
    return grid[i]?.[j] ?? null;
  };

  return {
    minutes: (from, to) => cell(from, to, matrix.durationMins),
    metres: (from, to) => cell(from, to, matrix.distanceMetres),
    has: (from, to) => index.has(key(from)) && index.has(key(to)),
    size: index.size,
  };
}

/**
 * Total travel minutes for a tour visiting `points` in order.
 * Returns null if any leg is missing, rather than quietly skipping it.
 */
export function tourDurationMins(
  points: readonly GeoPoint[],
  lookup: TravelLookup,
): number | null {
  let total = 0;
  for (let i = 0; i + 1 < points.length; i += 1) {
    const legMins = lookup.minutes(points[i]!, points[i + 1]!);
    if (legMins === null) return null;
    total += legMins;
  }
  return total;
}
