import { isFailure } from '@/engine/result';
import type { PlannedTrip } from '@/engine/types';
import { rupees } from '@/lib/money';
import { TripBriefSchema, dayCountBetween, type TripBrief } from '@/lib/schemas';
import { planTripFromBrief } from '@/planning';
import { z } from 'zod';
import { isDatabaseConfigured } from '../db';
import * as repo from './repository';

/**
 * The trip service.
 *
 * Sits between the routes and the repository so a route handler stays thin:
 * parse, authorise, delegate. Everything here takes a `userId` explicitly
 * rather than reading the session, which keeps it testable and makes the
 * ownership requirement impossible to forget.
 */

/** Raised when the database is not configured. Mapped to a clear 503. */
export class DatabaseUnavailableError extends Error {
  constructor() {
    super(
      'No database is configured. Set DATABASE_URL in .env.local and run ' +
        '`npm run db:migrate` to save trips.',
    );
    this.name = 'DatabaseUnavailableError';
  }
}

function assertDatabase(): void {
  if (!isDatabaseConfigured()) throw new DatabaseUnavailableError();
}

// ---------------------------------------------------------------------------
// Create-trip form
// ---------------------------------------------------------------------------

/**
 * What the create-trip form submits.
 *
 * Deliberately not TripBrief: the form speaks in rupees and plain strings,
 * because that is what a person types. Converting to the engine's minor units
 * and enum shapes happens here, once, at the boundary.
 */
export const CreateTripFormSchema = z
  .object({
    title: z.string().max(80).optional(),
    originCity: z.string().min(1, 'where are you starting from?').max(80),
    destinationCity: z.string().min(1, 'where are you going?').max(80),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'pick a start date'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'pick an end date'),
    travellerCount: z.coerce.number().int().min(1, 'at least one traveller').max(20),
    /** Whole rupees, as typed. Converted to paise below. */
    budgetRupees: z.coerce.number().int().min(1, 'enter a budget').max(10_000_000),
    pace: z.enum(['RELAXED', 'BALANCED', 'PACKED']).default('BALANCED'),
    lodgingTier: z.enum(['BUDGET', 'MID', 'PREMIUM']).default('MID'),
    interests: z.array(z.string()).default([]),
    transportModes: z.array(z.string()).default([]),
    avoidOvernightTransport: z.coerce.boolean().default(false),
    wakeTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .default('08:00'),
    notes: z.string().max(2000).optional(),
  })
  .refine((form) => form.endDate >= form.startDate, {
    message: 'the end date cannot be before the start date',
    path: ['endDate'],
  })
  .refine((form) => dayCountBetween(form.startDate, form.endDate) <= 30, {
    message: 'trips longer than 30 days are out of scope for now',
    path: ['endDate'],
  });

export type CreateTripForm = z.infer<typeof CreateTripFormSchema>;

/** Known destinations the mock providers can actually plan. */
export const SUPPORTED_DESTINATIONS = ['Manali', 'Goa', 'Jaipur'] as const;

/** Coordinates for the cities the fixtures cover. */
const CITY_GEO: Record<string, { lat: number; lng: number }> = {
  delhi: { lat: 28.6139, lng: 77.209 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  manali: { lat: 32.2432, lng: 77.1892 },
  goa: { lat: 15.5, lng: 73.83 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
};

function geoFor(city: string) {
  return CITY_GEO[city.trim().toLowerCase()];
}

/** Convert a submitted form into the engine's TripBrief. */
export function briefFromForm(form: CreateTripForm): TripBrief {
  const originGeo = geoFor(form.originCity);
  const destinationGeo = geoFor(form.destinationCity);

  return TripBriefSchema.parse({
    origin: { name: form.originCity.trim(), ...(originGeo ? { geo: originGeo } : {}) },
    destination: {
      name: form.destinationCity.trim(),
      ...(destinationGeo ? { geo: destinationGeo } : {}),
    },
    startDate: form.startDate,
    endDate: form.endDate,
    travellerCount: form.travellerCount,
    budgetTotalMinor: rupees(form.budgetRupees),
    pace: form.pace,
    lodgingTier: form.lodgingTier,
    interests: form.interests,
    transportModes: form.transportModes,
    avoidOvernightTransport: form.avoidOvernightTransport,
    wakeTime: form.wakeTime,
    ...(form.notes ? { notes: form.notes } : {}),
  });
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export type PlanTripOutcome =
  | { ok: true; tripId: string; plan: PlannedTrip }
  | { ok: false; tripId: string | null; code: string; message: string };

/**
 * Create a trip and plan it in one go.
 *
 * The trip row is written first, so a planning failure still leaves the user
 * with a saved draft they can adjust rather than a lost form. The failure
 * reason is returned verbatim from the engine — "the cheapest combination
 * still costs ₹44,600" is far more useful than "planning failed".
 */
export async function createAndPlanTrip(
  userId: string,
  form: CreateTripForm,
): Promise<PlanTripOutcome> {
  assertDatabase();

  const brief = briefFromForm(form);
  const trip = await repo.createTrip({
    userId,
    brief,
    ...(form.title ? { title: form.title } : {}),
  });

  const result = await planTripFromBrief(brief);
  if (isFailure(result)) {
    await repo.setTripStatus(trip.id, userId, 'DRAFT_INVALID');
    return { ok: false, tripId: trip.id, code: result.code, message: result.message };
  }

  const saved = await repo.savePlan(trip.id, userId, result.plan);
  if (!saved) {
    return {
      ok: false,
      tripId: trip.id,
      code: 'SAVE_FAILED',
      message: 'The plan was built but could not be saved.',
    };
  }

  return { ok: true, tripId: trip.id, plan: result.plan };
}

export async function listTrips(userId: string) {
  assertDatabase();
  return repo.listTrips(userId);
}

export async function getTrip(tripId: string, userId: string) {
  assertDatabase();
  return repo.getTrip(tripId, userId);
}

export async function deleteTrip(tripId: string, userId: string) {
  assertDatabase();
  return repo.deleteTrip(tripId, userId);
}
