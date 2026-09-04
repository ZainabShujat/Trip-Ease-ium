import type { GeoPoint, Poi, TripBrief } from '@/lib/schemas';
import { CLUSTERING, PACE_PROFILES } from '../config';
import type { ClusterResult, DayFrame, ScoredPoi, Selections } from '../types';

/**
 * Geographic clustering: which POIs belong to which day.
 *
 * ── WHY NOT PLAIN k-MEANS ────────────────────────────────────────────────
 *
 * The architecture proposed k-means with k = number of days. k-means is the
 * right tool for the common case — POIs genuinely scattered around a valley,
 * more of them than there are days — but it is wrong or undefined in several
 * situations this engine actually meets, so it is one strategy of four rather
 * than the algorithm.
 *
 *   EMPTY           no POIs at all. Returns empty clusters; the scheduler
 *                   produces transport- and meal-only days rather than
 *                   failing. A trip with no sights is a poor trip, not an
 *                   invalid one.
 *
 *   ONE_PER_DAY     fewer POIs than days. k-means with k > n is undefined —
 *                   at least one centroid gets no points. We assign one POI
 *                   per day, best-scoring first, and leave the remaining days
 *                   free. Those days are reported in `notes`, not hidden.
 *
 *   SINGLE_CLUSTER  one usable day, or all POIs within a walkable radius.
 *                   Splitting a compact old town across "days" by coordinate
 *                   produces arbitrary boundaries between places two minutes
 *                   apart. Ordering is left entirely to the routing stage.
 *
 *   KMEANS          the general case.
 *
 * ── CAPACITY BALANCING ───────────────────────────────────────────────────
 *
 * Plain k-means optimises only for compactness, so a dense town centre can
 * absorb nine POIs while a far valley gets one. Capacity is derived from the
 * pace profile (`maxActivitiesPerDay`), and an overfull cluster donates its
 * points — the ones furthest from its own centroid, so the cluster stays
 * geographically tight — to the nearest cluster with room. Points that no
 * cluster can take are dropped and reported; the scheduler never receives a
 * day it cannot possibly fit.
 *
 * ── DETERMINISM ──────────────────────────────────────────────────────────
 *
 * Seeding is k-means++ style by *distance rank*, not by random draw: the
 * first centroid is the highest-scoring POI and each subsequent one is the
 * POI furthest from all chosen centroids, ties broken by id. Same input,
 * same clusters, every run.
 *
 * ── UNEVEN DISTRIBUTIONS ─────────────────────────────────────────────────
 *
 * With one tight group and one distant outlier, furthest-point seeding puts
 * a centroid on the outlier immediately, which is the desired behaviour: the
 * far place earns its own day rather than being tacked onto a full one.
 */

const EARTH_RADIUS_M = 6_371_000;

