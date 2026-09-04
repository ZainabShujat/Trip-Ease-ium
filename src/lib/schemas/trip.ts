import { z } from 'zod';
import {
  CurrencySchema,
  dayCountBetween,
  InterestSchema,
  IsoDateSchema,
  LodgingTierSchema,
  MinorAmountSchema,
  PlaceRefSchema,
  TimeOfDaySchema,
  toMinutes,
  TransportModeSchema,
  TripPaceSchema,
} from './common';

/**
 * TripBrief — the normalised statement of what the user wants.
 *
 * This is the single output of the intake stage and the single input to
 * everything after it. The LLM's only job in stage 1 is to fill this shape
 * from free text; the moment it validates, the rest of the pipeline is
 * deterministic and the model is out of the loop.
 *
 * Every replan works by editing a TripBrief and re-running from the earliest
 * affected stage, which is why the constraints live here as typed fields
 * rather than as prose the scheduler would have to re-interpret.
 */

export const TravellerProfileSchema = z.object({
  name: z.string().min(1).optional(),
  ageBand: z.enum(['CHILD', 'ADULT', 'SENIOR']).default('ADULT'),
  /** Typed, because these become hard scheduling constraints, not hints. */
  accessibilityNeeds: z
    .array(z.enum(['LIMITED_WALKING', 'WHEELCHAIR', 'NO_STEEP_TERRAIN', 'MOTION_SICKNESS']))
    .default([]),
  dietary: z
    .array(z.enum(['VEGETARIAN', 'VEGAN', 'JAIN', 'HALAL', 'NO_BEEF', 'GLUTEN_FREE']))
    .default([]),
});
export type TravellerProfile = z.infer<typeof TravellerProfileSchema>;

export const TripBriefSchema = z
  .object({
    origin: PlaceRefSchema,
    destination: PlaceRefSchema,

    startDate: IsoDateSchema,
    endDate: IsoDateSchema,

    travellerCount: z.number().int().positive().max(20),
    travellers: z.array(TravellerProfileSchema).default([]),

    budgetTotalMinor: MinorAmountSchema,
    currency: CurrencySchema.default('INR'),

    // --- preferences -------------------------------------------------------
    pace: TripPaceSchema.default('BALANCED'),
    wakeTime: TimeOfDaySchema.default('08:00'),
    sleepTime: TimeOfDaySchema.default('22:30'),

    interests: z.array(InterestSchema).default([]),
    transportModes: z.array(TransportModeSchema).default([]),
    avoidOvernightTransport: z.boolean().default(false),
    maxDailyTravelMins: z.number().int().positive().max(1440).default(240),
    lodgingTier: LodgingTierSchema.default('MID'),
    foodPrefs: z.array(z.string()).default([]),

    /**
     * Anything the user said that does not map to a typed field above.
     * Deliberately kept as text and NOT acted on by the scheduler — it is
     * shown to the user and, in Phase 5, used to prompt for a typed
     * clarification. Unstructured text never silently becomes a constraint.
     */
    freeformConstraints: z.array(z.string()).default([]),
    notes: z.string().optional(),
  })
  .refine((b) => b.endDate >= b.startDate, {
    message: 'endDate must not be before startDate',
    path: ['endDate'],
  })
  .refine((b) => dayCountBetween(b.startDate, b.endDate) <= 30, {
    message: 'trips longer than 30 days are out of scope',
    path: ['endDate'],
  })
  .refine((b) => toMinutes(b.sleepTime) > toMinutes(b.wakeTime), {
    message: 'sleepTime must be later in the day than wakeTime',
    path: ['sleepTime'],
  })
  .refine((b) => b.travellers.length === 0 || b.travellers.length === b.travellerCount, {
    message: 'travellers, when given, must have exactly travellerCount entries',
    path: ['travellers'],
  });
export type TripBrief = z.infer<typeof TripBriefSchema>;

/** Days the trip spans, counting both endpoints. Derived, never stored. */
export function briefDayCount(brief: TripBrief): number {
  return dayCountBetween(brief.startDate, brief.endDate);
}

/** Nights of accommodation required. */
export function briefNightCount(brief: TripBrief): number {
  return briefDayCount(brief) - 1;
}

/** Per-person budget, used by the scoring stage to filter candidates early. */
export function budgetPerPersonMinor(brief: TripBrief): number {
  return Math.floor(brief.budgetTotalMinor / brief.travellerCount);
}

export const TripStatusSchema = z.enum([
  'DRAFT',
  'PLANNING',
  'DRAFT_INVALID',
  'PLANNED',
  'BOOKING',
  'TRAVELLING',
  'COMPLETED',
  'CANCELLED',
]);
export type TripStatus = z.infer<typeof TripStatusSchema>;
