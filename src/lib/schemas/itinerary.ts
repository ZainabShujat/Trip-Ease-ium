import { z } from 'zod';
import {
  BookingStatusSchema,
  DistanceMetresSchema,
  DurationMinsSchema,
  GeoPointSchema,
  IsoDateSchema,
  MinorAmountSchema,
  TimeOfDaySchema,
  toMinutes,
  TransportModeSchema,
} from './common';
import { ExternalLinkSchema } from './link';

export const ItemCategorySchema = z.enum([
  'TRANSPORT',
  'CHECK_IN',
  'CHECK_OUT',
  'SIGHT',
  'ACTIVITY',
  'MEAL',
  'CAFE',
  'SHOPPING',
  'REST',
  'FREE_TIME',
]);
export type ItemCategory = z.infer<typeof ItemCategorySchema>;

/**
 * One scheduled block of a day.
 *
 * Times are local wall-clock at the destination; the owning day carries the
 * date. `travelFromPrev` is attached to the arriving item rather than modelled
 * as a separate gap object, so an item always knows what it cost to get there
 * and the validator can check reachability with one pass over the list.
 */
export const ItineraryItemSchema = z
  .object({
    id: z.string().min(1),
    seq: z.number().int().nonnegative(),

    title: z.string().min(1),
    category: ItemCategorySchema,

    startTime: TimeOfDaySchema,
    endTime: TimeOfDaySchema,
    durationMins: DurationMinsSchema,

    poiId: z.string().optional(),
    geo: GeoPointSchema.optional(),

    estimatedCostMinor: MinorAmountSchema.default(0),

    travelFromPrev: z
      .object({
        durationMins: DurationMinsSchema,
        distanceMetres: DistanceMetresSchema,
        mode: TransportModeSchema,
      })
      .nullable()
      .default(null),

    link: ExternalLinkSchema.nullable().default(null),
    notes: z.string().optional(),

    bookingStatus: BookingStatusSchema.default('NOT_REQUIRED'),
    /** Pinned through replans — set once the user has actually booked this,
     *  so re-optimisation can never move it out from under them. */
    isLocked: z.boolean().default(false),
  })
  .refine((i) => toMinutes(i.endTime) > toMinutes(i.startTime), {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  })
  .refine((i) => toMinutes(i.endTime) - toMinutes(i.startTime) === i.durationMins, {
    message: 'durationMins must equal endTime - startTime',
    path: ['durationMins'],
  });
export type ItineraryItem = z.infer<typeof ItineraryItemSchema>;

export const ItineraryDaySchema = z.object({
  id: z.string().min(1),
  dayIndex: z.number().int().nonnegative(),
  date: IsoDateSchema,
  summary: z.string().optional(),

  items: z.array(ItineraryItemSchema).default([]),

  clusterCentroid: GeoPointSchema.optional(),
  totalCostMinor: MinorAmountSchema.default(0),
  totalTravelMins: DurationMinsSchema.default(0),
});
export type ItineraryDay = z.infer<typeof ItineraryDaySchema>;

export const ItinerarySchema = z.array(ItineraryDaySchema);
export type Itinerary = z.infer<typeof ItinerarySchema>;

// ---------------------------------------------------------------------------
// Derived helpers — deterministic, used by the budget and validation stages
// ---------------------------------------------------------------------------

/** Sum of item costs for a day. Recomputed rather than trusted from storage. */
export function dayCostMinor(day: ItineraryDay): number {
  return day.items.reduce((total, item) => total + item.estimatedCostMinor, 0);
}

/** Total minutes spent travelling between stops on a day. */
export function dayTravelMins(day: ItineraryDay): number {
  return day.items.reduce((total, item) => total + (item.travelFromPrev?.durationMins ?? 0), 0);
}

/** Items ordered by start time, regardless of stored `seq`. */
export function itemsInTimeOrder(day: ItineraryDay): ItineraryItem[] {
  return [...day.items].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
}