function haversineMetres(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function centroid(points: readonly GeoPoint[]): GeoPoint {
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

/** Radius below which a set of POIs is treated as one walkable area. */
const COMPACT_RADIUS_M = 1_500;

function isCompact(pois: readonly Poi[]): boolean {
  if (pois.length < 2) return true;
  const c = centroid(pois.map((p) => p.geo));
  return pois.every((p) => haversineMetres(c, p.geo) <= COMPACT_RADIUS_M);
}

// ---------------------------------------------------------------------------
// Deterministic k-means
// ---------------------------------------------------------------------------

/**
 * Furthest-point seeding. Deterministic, and spreads initial centroids so a
 * dense cluster does not capture several seeds while an outlier gets none.
 */
export function seedCentroids(pois: readonly Poi[], k: number): GeoPoint[] {
  if (pois.length === 0 || k <= 0) return [];
  const seeds: GeoPoint[] = [pois[0]!.geo]; // pois arrive score-ordered

  while (seeds.length < k && seeds.length < pois.length) {
    let best: { poi: Poi; distance: number } | null = null;
    for (const poi of pois) {
      if (seeds.some((s) => s.lat === poi.geo.lat && s.lng === poi.geo.lng)) continue;
      const nearest = Math.min(...seeds.map((s) => haversineMetres(s, poi.geo)));
      if (
        best === null ||
        nearest > best.distance ||
        (nearest === best.distance && poi.id.localeCompare(best.poi.id) < 0)
      ) {
        best = { poi, distance: nearest };
      }
    }
    if (!best) break;
    seeds.push(best.poi.geo);
  }
  return seeds;
}

export interface KMeansResult {
  assignments: number[];
  centroids: GeoPoint[];
  iterations: number;
}

export function kMeans(pois: readonly Poi[], k: number): KMeansResult {
  const centroids = seedCentroids(pois, k);
  const assignments = new Array<number>(pois.length).fill(0);
  let iterations = 0;

  for (; iterations < CLUSTERING.maxIterations; iterations += 1) {
    let changed = false;

    pois.forEach((poi, i) => {
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      centroids.forEach((c, ci) => {
        const d = haversineMetres(c, poi.geo);
        if (d < bestDistance) {
          bestDistance = d;
          bestIndex = ci;
        }
      });
      if (assignments[i] !== bestIndex) {
        assignments[i] = bestIndex;
        changed = true;
      }
    });

    let moved = 0;
    centroids.forEach((c, ci) => {
      const members = pois.filter((_, i) => assignments[i] === ci);
      if (members.length === 0) return; // keep an empty centroid where it is
      const next = centroid(members.map((m) => m.geo));
      moved = Math.max(moved, Math.abs(next.lat - c.lat) + Math.abs(next.lng - c.lng));
      centroids[ci] = next;
    });

    if (!changed && moved < CLUSTERING.convergenceEpsilon) break;
  }

  return { assignments, centroids, iterations };
}

// ---------------------------------------------------------------------------
// Capacity balancing
// ---------------------------------------------------------------------------

/**
 * Move POIs out of over-capacity clusters into the nearest cluster with room.
 *
 * Donors give up their furthest members first so each cluster stays compact.
 * Anything that finds no home is returned as `dropped` — reported to the
 * caller, never silently discarded.
 */
export function balanceCapacity(
  buckets: Poi[][],
  centroids: GeoPoint[],
  capacity: number,
): { buckets: Poi[][]; dropped: Poi[] } {
  const balanced = buckets.map((b) => [...b]);
  const dropped: Poi[] = [];

  for (let ci = 0; ci < balanced.length; ci += 1) {
    const bucket = balanced[ci]!;
    if (bucket.length <= capacity) continue;

    // Furthest from this cluster's own centre are the least "native" here.
    bucket.sort(
      (a, b) =>
        haversineMetres(centroids[ci]!, a.geo) - haversineMetres(centroids[ci]!, b.geo) ||
        a.id.localeCompare(b.id),
    );

    while (bucket.length > capacity) {
      const moving = bucket.pop()!;
      const target = balanced
        .map((b, i) => ({ index: i, bucket: b }))
        .filter((t) => t.index !== ci && t.bucket.length < capacity)
        .sort(
          (a, b) =>
            haversineMetres(centroids[a.index]!, moving.geo) -
              haversineMetres(centroids[b.index]!, moving.geo) || a.index - b.index,
        )[0];

      if (!target) {
        dropped.push(moving);
        continue;
      }
      target.bucket.push(moving);
    }
  }

  return { buckets: balanced, dropped };
}

// ---------------------------------------------------------------------------
// Stage entry point
// ---------------------------------------------------------------------------

/** Capacity per day, from the pace profile. */
export function dayCapacity(brief: TripBrief): number {
  return PACE_PROFILES[brief.pace].maxActivitiesPerDay;
}

/**
 * Assign shortlisted POIs to activity days.
 *
 * `frames` decides how many days are actually available: a day spent entirely
 * on an overnight bus is not a day you can put a temple in.
 */
export function runClusterStage(
  brief: TripBrief,
  selections: Selections,
  frames: readonly DayFrame[],
): ClusterResult {
  const activityDays = frames.filter((f) => f.isActivityDay);
  const notes: string[] = [];

  // Exclude eateries: meals are placed by the scheduler around the day's
  // shape, not clustered as destinations in their own right.
  const scoreOf = new Map(selections.scored.map((s: ScoredPoi) => [s.poi.id, s.score]));
  const sights = selections.shortlist
    .filter((p) => p.category !== 'RESTAURANT' && p.category !== 'CAFE')
    .sort(
      (a, b) => (scoreOf.get(b.id) ?? 0) - (scoreOf.get(a.id) ?? 0) || a.id.localeCompare(b.id),
    );

  if (activityDays.length === 0) {
    notes.push('No day has enough usable time for activities.');
    return { clusters: [], strategy: 'EMPTY', notes };
  }

  if (sights.length === 0) {
    notes.push('No sights available to schedule; days will hold transport and meals only.');
    return {
      clusters: activityDays.map((f) => ({
        dayIndex: f.dayIndex,
        poiIds: [],
        centroid: selections.lodging.geo,
      })),
      strategy: 'EMPTY',
      notes,
    };
  }

  const k = activityDays.length;
  const capacity = dayCapacity(brief);

  // --- fewer POIs than days -------------------------------------------------
  if (sights.length < k) {
    notes.push(
      `${sights.length} sights for ${k} activity days: one per day, ` +
        `${k - sights.length} day(s) left open.`,
    );
    return {
      clusters: activityDays.map((frame, i) => {
        const poi = sights[i];
        return {
          dayIndex: frame.dayIndex,
          poiIds: poi ? [poi.id] : [],
          centroid: poi ? poi.geo : selections.lodging.geo,
        };
      }),
      strategy: 'ONE_PER_DAY',
      notes,
    };
  }

  // --- one day, or everything within walking distance -----------------------
  if (k === 1 || isCompact(sights) || sights.length < CLUSTERING.minPoisForClustering) {
    if (k > 1 && isCompact(sights)) {
      notes.push(
        'All sights lie within a walkable radius; splitting them geographically ' +
          'would draw arbitrary boundaries. Distributed by score instead.',
      );
      // Round-robin by score keeps days comparable without pretending the
      // split is geographic.
      const buckets: Poi[][] = Array.from({ length: k }, () => []);
      sights.forEach((poi, i) => {
        const bucket = buckets[i % k]!;
        if (bucket.length < capacity) bucket.push(poi);
      });
      return {
        clusters: activityDays.map((frame, i) => {
          const members = buckets[i]!;
          return {
            dayIndex: frame.dayIndex,
            poiIds: members.map((m) => m.id),
            centroid: members.length ? centroid(members.map((m) => m.geo)) : selections.lodging.geo,
          };
        }),
        strategy: 'SCORE_ORDERED',
        notes,
      };
    }

    const members = sights.slice(0, capacity);
    if (members.length < sights.length) {
      notes.push(`${sights.length - members.length} sight(s) exceed the single day's capacity.`);
    }
    return {
      clusters: [
        {
          dayIndex: activityDays[0]!.dayIndex,
          poiIds: members.map((m) => m.id),
          centroid: centroid(members.map((m) => m.geo)),
        },
      ],
      strategy: 'SINGLE_CLUSTER',
      notes,
    };
  }

  // --- general case ---------------------------------------------------------
  const { assignments, centroids } = kMeans(sights, k);
  const buckets: Poi[][] = Array.from({ length: k }, () => []);
  sights.forEach((poi, i) => buckets[assignments[i]!]!.push(poi));

  const { buckets: balanced, dropped } = balanceCapacity(buckets, centroids, capacity);
  if (dropped.length > 0) {
    notes.push(
      `${dropped.length} sight(s) dropped: every day is at capacity for a ` +
        `${brief.pace.toLowerCase()} pace.`,
    );
  }

  // Assign the geographically tightest clusters to days, ordered by cluster
  // distance from the hotel so the trip does not zig-zag across the valley.
  const ordered = balanced
    .map((members, i) => ({
      members,
      centre: members.length ? centroid(members.map((m) => m.geo)) : centroids[i]!,
    }))
    .sort(
      (a, b) =>
        haversineMetres(selections.lodging.geo, a.centre) -
        haversineMetres(selections.lodging.geo, b.centre),
    );

  return {
    clusters: activityDays.map((frame, i) => {
      const bucket = ordered[i];
      return {
        dayIndex: frame.dayIndex,
        poiIds: bucket ? bucket.members.map((m) => m.id) : [],
        centroid: bucket ? bucket.centre : selections.lodging.geo,
      };
    }),
    strategy: 'KMEANS',
    notes,
  };
}
