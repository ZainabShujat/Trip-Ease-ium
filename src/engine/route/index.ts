import type { GeoPoint, Poi } from '@/lib/schemas';
import { ROUTING } from '../config';
import type { TravelLookup } from '../matrix';

/**
 * Per-day route ordering.
 *
 * An open path, not a closed tour: the traveller starts at the hotel, visits
 * the day's POIs and ends wherever the last one is. Modelling it as a cycle
 * back to the hotel would optimise for a return leg the schedule does not
 * actually contain.
 *
 * Nearest-neighbour gives a decent seed in O(n²); 2-opt then removes the
 * crossings nearest-neighbour characteristically leaves behind. Days hold a
 * handful of stops, so exact methods would also be viable — the value of
 * 2-opt here is that its improvement is measurable, which is one of the
 * metrics this project reports.
 */

export interface RouteResult {
  /** POIs in visiting order. */
  ordered: Poi[];
  /** Travel minutes for the seeded nearest-neighbour path. */
  seedMins: number;
  /** Travel minutes after 2-opt. Never greater than `seedMins`. */
  optimisedMins: number;
  /** Minutes saved. Zero when 2-opt found nothing, never negative. */
  improvementMins: number;
  twoOptPasses: number;
  /** True when some leg was missing from the matrix and ordering fell back
   *  to the input order rather than guessing a distance. */
  incomplete: boolean;
}

/** Sum of legs from `start` through `path`, or null if any leg is unknown. */
export function pathDurationMins(
  start: GeoPoint,
  path: readonly Poi[],
  lookup: TravelLookup,
): number | null {
  let total = 0;
  let current = start;
  for (const poi of path) {
    const legMins = lookup.minutes(current, poi.geo);
    if (legMins === null) return null;
    total += legMins;
    current = poi.geo;
  }
  return total;
}

/** Greedy nearest-neighbour from `start`. Ties broken by id for determinism. */
export function nearestNeighbour(
  start: GeoPoint,
  pois: readonly Poi[],
  lookup: TravelLookup,
): Poi[] {
  const remaining = [...pois];
  const ordered: Poi[] = [];
  let current = start;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestMins = Number.POSITIVE_INFINITY;

    remaining.forEach((poi, i) => {
      const mins = lookup.minutes(current, poi.geo);
      if (mins === null) return;
      const incumbent = remaining[bestIndex]!;
      if (mins < bestMins || (mins === bestMins && poi.id.localeCompare(incumbent.id) < 0)) {
        bestMins = mins;
        bestIndex = i;
      }
    });

    const next = remaining.splice(bestIndex, 1)[0]!;
    ordered.push(next);
    current = next.geo;
  }

  return ordered;
}

/**
 * 2-opt improvement on an open path.
 *
 * Repeatedly reverses the segment [i, j] and keeps the reversal only when it
 * strictly reduces total travel. Because a move is accepted only on strict
 * improvement, the returned path is never worse than the input — asserted
 * directly in the tests.
 */
export function twoOpt(
  start: GeoPoint,
  path: readonly Poi[],
  lookup: TravelLookup,
): { path: Poi[]; passes: number } {
  if (path.length < 3) return { path: [...path], passes: 0 };

  let best = [...path];
  let bestMins = pathDurationMins(start, best, lookup);
  if (bestMins === null) return { path: best, passes: 0 };

  let passes = 0;
  let improved = true;

  while (improved && passes < ROUTING.maxTwoOptPasses) {
    improved = false;
    passes += 1;

    for (let i = 0; i < best.length - 1; i += 1) {
      for (let j = i + 1; j < best.length; j += 1) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        const candidateMins = pathDurationMins(start, candidate, lookup);
        if (candidateMins === null) continue;

        if (candidateMins < bestMins - ROUTING.minImprovementMins) {
          best = candidate;
          bestMins = candidateMins;
          improved = true;
        }
      }
    }
  }

  return { path: best, passes };
}

/** Seed with nearest-neighbour, then improve with 2-opt. */
export function optimiseDayRoute(
  start: GeoPoint,
  pois: readonly Poi[],
  lookup: TravelLookup,
): RouteResult {
  if (pois.length === 0) {
    return {
      ordered: [],
      seedMins: 0,
      optimisedMins: 0,
      improvementMins: 0,
      twoOptPasses: 0,
      incomplete: false,
    };
  }

  const seeded = nearestNeighbour(start, pois, lookup);
  const seedMins = pathDurationMins(start, seeded, lookup);

  // A missing leg means we cannot compare routes honestly. Keep the seeded
  // order and flag it, rather than optimising against invented distances.
  if (seedMins === null) {
    return {
      ordered: seeded,
      seedMins: 0,
      optimisedMins: 0,
      improvementMins: 0,
      twoOptPasses: 0,
      incomplete: true,
    };
  }

  const { path, passes } = twoOpt(start, seeded, lookup);
  const optimisedMins = pathDurationMins(start, path, lookup) ?? seedMins;

  return {
    ordered: path,
    seedMins,
    optimisedMins,
    improvementMins: Math.max(0, seedMins - optimisedMins),
    twoOptPasses: passes,
    incomplete: false,
  };
}
