import { describe, expect, it } from 'vitest';
import { createTravelLookup } from '@/engine/matrix';
import { nearestNeighbour, optimiseDayRoute, pathDurationMins, twoOpt } from '@/engine/route';
import type { GeoPoint, Poi, TravelMatrix } from '@/lib/schemas';
import { MANALI_POIS } from '@/providers/mock/fixtures/delhi-manali';
import { estimateLeg } from '@/providers/mock/geo';

/**
 * Route optimisation.
 *
 * The headline property is that 2-opt never returns a worse route than its
 * input. Everything else here supports that claim or guards a case where the
 * optimiser could quietly produce nonsense.
 */

function matrixFor(points: readonly GeoPoint[]): TravelMatrix {
  return {
    points: [...points],
    mode: 'CAR',
    durationMins: points.map((from) =>
      points.map((to) => estimateLeg(from, to, 'CAR').durationMins),
    ),
    distanceMetres: points.map((from) =>
      points.map((to) => estimateLeg(from, to, 'CAR').distanceMetres),
    ),
    provenance: {
      sourceKind: 'estimated',
      provider: 'test',
      fetchedAt: '2026-01-01T00:00:00+05:30',
      confidence: 'low',
    },
  };
}

function poiAt(id: string, lat: number, lng: number): Poi {
  return {
    id,
    providerRef: id,
    name: id,
    category: 'SIGHT',
    geo: { lat, lng },
    typicalDurationMins: 60,
    typicalCostPerPersonMinor: 0,
    openingHours: { kind: 'always' },
    tags: [],
    provenance: {
      sourceKind: 'mock',
      provider: 'test',
      fetchedAt: '2026-01-01T00:00:00+05:30',
      confidence: 'medium',
    },
  };
}

const HOTEL: GeoPoint = { lat: 32.2432, lng: 77.1892 };

describe('2-opt', () => {
  it('never returns a route worse than its input', () => {
    // The core guarantee. Asserted across many shapes, including deliberately
    // awful starting orders, because "usually improves" is not good enough for
    // something that silently reorders a traveller's day.
    const shapes: Poi[][] = [
      // A crossing path — the classic case 2-opt exists to fix.
      [
        poiAt('a', 32.24, 77.18),
        poiAt('b', 32.28, 77.22),
        poiAt('c', 32.25, 77.18),
        poiAt('d', 32.29, 77.22),
      ],
      // Collinear, already optimal.
      [
        poiAt('a', 32.24, 77.18),
        poiAt('b', 32.25, 77.18),
        poiAt('c', 32.26, 77.18),
        poiAt('d', 32.27, 77.18),
      ],
      // Reverse-optimal order.
      [
        poiAt('d', 32.27, 77.18),
        poiAt('c', 32.26, 77.18),
        poiAt('b', 32.25, 77.18),
        poiAt('a', 32.24, 77.18),
      ],
      // A far outlier among a tight group.
      [
        poiAt('a', 32.24, 77.18),
        poiAt('far', 32.37, 77.25),
        poiAt('b', 32.245, 77.181),
        poiAt('c', 32.246, 77.182),
      ],
    ];

    for (const pois of shapes) {
      const lookup = createTravelLookup(matrixFor([HOTEL, ...pois.map((p) => p.geo)]));
      const before = pathDurationMins(HOTEL, pois, lookup)!;
      const { path } = twoOpt(HOTEL, pois, lookup);
      const after = pathDurationMins(HOTEL, path, lookup)!;
      expect(after, `shape ${pois.map((p) => p.id).join(',')}`).toBeLessThanOrEqual(before);
    }
  });

  it('preserves the exact set of stops', () => {
    // Reordering must never drop or duplicate a place.
    const pois = [
      poiAt('a', 32.24, 77.18),
      poiAt('b', 32.28, 77.22),
      poiAt('c', 32.25, 77.18),
      poiAt('d', 32.29, 77.22),
    ];
    const lookup = createTravelLookup(matrixFor([HOTEL, ...pois.map((p) => p.geo)]));
    const { path } = twoOpt(HOTEL, pois, lookup);
    expect(path).toHaveLength(pois.length);
    expect(new Set(path.map((p) => p.id))).toEqual(new Set(pois.map((p) => p.id)));
  });

  it('actually improves a crossing route', () => {
    // If this never improved anything, the "never worse" guarantee would be
    // trivially satisfied by doing nothing.
    const pois = [
      poiAt('a', 32.24, 77.18),
      poiAt('b', 32.3, 77.24),
      poiAt('c', 32.245, 77.182),
      poiAt('d', 32.305, 77.242),
    ];
    const lookup = createTravelLookup(matrixFor([HOTEL, ...pois.map((p) => p.geo)]));
    const before = pathDurationMins(HOTEL, pois, lookup)!;
    const { path } = twoOpt(HOTEL, pois, lookup);
    const after = pathDurationMins(HOTEL, path, lookup)!;
    expect(after).toBeLessThan(before);
  });

  it('is a no-op below three stops', () => {
    const pois = [poiAt('a', 32.24, 77.18), poiAt('b', 32.25, 77.19)];
    const lookup = createTravelLookup(matrixFor([HOTEL, ...pois.map((p) => p.geo)]));
    const { path, passes } = twoOpt(HOTEL, pois, lookup);
    expect(passes).toBe(0);
    expect(path.map((p) => p.id)).toEqual(['a', 'b']);
  });
});

