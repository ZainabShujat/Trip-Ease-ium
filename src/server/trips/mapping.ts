import type { Prisma } from '@prisma/client';
import type { PlannedTrip } from '@/engine/types';
import type {
  BudgetSummary,
  ItineraryDay,
  LodgingOption,
  TransportOption,
  TripBrief,
} from '@/lib/schemas';

/**
 * Translating an engine plan into database rows.
 *
 * Deliberately pure functions rather than methods on a repository: the mapping
 * is where a plan quietly loses information — a dropped enum, a mangled money
 * unit, a lost link — and pure functions can be tested exhaustively with no
 * database, which is what keeps the Phase 2 offline guarantee intact.
 *
 * The repository does the writing; this module decides what gets written.
 */

// ---------------------------------------------------------------------------
// Enum bridges
//
// The domain uses lowercase provenance ('mock'), Prisma uses SCREAMING_CASE
// ('MOCK'). Bridging in one place keeps a typo from silently persisting the
// wrong provenance, which would let mock data render as live.
// ---------------------------------------------------------------------------

export const SOURCE_KIND_TO_DB = {
  live: 'LIVE',
  cached: 'CACHED',
  estimated: 'ESTIMATED',
  mock: 'MOCK',
} as const;

export const CONFIDENCE_TO_DB = {
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
} as const;

export type DbSourceKind = (typeof SOURCE_KIND_TO_DB)[keyof typeof SOURCE_KIND_TO_DB];
export type DbConfidence = (typeof CONFIDENCE_TO_DB)[keyof typeof CONFIDENCE_TO_DB];

/**
 * Normalise a value for a Prisma JSON column.
 *
 * Not merely a cast to satisfy the compiler: Prisma rejects `undefined` inside
 * JSON values, and our domain objects carry optional fields that are genuinely
 * absent. Round-tripping through JSON drops them, which is exactly the
 * semantics we want when storing a snapshot.
 */
export function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Calendar date to a UTC midnight Date, for Postgres `@db.Date` columns. */
export function toDbDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** Back the other way, for reading rows into domain shapes. */
export function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Trip header
// ---------------------------------------------------------------------------

export interface TripHeaderRow {
  title: string;
  originCity: string;
  originLat: number | null;
  originLng: number | null;
  destinationCity: string;
  destLat: number | null;
  destLng: number | null;
  startDate: Date;
  endDate: Date;
  travellerCount: number;
  budgetTotalMinor: number;
  currency: string;
}

export function tripHeaderFromBrief(brief: TripBrief, title?: string): TripHeaderRow {
  return {
    title: title?.trim() || `${brief.destination.name} trip`,
    originCity: brief.origin.name,
    originLat: brief.origin.geo?.lat ?? null,
    originLng: brief.origin.geo?.lng ?? null,
    destinationCity: brief.destination.name,
    destLat: brief.destination.geo?.lat ?? null,
    destLng: brief.destination.geo?.lng ?? null,
    startDate: toDbDate(brief.startDate),
    endDate: toDbDate(brief.endDate),
    travellerCount: brief.travellerCount,
    budgetTotalMinor: brief.budgetTotalMinor,
    currency: brief.currency,
  };
}

export function preferenceFromBrief(brief: TripBrief) {
  return {
    pace: brief.pace,
    wakeTime: brief.wakeTime,
    sleepTime: brief.sleepTime,
    interests: brief.interests,
    transportModes: brief.transportModes,
    avoidOvernightTransport: brief.avoidOvernightTransport,
    maxDailyTravelMins: brief.maxDailyTravelMins,
    lodgingTier: brief.lodgingTier,
    foodPrefs: brief.foodPrefs,
    constraints: brief.freeformConstraints,
    notes: brief.notes ?? null,
  };
}

