import { dayCountBetween } from '@/lib/schemas';
import type { GeoPoint, LodgingOption, Poi, TransportOption, TripBrief } from '@/lib/schemas';
import {
  ACCESSIBILITY_EXCLUSIONS,
  INTEREST_CATEGORIES,
  INTEREST_TAGS,
  RATING_CONFIDENCE_REVIEWS,
  SCORING_WEIGHTS,
} from '../config';
import type { ScoredPoi, SourcedCandidates, Selections } from '../types';

/**
 * Candidate scoring.
 *
 * A weighted sum of normalised components. Every component returns 0..1 so the
 * weights in config.ts are directly comparable and a total score means the
 * same thing across categories.
 *
 * Ties are broken by id throughout. Without that, two equally good hotels
 * could swap places between runs depending on array order, and the golden
 * tests would be measuring luck.
 */

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

/** Rating normalised to 0..1, damped by how many reviews back it up. */
export function qualityScore(rating?: number, reviewCount?: number): number {
  if (rating === undefined) return 0.5; // unknown is neutral, not bad
  const normalised = Math.max(0, Math.min(1, rating / 5));
  const confidence = Math.min(1, (reviewCount ?? 0) / RATING_CONFIDENCE_REVIEWS);
  // Pull an unbacked rating toward the neutral midpoint.
  return 0.5 + (normalised - 0.5) * (0.4 + 0.6 * confidence);
}

/**
 * How well a price fits the available budget.
 *
 * Peaks at 1 when the price sits comfortably inside the envelope, falls to 0
 * at twice the envelope. Deliberately does not reward "cheapest" outright —
 * the cheapest option is offered as its own archetype, and a scoring function
 * that always preferred the floor would make the Balanced archetype pointless.
 */
export function priceFitScore(priceMinor: number, envelopeMinor: number): number {
  if (envelopeMinor <= 0) return 0;
  const ratio = priceMinor / envelopeMinor;
  if (ratio <= 0.5) return 0.85; // suspiciously cheap: good, not ideal
  if (ratio <= 1) return 1 - (ratio - 0.5) * 0.3; // 1.0 .. 0.85 sweet spot
  if (ratio <= 2) return Math.max(0, 0.85 - (ratio - 1) * 0.85);
  return 0;
}

/** Closeness on a soft curve: 1 at zero metres, ~0 beyond `farMetres`. */
export function proximityScore(distanceMetres: number, farMetres: number): number {
  if (farMetres <= 0) return 0;
  return Math.max(0, 1 - distanceMetres / farMetres);
}