describe('nearest neighbour', () => {
  it('visits the closest unvisited stop each time', () => {
    const pois = [
      poiAt('far', 32.32, 77.15),
      poiAt('near', 32.2445, 77.1885),
      poiAt('mid', 32.26, 77.19),
    ];
    const lookup = createTravelLookup(matrixFor([HOTEL, ...pois.map((p) => p.geo)]));
    expect(nearestNeighbour(HOTEL, pois, lookup).map((p) => p.id)).toEqual(['near', 'mid', 'far']);
  });

  it('returns every stop exactly once', () => {
    const pois = MANALI_POIS.slice(0, 6);
    const lookup = createTravelLookup(matrixFor([HOTEL, ...pois.map((p) => p.geo)]));
    const ordered = nearestNeighbour(HOTEL, pois, lookup);
    expect(new Set(ordered.map((p) => p.id)).size).toBe(pois.length);
  });
});

describe('optimiseDayRoute', () => {
  it('reports a non-negative improvement and a consistent total', () => {
    const pois = MANALI_POIS.filter((p) => p.category !== 'CAFE').slice(0, 5);
    const lookup = createTravelLookup(matrixFor([HOTEL, ...pois.map((p) => p.geo)]));
    const result = optimiseDayRoute(HOTEL, pois, lookup);

    expect(result.improvementMins).toBeGreaterThanOrEqual(0);
    expect(result.optimisedMins).toBeLessThanOrEqual(result.seedMins);
    expect(result.seedMins - result.optimisedMins).toBe(result.improvementMins);
    expect(pathDurationMins(HOTEL, result.ordered, lookup)).toBe(result.optimisedMins);
  });

  it('handles an empty day', () => {
    const lookup = createTravelLookup(matrixFor([HOTEL]));
    const result = optimiseDayRoute(HOTEL, [], lookup);
    expect(result.ordered).toEqual([]);
    expect(result.improvementMins).toBe(0);
    expect(result.incomplete).toBe(false);
  });

  it('flags an incomplete matrix instead of inventing distances', () => {
    // A POI missing from the matrix must not be silently treated as adjacent.
    const known = poiAt('known', 32.25, 77.19);
    const unknown = poiAt('unknown', 32.4, 77.4);
    const lookup = createTravelLookup(matrixFor([HOTEL, known.geo]));
    const result = optimiseDayRoute(HOTEL, [known, unknown], lookup);
    expect(result.incomplete).toBe(true);
    expect(result.ordered).toHaveLength(2);
  });

  it('is deterministic across repeated runs', () => {
    const pois = MANALI_POIS.slice(0, 7);
    const lookup = createTravelLookup(matrixFor([HOTEL, ...pois.map((p) => p.geo)]));
    const a = optimiseDayRoute(HOTEL, pois, lookup);
    const b = optimiseDayRoute(HOTEL, pois, lookup);
    expect(a.ordered.map((p) => p.id)).toEqual(b.ordered.map((p) => p.id));
  });
});

describe('travel lookup', () => {
  it('returns null for a point outside the matrix rather than zero', () => {
    // Returning 0 would declare two places adjacent and produce exactly the
    // impossible itinerary the project exists to prevent.
    const lookup = createTravelLookup(matrixFor([HOTEL, { lat: 32.25, lng: 77.19 }]));
    expect(lookup.minutes(HOTEL, { lat: 1, lng: 1 })).toBeNull();
    expect(lookup.has(HOTEL, { lat: 1, lng: 1 })).toBe(false);
  });

  it('has a zero diagonal', () => {
    const lookup = createTravelLookup(matrixFor([HOTEL, { lat: 32.25, lng: 77.19 }]));
    expect(lookup.minutes(HOTEL, HOTEL)).toBe(0);
  });
});
