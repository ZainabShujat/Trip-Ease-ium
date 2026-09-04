import { describe, expect, it } from 'vitest';
import { balanceCapacity, kMeans, runClusterStage, seedCentroids } from '@/engine/cluster';
import type { DayFrame, ScoredPoi, Selections } from '@/engine/types';
import { rupees } from '@/lib/money';
import { TripBriefSchema, type Poi, type TripBrief } from '@/lib/schemas';
import { MANALI_LODGING, MANALI_POIS } from '@/providers/mock/fixtures/delhi-manali';

/**
 * Geographic clustering.
 *
 * The interesting behaviour is not the happy path — it is the four strategies
 * and the capacity balancing, because that is where a naive k-means
 * implementation would produce a day with nine stops and another with none.
 */

function poiAt(id: string, lat: number, lng: number, category: Poi['category'] = 'SIGHT'): Poi {
  return {
    id,
    providerRef: id,
    name: id,
    category,
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

function brief(overrides: Record<string, unknown> = {}): TripBrief {
  return TripBriefSchema.parse({
    origin: { name: 'Delhi' },
    destination: { name: 'Manali', geo: { lat: 32.2432, lng: 77.1892 } },
    startDate: '2026-10-12',
    endDate: '2026-10-16',
    travellerCount: 2,
    budgetTotalMinor: rupees(40_000),
    ...overrides,
  });
}

/** Minimal Selections carrying only what clustering reads. */
function selectionsWith(pois: Poi[]): Selections {
  const lodging = {
    ...MANALI_LODGING[0]!,
    totalRateMinor: rupees(9000),
    roomsRequired: 1,
    link: null,
    provenance: {
      sourceKind: 'mock' as const,
      provider: 'test',
      fetchedAt: '2026-01-01T00:00:00+05:30',
      confidence: 'medium' as const,
    },
  };
  const scored: ScoredPoi[] = pois.map((poi, i) => ({
    poi,
    score: 1 - i * 0.01,
    components: { preferenceMatch: 1, quality: 1, proximity: 1, accessibility: 1 },
  }));
  return {
    outbound: {} as Selections['outbound'],
    inbound: {} as Selections['inbound'],
    local: [],
    lodging: lodging as unknown as Selections['lodging'],
    shortlist: pois,
    scored,
    alternatives: { transport: [], lodging: [] },
  };
}

function activityFrames(count: number): DayFrame[] {
  return Array.from({ length: count }, (_, i) => ({
    dayIndex: i,
    date: `2026-10-${String(12 + i).padStart(2, '0')}`,
    windowStartMins: 8 * 60,
    windowEndMins: 22 * 60,
    isArrivalDay: i === 0,
    isDepartureDay: i === count - 1,
    isActivityDay: true,
  }));
}

describe('deterministic seeding', () => {
  it('produces identical seeds across runs', () => {
    const pois = MANALI_POIS.slice(0, 10);
    expect(seedCentroids(pois, 4)).toEqual(seedCentroids(pois, 4));
  });

  it('spreads seeds rather than clustering them together', () => {
    // Furthest-point seeding must put a centroid on the outlier, not three
    // seeds inside one dense group.
    const pois = [
      poiAt('a', 32.24, 77.18),
      poiAt('b', 32.2401, 77.1801),
      poiAt('c', 32.2402, 77.1802),
      poiAt('far', 32.37, 77.25),
    ];
    const seeds = seedCentroids(pois, 2);
    expect(seeds).toHaveLength(2);
    expect(seeds.some((s) => s.lat > 32.3)).toBe(true);
  });

  it('never returns more seeds than there are POIs', () => {
    expect(seedCentroids([poiAt('a', 32.24, 77.18)], 5)).toHaveLength(1);
    expect(seedCentroids([], 3)).toHaveLength(0);
  });
});

describe('k-means', () => {
  it('assigns every POI to exactly one cluster', () => {
    const pois = MANALI_POIS.slice(0, 12);
    const { assignments } = kMeans(pois, 3);
    expect(assignments).toHaveLength(pois.length);
    expect(assignments.every((a) => a >= 0 && a < 3)).toBe(true);
  });

  it('separates two genuinely distinct groups', () => {
    const pois = [
      poiAt('n1', 32.36, 77.25),
      poiAt('n2', 32.361, 77.251),
      poiAt('s1', 32.11, 77.17),
      poiAt('s2', 32.111, 77.171),
    ];
    const { assignments } = kMeans(pois, 2);
    expect(assignments[0]).toBe(assignments[1]);
    expect(assignments[2]).toBe(assignments[3]);
    expect(assignments[0]).not.toBe(assignments[2]);
  });

  it('is deterministic', () => {
    const pois = MANALI_POIS.slice(0, 12);
    expect(kMeans(pois, 4).assignments).toEqual(kMeans(pois, 4).assignments);
  });
});

describe('capacity balancing', () => {
  it('moves overflow into a cluster with room', () => {
    const centroids = [
      { lat: 32.24, lng: 77.18 },
      { lat: 32.3, lng: 77.2 },
    ];
    const buckets = [
      [poiAt('a', 32.24, 77.18), poiAt('b', 32.241, 77.181), poiAt('c', 32.29, 77.199)],
      [poiAt('d', 32.3, 77.2)],
    ];
    const { buckets: balanced, dropped } = balanceCapacity(buckets, centroids, 2);
    expect(balanced[0]!.length).toBeLessThanOrEqual(2);
    expect(balanced[1]!.length).toBe(2);
    expect(dropped).toHaveLength(0);
  });

  it('reports what it could not place rather than dropping it silently', () => {
    const centroids = [{ lat: 32.24, lng: 77.18 }];
    const buckets = [[poiAt('a', 32.24, 77.18), poiAt('b', 32.25, 77.19), poiAt('c', 32.26, 77.2)]];
    const { buckets: balanced, dropped } = balanceCapacity(buckets, centroids, 1);
    expect(balanced[0]).toHaveLength(1);
    expect(dropped).toHaveLength(2);
  });

  it('leaves an under-capacity set untouched', () => {
    const centroids = [{ lat: 32.24, lng: 77.18 }];
    const buckets = [[poiAt('a', 32.24, 77.18)]];
    const { buckets: balanced, dropped } = balanceCapacity(buckets, centroids, 4);
    expect(balanced[0]).toHaveLength(1);
    expect(dropped).toHaveLength(0);
  });
});

describe('strategy selection', () => {
  it('uses ONE_PER_DAY when there are fewer POIs than days', () => {
    // k-means with k > n is undefined; at least one centroid gets no points.
    const pois = [poiAt('a', 32.24, 77.18), poiAt('b', 32.3, 77.2)];
    const result = runClusterStage(brief(), selectionsWith(pois), activityFrames(5));
    expect(result.strategy).toBe('ONE_PER_DAY');
    expect(result.clusters).toHaveLength(5);
    expect(result.clusters.filter((c) => c.poiIds.length > 0)).toHaveLength(2);
    expect(result.notes.join(' ')).toMatch(/left open/);
  });

  it('uses SINGLE_CLUSTER for a one-day trip', () => {
    const pois = MANALI_POIS.filter((p) => p.category === 'TEMPLE');
    const result = runClusterStage(brief(), selectionsWith(pois), activityFrames(1));
    expect(result.strategy).toBe('SINGLE_CLUSTER');
    expect(result.clusters).toHaveLength(1);
  });

  it('does not split a walkable cluster geographically', () => {
    // Four places within 300 m. Drawing "day" boundaries between neighbours
    // two minutes apart would be arbitrary.
    const pois = [
      poiAt('a', 32.2432, 77.1892),
      poiAt('b', 32.2434, 77.1894),
      poiAt('c', 32.2436, 77.1896),
      poiAt('d', 32.2438, 77.1898),
    ];
    const result = runClusterStage(brief(), selectionsWith(pois), activityFrames(3));
    expect(result.strategy).toBe('SCORE_ORDERED');
    expect(result.notes.join(' ')).toMatch(/walkable/);
  });

  it('uses KMEANS for genuinely spread POIs', () => {
    const result = runClusterStage(
      brief(),
      selectionsWith(
        MANALI_POIS.filter((p) => p.category !== 'CAFE' && p.category !== 'RESTAURANT'),
      ),
      activityFrames(4),
    );
    expect(result.strategy).toBe('KMEANS');
  });

  it('returns EMPTY, not a crash, when there is nothing to schedule', () => {
    const result = runClusterStage(brief(), selectionsWith([]), activityFrames(3));
    expect(result.strategy).toBe('EMPTY');
    expect(result.clusters).toHaveLength(3);
    expect(result.clusters.every((c) => c.poiIds.length === 0)).toBe(true);
  });

  it('returns EMPTY when no day is usable', () => {
    const result = runClusterStage(brief(), selectionsWith(MANALI_POIS), []);
    expect(result.strategy).toBe('EMPTY');
    expect(result.clusters).toHaveLength(0);
  });
});

describe('cluster invariants', () => {
  const sights = MANALI_POIS.filter((p) => p.category !== 'CAFE' && p.category !== 'RESTAURANT');

  it('never assigns a POI to two days', () => {
    const result = runClusterStage(brief(), selectionsWith(sights), activityFrames(4));
    const all = result.clusters.flatMap((c) => c.poiIds);
    expect(new Set(all).size).toBe(all.length);
  });

  it('never exceeds the pace capacity for a day', () => {
    const result = runClusterStage(
      brief({ pace: 'RELAXED' }),
      selectionsWith(sights),
      activityFrames(3),
    );
    for (const cluster of result.clusters) {
      expect(cluster.poiIds.length).toBeLessThanOrEqual(3); // RELAXED
    }
  });

  it('excludes eateries — meals are placed by the scheduler, not clustered', () => {
    const result = runClusterStage(brief(), selectionsWith(MANALI_POIS), activityFrames(4));
    const clustered = new Set(result.clusters.flatMap((c) => c.poiIds));
    const eateries = MANALI_POIS.filter(
      (p) => p.category === 'CAFE' || p.category === 'RESTAURANT',
    );
    for (const eatery of eateries) {
      expect(clustered.has(eatery.id), eatery.name).toBe(false);
    }
  });

  it('produces one cluster per activity day', () => {
    const frames = [
      ...activityFrames(3),
      {
        dayIndex: 3,
        date: '2026-10-15',
        windowStartMins: null,
        windowEndMins: null,
        isArrivalDay: false,
        isDepartureDay: false,
        isActivityDay: false,
      },
    ];
    const result = runClusterStage(brief(), selectionsWith(sights), frames);
    expect(result.clusters).toHaveLength(3);
    expect(result.clusters.map((c) => c.dayIndex)).toEqual([0, 1, 2]);
  });

  it('is deterministic', () => {
    const a = runClusterStage(brief(), selectionsWith(sights), activityFrames(4));
    const b = runClusterStage(brief(), selectionsWith(sights), activityFrames(4));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
