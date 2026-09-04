import { z } from 'zod';
import {
  DurationMinsSchema,
  GeoPointSchema,
  ProvenanceSchema,
  TimeOfDaySchema,
  toMinutes,
  type TimeOfDay,
} from './common';

/**
 * Points of interest: the things a traveller actually goes to see, eat at or
 * do. Modelled as a global, trip-independent cache — a POI in Manali is the
 * same POI for every user.
 */

export const PoiCategorySchema = z.enum([
  'SIGHT',
  'ACTIVITY',
  'RESTAURANT',
  'CAFE',
  'SHOPPING',
  'NATURE',
  'TEMPLE',
  'MUSEUM',
  'VIEWPOINT',
  'MARKET',
]);
export type PoiCategory = z.infer<typeof PoiCategorySchema>;

// ---------------------------------------------------------------------------
// Opening hours
// ---------------------------------------------------------------------------

/**
 * Structured rather than free text, because the scheduler has to answer
 * "is this open at 16:30 on a Thursday?" programmatically. A string like
 * "9am-6pm, closed Mondays" is not answerable without parsing prose, which is
 * exactly the kind of thing we refuse to hand to an LLM at schedule time.
 *
 * `weekday` follows JavaScript's Date.getUTCDay(): 0 = Sunday .. 6 = Saturday.
 */
export const OpeningIntervalSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    opens: TimeOfDaySchema,
    closes: TimeOfDaySchema,
  })
  .refine((i) => toMinutes(i.closes) > toMinutes(i.opens), {
    message: 'closes must be after opens; overnight hours need two intervals',
  });
export type OpeningInterval = z.infer<typeof OpeningIntervalSchema>;

export const OpeningHoursSchema = z.discriminatedUnion('kind', [
  /** Open at all hours — a viewpoint, a public road, an open valley. */
  z.object({ kind: z.literal('always') }),
  /** Hours genuinely unknown. The scheduler must treat this as a soft risk,
   *  never silently assume the place is open. */
  z.object({ kind: z.literal('unknown') }),
  z.object({
    kind: z.literal('weekly'),
    intervals: z.array(OpeningIntervalSchema).min(1),
    /** Marked closed on these weekdays even if an interval exists. */
    closedWeekdays: z.array(z.number().int().min(0).max(6)).default([]),
  }),
]);
export type OpeningHours = z.infer<typeof OpeningHoursSchema>;

/**
 * Is this place open for the whole window [arrive, leave) on `weekday`?
 *
 * Deliberately conservative: `unknown` hours return false so the caller has to
 * decide explicitly what to do, rather than a guess quietly becoming a plan.
 */
export function isOpenDuring(
  hours: OpeningHours,
  weekday: number,
  arrive: TimeOfDay,
  leave: TimeOfDay,
): boolean {
  if (hours.kind === 'always') return true;
  if (hours.kind === 'unknown') return false;
  if (hours.closedWeekdays.includes(weekday)) return false;

  const from = toMinutes(arrive);
  const to = toMinutes(leave);
  return hours.intervals.some(
    (i) => i.weekday === weekday && toMinutes(i.opens) <= from && toMinutes(i.closes) >= to,
  );
}

// ---------------------------------------------------------------------------
// Poi
// ---------------------------------------------------------------------------

export const PoiSchema = z.object({
  id: z.string().min(1),
  /** Stable identifier from the source provider. Cache key for the Poi table. */
  providerRef: z.string().min(1),

  name: z.string().min(1),
  category: PoiCategorySchema,
  geo: GeoPointSchema,

  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().nonnegative().optional(),
  /** Google Places convention: 0 = free, 4 = very expensive. */
  priceLevel: z.number().int().min(0).max(4).optional(),

  /** How long a visitor realistically spends here. Drives the scheduler. */
  typicalDurationMins: DurationMinsSchema,
  /** Typical per-person spend, if any. Feeds the budget ledger. */
  typicalCostPerPersonMinor: z.number().int().nonnegative().default(0),

  openingHours: OpeningHoursSchema,

  address: z.string().optional(),
  mapsUrl: z.url().optional(),
  websiteUrl: z.url().optional(),

  /** Free-form descriptors used for interest matching in Phase 2 scoring. */
  tags: z.array(z.string()).default([]),

  provenance: ProvenanceSchema,
});
export type Poi = z.infer<typeof PoiSchema>;

/** Query accepted by every PlacesProvider. */
export const PlaceQuerySchema = z.object({
  near: GeoPointSchema,
  radiusMetres: z.number().int().positive().max(50_000).default(25_000),
  categories: z.array(PoiCategorySchema).optional(),
  text: z.string().optional(),
  limit: z.number().int().positive().max(100).default(50),
});
export type PlaceQuery = z.infer<typeof PlaceQuerySchema>;