function haversineMetres(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function centroidOf(points: readonly GeoPoint[]): GeoPoint | null {
  if (points.length === 0) return null;
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

// ---------------------------------------------------------------------------
// POI scoring
// ---------------------------------------------------------------------------

/**
 * Fraction of the traveller's interests this POI serves.
 *
 * A POI matching two of four stated interests scores 0.5. With no interests
 * stated, everything scores 0.5 — neutral, so ranking falls to quality and
 * proximity rather than collapsing to zero.
 */
export function preferenceMatchScore(poi: Poi, interests: readonly string[]): number {
  if (interests.length === 0) return 0.5;
  const tags = poi.tags.map((t) => t.toLowerCase());

  let matched = 0;
  for (const interest of interests) {
    const wanted = INTEREST_TAGS[interest as keyof typeof INTEREST_TAGS] ?? [];
    const categories = INTEREST_CATEGORIES[interest as keyof typeof INTEREST_CATEGORIES] ?? [];
    const tagHit = wanted.some((w) => tags.some((t) => t.includes(w)));
    const categoryHit = (categories as readonly string[]).includes(poi.category);
    if (tagHit || categoryHit) matched += 1;
  }
  return matched / interests.length;
}

/**
 * Accessibility suitability. Returns 0 and an exclusion reason when the POI is
 * genuinely unsuitable — "one traveller cannot walk long distances" must
 * remove the trek, not merely rank it lower.
 */
export function accessibilityScore(
  poi: Poi,
  needs: readonly string[],
): { score: number; excludedBy?: string } {
  if (needs.length === 0) return { score: 1 };
  const tags = poi.tags.map((t) => t.toLowerCase());

  for (const need of needs) {
    const blocked = ACCESSIBILITY_EXCLUSIONS[need as keyof typeof ACCESSIBILITY_EXCLUSIONS];
    if (!blocked) continue;
    const hit = blocked.find((b) => tags.some((t) => t.includes(b)));
    if (hit) return { score: 0, excludedBy: `${need}: ${hit}` };
  }
  return { score: 1 };
}

export function scorePois(
  pois: readonly Poi[],
  brief: TripBrief,
  destinationCentre: GeoPoint,
): ScoredPoi[] {
  const needs = brief.travellers.flatMap((t) => t.accessibilityNeeds);
  const weights = SCORING_WEIGHTS.poi;
  const farMetres = 40_000;

  return pois
    .map((poi) => {
      const preferenceMatch = preferenceMatchScore(poi, brief.interests);
      const quality = qualityScore(poi.rating, poi.reviewCount);
      const proximity = proximityScore(haversineMetres(destinationCentre, poi.geo), farMetres);
      const access = accessibilityScore(poi, needs);

      const score =
        access.score === 0
          ? 0
          : preferenceMatch * weights.preferenceMatch +
            quality * weights.quality +
            proximity * weights.proximity +
            access.score * weights.accessibility;

      const scored: ScoredPoi = {
        poi,
        score,
        components: { preferenceMatch, quality, proximity, accessibility: access.score },
      };
      if (access.excludedBy) scored.excludedBy = access.excludedBy;
      return scored;
    })
    .sort((a, b) => b.score - a.score || a.poi.id.localeCompare(b.poi.id));
}

// ---------------------------------------------------------------------------
// Transport scoring
// ---------------------------------------------------------------------------

const COMFORT_VALUE = { BASIC: 0.35, STANDARD: 0.7, PREMIUM: 1 } as const;

export function scoreTransport(
  option: TransportOption,
  brief: TripBrief,
  envelopePerPersonMinor: number,
  slowestMins: number,
): number {
  const w = SCORING_WEIGHTS.transport;
  const priceFit = priceFitScore(option.pricePerPersonMinor, envelopePerPersonMinor);
  const speed = slowestMins > 0 ? 1 - option.durationMins / slowestMins : 0.5;
  const comfort = COMFORT_VALUE[option.comfortTier];

  let preference = 1;
  if (brief.avoidOvernightTransport && option.isOvernight) preference = 0;
  else if (brief.transportModes.length > 0 && !brief.transportModes.includes(option.mode)) {
    preference = 0.3;
  }

  return priceFit * w.priceFit + speed * w.speed + comfort * w.comfort + preference * w.preferenceMatch;
}

/**
 * Pick the three transport archetypes.
 *
 * Cheapest and Fastest are the extremes of the Pareto front on price and
 * duration; Balanced is the highest weighted score. Where the same service
 * wins two archetypes it appears once, labelled with the first it earned —
 * showing the same bus three times under different headings would be
 * theatre, not choice.
 */
export function pickTransportArchetypes(
  options: readonly TransportOption[],
  brief: TripBrief,
  envelopePerPersonMinor: number,
): TransportOption[] {
  if (options.length === 0) return [];

  const slowest = Math.max(...options.map((o) => o.durationMins));
  const scored = options.map((o) => ({
    option: o,
    score: scoreTransport(o, brief, envelopePerPersonMinor, slowest),
  }));

  const byPrice = [...scored].sort(
    (a, b) =>
      a.option.pricePerPersonMinor - b.option.pricePerPersonMinor ||
      a.option.id.localeCompare(b.option.id),
  );
  const byDuration = [...scored].sort(
    (a, b) => a.option.durationMins - b.option.durationMins || a.option.id.localeCompare(b.option.id),
  );
  const byScore = [...scored].sort(
    (a, b) => b.score - a.score || a.option.id.localeCompare(b.option.id),
  );

  const picked: TransportOption[] = [];
  const claim = (
    candidate: { option: TransportOption; score: number } | undefined,
    archetype: 'CHEAPEST' | 'BALANCED' | 'FASTEST',
  ) => {
    if (!candidate) return;
    if (picked.some((p) => p.providerRef === candidate.option.providerRef)) return;
    picked.push({ ...candidate.option, archetype, score: candidate.score });
  };

  claim(byScore[0], 'BALANCED');
  claim(byPrice[0], 'CHEAPEST');
  claim(byDuration[0], 'FASTEST');

  return picked.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// Lodging scoring
// ---------------------------------------------------------------------------

export function scoreLodging(
  option: LodgingOption,
  brief: TripBrief,
  envelopeMinor: number,
  poiCentroid: GeoPoint | null,
): number {
  const w = SCORING_WEIGHTS.lodging;
  const priceFit = priceFitScore(option.totalRateMinor, envelopeMinor);
  const quality = qualityScore(option.rating, option.reviewCount);
  const proximity = poiCentroid
    ? proximityScore(haversineMetres(poiCentroid, option.geo), 15_000)
    : 0.5;
  const tierMatch = option.tier === brief.lodgingTier ? 1 : 0.4;

  return priceFit * w.priceFit + quality * w.quality + proximity * w.proximity + tierMatch * w.tierMatch;
}

export function pickLodgingArchetypes(
  options: readonly LodgingOption[],
  brief: TripBrief,
  envelopeMinor: number,
  poiCentroid: GeoPoint | null,
): LodgingOption[] {
  if (options.length === 0) return [];

  const scored = options.map((o) => ({
    option: o,
    score: scoreLodging(o, brief, envelopeMinor, poiCentroid),
    distance: poiCentroid ? Math.round(haversineMetres(poiCentroid, o.geo)) : undefined,
  }));

  const byPrice = [...scored].sort(
    (a, b) => a.option.totalRateMinor - b.option.totalRateMinor || a.option.id.localeCompare(b.option.id),
  );
  const byScore = [...scored].sort((a, b) => b.score - a.score || a.option.id.localeCompare(b.option.id));
  const byPremium = [...scored].sort(
    (a, b) => b.option.totalRateMinor - a.option.totalRateMinor || a.option.id.localeCompare(b.option.id),
  );

  const picked: LodgingOption[] = [];
  const claim = (
    candidate: (typeof scored)[number] | undefined,
    archetype: 'BUDGET' | 'BEST_OVERALL' | 'PREMIUM',
  ) => {
    if (!candidate) return;
    if (picked.some((p) => p.id === candidate.option.id)) return;
    const next: LodgingOption = { ...candidate.option, archetype, score: candidate.score };
    if (candidate.distance !== undefined) next.distanceToCentroidM = candidate.distance;
    picked.push(next);
  };

  claim(byScore[0], 'BEST_OVERALL');
  claim(byPrice[0], 'BUDGET');
  claim(byPremium[0], 'PREMIUM');

  return picked.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// Stage entry point
// ---------------------------------------------------------------------------

export interface ScoreOptions {
  /** Cap on shortlisted POIs. Defaults to enough for the trip length. */
  shortlistLimit?: number;
}

/**
 * Runs the full scoring stage.
 *
 * Order matters: POIs are scored first so their centroid can inform lodging
 * proximity. Choosing a hotel before knowing where the traveller is going is
 * how you end up 12 km from everything.
 */
export function runScoreStage(
  brief: TripBrief,
  candidates: SourcedCandidates,
  options: ScoreOptions = {},
): Selections | null {
  const destinationCentre =
    brief.destination.geo ?? centroidOf(candidates.pois.map((p) => p.geo)) ?? { lat: 0, lng: 0 };

  const scored = scorePois(candidates.pois, brief, destinationCentre);
  const eligible = scored.filter((s) => s.excludedBy === undefined);

  const days = dayCountBetween(brief.startDate, brief.endDate);
  const shortlistLimit = options.shortlistLimit ?? Math.max(6, days * 5);
  const shortlistScored = eligible.slice(0, shortlistLimit);
  const shortlist = shortlistScored.map((s) => s.poi);

  const poiCentroid = centroidOf(shortlist.map((p) => p.geo));

  // Envelopes: what each category may spend, from the allocation policy.
  const transportEnvelopePerPerson = Math.floor(
    (brief.budgetTotalMinor * 0.28) / brief.travellerCount / 2,
  );
  const lodgingEnvelope = Math.floor(brief.budgetTotalMinor * 0.35);

  const outboundPicks = pickTransportArchetypes(
    candidates.outboundTransport,
    brief,
    transportEnvelopePerPerson,
  );
  const returnPicks = pickTransportArchetypes(
    candidates.returnTransport,
    brief,
    transportEnvelopePerPerson,
  );
  const lodgingPicks = pickLodgingArchetypes(
    candidates.lodging,
    brief,
    lodgingEnvelope,
    poiCentroid,
  );

  const outbound = outboundPicks[0];
  const inbound = returnPicks[0];
  const lodging = lodgingPicks[0];

  // Without transport in both directions and somewhere to sleep there is no
  // trip to plan. The caller turns this into NO_CANDIDATES.
  if (!outbound || !inbound || !lodging) return null;

  return {
    outbound,
    inbound,
    local: [...candidates.localTransport],
    lodging,
    shortlist,
    scored: shortlistScored,
    alternatives: {
      transport: [...outboundPicks, ...returnPicks],
      lodging: lodgingPicks,
    },
  };
}