export function travellersFromBrief(brief: TripBrief) {
  return brief.travellers.map((traveller, index) => ({
    name: traveller.name ?? `Traveller ${index + 1}`,
    ageBand: traveller.ageBand,
    accessibilityNeeds: traveller.accessibilityNeeds,
    dietary: traveller.dietary,
  }));
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export function transportOptionRow(option: TransportOption, isSelected: boolean) {
  return {
    direction: option.direction,
    mode: option.mode,
    operator: option.operator,
    fromName: option.fromName,
    toName: option.toName,
    departAt: option.departAt ? new Date(option.departAt) : null,
    arriveAt: option.arriveAt ? new Date(option.arriveAt) : null,
    durationMins: option.durationMins,
    pricePerPersonMinor: option.pricePerPersonMinor,
    comfortTier: option.comfortTier,
    archetype: option.archetype ?? null,
    score: option.score ?? null,
    rationale: option.rationale ?? null,
    bookingUrl: option.link?.url ?? null,
    providerRef: option.providerRef ?? null,
    provider: option.provenance.provider,
    sourceKind: SOURCE_KIND_TO_DB[option.provenance.sourceKind],
    confidence: CONFIDENCE_TO_DB[option.provenance.confidence],
    fetchedAt: new Date(option.provenance.fetchedAt),
    isSelected,
  };
}

export function lodgingOptionRow(option: LodgingOption, isSelected: boolean) {
  return {
    name: option.name,
    lat: option.geo.lat,
    lng: option.geo.lng,
    address: option.address ?? null,
    nightlyRateMinor: option.nightlyRateMinor,
    totalRateMinor: option.totalRateMinor,
    rating: option.rating ?? null,
    reviewCount: option.reviewCount ?? null,
    tier: option.tier,
    amenities: option.amenities,
    distanceToCentroidM: option.distanceToCentroidM ?? null,
    archetype: option.archetype ?? null,
    score: option.score ?? null,
    rationale: option.rationale ?? null,
    bookingUrl: option.link?.url ?? null,
    providerRef: option.providerRef ?? null,
    provider: option.provenance.provider,
    sourceKind: SOURCE_KIND_TO_DB[option.provenance.sourceKind],
    confidence: CONFIDENCE_TO_DB[option.provenance.confidence],
    fetchedAt: new Date(option.provenance.fetchedAt),
    isSelected,
  };
}

// ---------------------------------------------------------------------------
// Itinerary
// ---------------------------------------------------------------------------

export function itineraryDayRow(day: ItineraryDay) {
  return {
    dayIndex: day.dayIndex,
    date: toDbDate(day.date),
    summary: day.summary ?? null,
    clusterCentroidLat: day.clusterCentroid?.lat ?? null,
    clusterCentroidLng: day.clusterCentroid?.lng ?? null,
    totalCostMinor: day.totalCostMinor,
    totalTravelMins: day.totalTravelMins,
  };
}

export function itineraryItemRows(day: ItineraryDay, poiIdByDomainId: Map<string, string>) {
  return day.items.map((item) => ({
    seq: item.seq,
    title: item.title,
    category: item.category,
    startTime: item.startTime,
    endTime: item.endTime,
    durationMins: item.durationMins,
    // Only link to a Poi row that actually exists; the fixture's domain ids
    // are not database ids.
    poiId: item.poiId ? (poiIdByDomainId.get(item.poiId) ?? null) : null,
    lat: item.geo?.lat ?? null,
    lng: item.geo?.lng ?? null,
    estimatedCostMinor: item.estimatedCostMinor,
    travelMinsFromPrev: item.travelFromPrev?.durationMins ?? null,
    travelDistanceM: item.travelFromPrev?.distanceMetres ?? null,
    transportModeFromPrev: item.travelFromPrev?.mode ?? null,
    externalUrl: item.link?.url ?? null,
    notes: item.notes ?? null,
    bookingStatus: item.bookingStatus,
    isLocked: item.isLocked,
  }));
}

export function budgetLineRows(budget: BudgetSummary) {
  return budget.lines.map((line) => ({
    category: line.category,
    allocatedMinor: line.allocatedMinor,
    estimatedMinor: line.estimatedMinor,
    actualMinor: line.actualMinor,
  }));
}

// ---------------------------------------------------------------------------
// Readiness tasks
// ---------------------------------------------------------------------------

/**
 * Seed the readiness checklist from what the plan actually selected.
 *
 * Generated rather than typed by the user, and only for things that genuinely
 * need doing: a bus with a booking link becomes a booking task, a permit-only
 * POI becomes a permit task. Inventing generic "pack your bags" rows would
 * make the progress indicator meaningless.
 */
export function taskRowsFor(plan: PlannedTrip) {
  const tasks: Array<{ label: string; kind: string; seq: number; autoGenerated: boolean }> = [];
  let seq = 0;

  tasks.push({
    label: `Book outbound travel: ${plan.selections.outbound.operator}`,
    kind: 'BOOKING',
    seq: seq++,
    autoGenerated: true,
  });
  tasks.push({
    label: `Book return travel: ${plan.selections.inbound.operator}`,
    kind: 'BOOKING',
    seq: seq++,
    autoGenerated: true,
  });
  tasks.push({
    label: `Reserve ${plan.selections.lodging.name}`,
    kind: 'BOOKING',
    seq: seq++,
    autoGenerated: true,
  });

  // Permit-controlled places are a real Indian travel constraint and easy to
  // forget until you are turned back at a checkpoint.
  const permitPois = plan.selections.shortlist.filter((poi) =>
    poi.tags.some((tag) => tag.toLowerCase().includes('permit')),
  );
  const scheduledIds = new Set(
    plan.days.flatMap((day) => day.items.map((item) => item.poiId).filter(Boolean)),
  );
  for (const poi of permitPois) {
    if (!scheduledIds.has(poi.id)) continue;
    tasks.push({
      label: `Arrange the permit for ${poi.name}`,
      kind: 'PERMIT',
      seq: seq++,
      autoGenerated: true,
    });
  }

  tasks.push({
    label: 'Carry photo ID for every traveller',
    kind: 'DOCUMENT',
    seq: seq++,
    autoGenerated: true,
  });

  return tasks;
}

/**
 * The snapshot stored on TripVersion.
 *
 * The whole plan, so a version can be restored or diffed. Deliberately the one
 * JSON blob in the schema — history lives here, the live trip lives in the
 * normalised tables.
 */
export function snapshotFor(plan: PlannedTrip) {
  return {
    brief: plan.brief,
    selections: plan.selections,
    clusters: plan.clusters,
    days: plan.days,
    budget: plan.budget,
    validation: plan.validation,
    relaxedConstraints: plan.relaxedConstraints,
    unplaced: plan.unplaced,
    clusterStrategy: plan.clusterStrategy,
    overallSourceKind: plan.overallSourceKind,
  };
}
