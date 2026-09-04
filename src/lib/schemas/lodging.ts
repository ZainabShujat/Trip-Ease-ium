import { z } from 'zod';
import {
  DistanceMetresSchema,
  GeoPointSchema,
  IsoDateSchema,
  LodgingTierSchema,
  MinorAmountSchema,
  ProvenanceSchema,
  TimeOfDaySchema,
} from './common';
import { ExternalLinkSchema } from './link';

export const LodgingArchetypeSchema = z.enum(['BUDGET', 'BEST_OVERALL', 'PREMIUM']);
export type LodgingArchetype = z.infer<typeof LodgingArchetypeSchema>;

export const LodgingOptionSchema = z.object({
  id: z.string().min(1),

  name: z.string().min(1),
  geo: GeoPointSchema,
  address: z.string().optional(),
  area: z.string().optional(),

  nightlyRateMinor: MinorAmountSchema,
  /** Rate for the whole stay, all rooms. Computed, never taken from a model. */
  totalRateMinor: MinorAmountSchema,
  /** Rooms needed for the party, at this property's occupancy. */
  roomsRequired: z.number().int().positive().default(1),

  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().nonnegative().optional(),
  tier: LodgingTierSchema,
  amenities: z.array(z.string()).default([]),

  checkInTime: TimeOfDaySchema.default('14:00'),
  checkOutTime: TimeOfDaySchema.default('11:00'),

  /** Metres from the centroid of the trip's shortlisted POIs. The number
   *  behind "close to most of your activities". Set during Phase 2 scoring. */
  distanceToCentroidM: DistanceMetresSchema.optional(),

  archetype: LodgingArchetypeSchema.optional(),
  score: z.number().optional(),
  rationale: z.string().optional(),

  link: ExternalLinkSchema.nullable().default(null),

  providerRef: z.string().optional(),
  provenance: ProvenanceSchema,
});
export type LodgingOption = z.infer<typeof LodgingOptionSchema>;

export const LodgingQuerySchema = z
  .object({
    city: z.string().min(1),
    near: GeoPointSchema.optional(),
    checkIn: IsoDateSchema,
    checkOut: IsoDateSchema,
    guests: z.number().int().positive(),
    tier: LodgingTierSchema.optional(),
    maxNightlyRateMinor: MinorAmountSchema.optional(),
    limit: z.number().int().positive().max(50).default(20),
  })
  .refine((q) => q.checkOut > q.checkIn, {
    message: 'checkOut must be after checkIn',
    path: ['checkOut'],
  });
export type LodgingQuery = z.infer<typeof LodgingQuerySchema>;
