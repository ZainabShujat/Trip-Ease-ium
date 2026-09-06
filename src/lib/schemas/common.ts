import { z } from 'zod';

/**
 * Primitives shared by every other schema.
 *
 * Zod is the single source of truth: schemas are declared here and the
 * TypeScript types are inferred from them. There is no parallel hand-written
 * interface to drift out of sync.
 */

// ---------------------------------------------------------------------------
// Scalars
// ---------------------------------------------------------------------------

/** Calendar date, `YYYY-MM-DD`. No timezone — a trip's dates are local dates. */
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a YYYY-MM-DD date');
export type IsoDate = z.infer<typeof IsoDateSchema>;

/** Instant, ISO 8601 with offset. Used for departures and arrivals. */
export const IsoDateTimeSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
    'expected an ISO 8601 datetime with offset',
  );
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

/**
 * Local wall-clock time at the destination, `HH:MM`, 24-hour.
 *
 * The scheduler works in local minutes-from-midnight rather than instants.
 * "10:30 at Hadimba Temple" is a fact about the day, and attaching a timezone
 * to it is how planners end up shifting a whole itinerary by a day.
 */
export const TimeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected an HH:MM 24-hour time');
export type TimeOfDay = z.infer<typeof TimeOfDaySchema>;

/** Integer minor currency units (paise). See src/lib/money.ts. */
export const MinorAmountSchema = z
  .number()
  .int('money must be an integer number of minor units (paise)')
  .nonnegative();

export const CurrencySchema = z.enum(['INR', 'USD', 'EUR', 'GBP']);
export type Currency = z.infer<typeof CurrencySchema>;

export const DurationMinsSchema = z.number().int().nonnegative();
export const DistanceMetresSchema = z.number().int().nonnegative();

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------

export const GeoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof GeoPointSchema>;

export const PlaceRefSchema = z.object({
  name: z.string().min(1),
  geo: GeoPointSchema.optional(),
});
export type PlaceRef = z.infer<typeof PlaceRefSchema>;

// ---------------------------------------------------------------------------
// Provenance — the honesty mechanism
// ---------------------------------------------------------------------------

/**
 * Where a piece of data came from. This is not metadata for logs: it is
 * rendered in the UI, and it decides whether a button says "Book" or
 * "Search on redBus".
 *
 *   live      — fetched from a real provider just now
 *   cached    — real provider data, previously fetched, still within TTL
 *   estimated — computed by us from a model (a haversine travel time, a
 *               seasonal weather norm). Reasonable, but not observed.
 *   mock      — development fixture. Never to be shown as availability.
 */
export const SourceKindSchema = z.enum(['live', 'cached', 'estimated', 'mock']);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const ProvenanceSchema = z.object({
  sourceKind: SourceKindSchema,
  provider: z.string().min(1),
  fetchedAt: IsoDateTimeSchema,
  confidence: ConfidenceSchema,
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

/** True only for data that reflects a real, current provider response. */
export function isLiveData(p: Provenance): boolean {
  return p.sourceKind === 'live' || p.sourceKind === 'cached';
}

/**
 * Wrapper returned by every provider method.
 *
 * Provenance travels with the payload rather than being attached later, so
 * there is no code path that can obtain provider data without also learning
 * where it came from.
 */
export function sourcedSchema<T extends z.ZodType>(inner: T) {
  return z.object({
    data: inner,
    sourceKind: SourceKindSchema,
    provider: z.string().min(1),
    fetchedAt: IsoDateTimeSchema,
    confidence: ConfidenceSchema,
  });
}

export type Sourced<T> = {
  data: T;
  sourceKind: SourceKind;
  provider: string;
  fetchedAt: IsoDateTime;
  confidence: Confidence;
};

// ---------------------------------------------------------------------------
// Shared domain enums
// ---------------------------------------------------------------------------

export const TransportModeSchema = z.enum([
  'BUS',
  'TRAIN',
  'FLIGHT',
  'CAR',
  'TAXI',
  'AUTO_RICKSHAW',
  'SCOOTER',
  'WALK',
]);
export type TransportMode = z.infer<typeof TransportModeSchema>;

export const InterestSchema = z.enum([
  'NATURE',
  'ADVENTURE',
  'CULTURE',
  'HERITAGE',
  'FOOD',
  'CAFES',
  'NIGHTLIFE',
  'SHOPPING',
  'RELAXATION',
  'PHOTOGRAPHY',
  'SPIRITUAL',
  'TREKKING',
]);
export type Interest = z.infer<typeof InterestSchema>;

export const TripPaceSchema = z.enum(['RELAXED', 'BALANCED', 'PACKED']);
export type TripPace = z.infer<typeof TripPaceSchema>;

export const LodgingTierSchema = z.enum(['BUDGET', 'MID', 'PREMIUM']);
export type LodgingTier = z.infer<typeof LodgingTierSchema>;

export const ComfortTierSchema = z.enum(['BASIC', 'STANDARD', 'PREMIUM']);
export type ComfortTier = z.infer<typeof ComfortTierSchema>;

export const BookingStatusSchema = z.enum([
  'NOT_REQUIRED',
  'NOT_STARTED',
  'LINK_OPENED',
  'BOOKED',
  'CANCELLED',
]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

// ---------------------------------------------------------------------------
// Time helpers used across the engine
// ---------------------------------------------------------------------------

/** "09:30" -> 570. */
export function toMinutes(time: TimeOfDay): number {
  const [h, m] = time.split(':');
  return Number(h) * 60 + Number(m);
}

/** 570 -> "09:30". Values beyond a day are clamped rather than wrapping,
 *  because a schedule that runs past midnight is a bug the caller must see. */
export function fromMinutes(minutes: number): TimeOfDay {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Inclusive count of nights between two dates. */
export function nightsBetween(start: IsoDate, end: IsoDate): number {
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Number of calendar days a trip spans, counting both endpoints. */
export function dayCountBetween(start: IsoDate, end: IsoDate): number {
  return nightsBetween(start, end) + 1;
}

/** Add whole days to a calendar date, staying in UTC to avoid DST drift. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000);
  return next.toISOString().slice(0, 10) as IsoDate;
}
