import { z } from 'zod';
import {
  ComfortTierSchema,
  DurationMinsSchema,
  GeoPointSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  MinorAmountSchema,
  ProvenanceSchema,
  TransportModeSchema,
} from './common';
import { ExternalLinkSchema } from './link';

export const TransportDirectionSchema = z.enum(['OUTBOUND', 'RETURN', 'LOCAL']);
export type TransportDirection = z.infer<typeof TransportDirectionSchema>;

/**
 * The three answers the product always offers for an important decision, so
 * the user is choosing rather than being told. Selected from the Pareto front
 * in Phase 2 scoring.
 */
export const TransportArchetypeSchema = z.enum(['CHEAPEST', 'BALANCED', 'FASTEST']);
export type TransportArchetype = z.infer<typeof TransportArchetypeSchema>;

export const TransportOptionSchema = z.object({
  id: z.string().min(1),

  direction: TransportDirectionSchema,
  mode: TransportModeSchema,
  /** Operator or service class. May be a category ("State Roadways, Ordinary")
   *  rather than a named company when the source is estimated. */
  operator: z.string().min(1),

  fromName: z.string().min(1),
  toName: z.string().min(1),
  fromGeo: GeoPointSchema.optional(),
  toGeo: GeoPointSchema.optional(),

  /** Absent for LOCAL options, which describe a mode rather than a service. */
  departAt: IsoDateTimeSchema.optional(),
  arriveAt: IsoDateTimeSchema.optional(),
  durationMins: DurationMinsSchema,

  pricePerPersonMinor: MinorAmountSchema,
  comfortTier: ComfortTierSchema,

  /** True when the service runs through the night. Drives the
   *  `avoidOvernightTransport` preference and the sleep-debt soft constraint. */
  isOvernight: z.boolean().default(false),

  archetype: TransportArchetypeSchema.optional(),
  score: z.number().optional(),
  /** Written by the narration stage, from an already-decided plan. */
  rationale: z.string().optional(),
  /** Factual note about the service — halts, seating, what the trade-off is.
   *  Comes from the provider, not from a model. */
  notes: z.string().optional(),

  /**
   * Built exclusively by src/providers/links.ts. Null means no trustworthy
   * link exists, and the UI shows a search affordance instead of a dead
   * "Book" button. Never populated by an LLM.
   */
  link: ExternalLinkSchema.nullable().default(null),

  providerRef: z.string().optional(),
  provenance: ProvenanceSchema,
});
export type TransportOption = z.infer<typeof TransportOptionSchema>;

// ---------------------------------------------------------------------------
// Provider queries
// ---------------------------------------------------------------------------

export const IntercityQuerySchema = z.object({
  fromCity: z.string().min(1),
  toCity: z.string().min(1),
  date: IsoDateSchema,
  direction: TransportDirectionSchema,
  passengers: z.number().int().positive(),
  modes: z.array(TransportModeSchema).optional(),
  maxPricePerPersonMinor: MinorAmountSchema.optional(),
  avoidOvernight: z.boolean().default(false),
});
export type IntercityQuery = z.infer<typeof IntercityQuerySchema>;

export const LocalTransportQuerySchema = z.object({
  city: z.string().min(1),
  near: GeoPointSchema.optional(),
  passengers: z.number().int().positive(),
});
export type LocalTransportQuery = z.infer<typeof LocalTransportQuerySchema>;

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export const TravelLegSchema = z.object({
  fromGeo: GeoPointSchema,
  toGeo: GeoPointSchema,
  mode: TransportModeSchema,
  distanceMetres: z.number().int().nonnegative(),
  durationMins: DurationMinsSchema,
  provenance: ProvenanceSchema,
});
export type TravelLeg = z.infer<typeof TravelLegSchema>;

/**
 * Square matrix of pairwise travel times, indexed by position in `points`.
 * `durationMins[i][j]` is the time from points[i] to points[j].
 *
 * The scheduler and the day-ordering pass both read from one matrix so a
 * single provider call serves the whole trip.
 */
export const TravelMatrixSchema = z
  .object({
    points: z.array(GeoPointSchema).min(1),
    mode: TransportModeSchema,
    durationMins: z.array(z.array(DurationMinsSchema)),
    distanceMetres: z.array(z.array(z.number().int().nonnegative())),
    provenance: ProvenanceSchema,
  })
  .refine(
    (m) =>
      m.durationMins.length === m.points.length &&
      m.durationMins.every((row) => row.length === m.points.length),
    { message: 'durationMins must be a square matrix matching points.length' },
  )
  .refine(
    (m) =>
      m.distanceMetres.length === m.points.length &&
      m.distanceMetres.every((row) => row.length === m.points.length),
    { message: 'distanceMetres must be a square matrix matching points.length' },
  );
export type TravelMatrix = z.infer<typeof TravelMatrixSchema>;
