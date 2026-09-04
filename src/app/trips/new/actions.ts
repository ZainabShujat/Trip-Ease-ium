'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/server/auth/guard';
import { CreateTripFormSchema, createAndPlanTrip } from '@/server/trips/service';

/**
 * Create-trip server action.
 *
 * Parses the form, plans the trip and redirects to it. A planning failure is
 * returned to the form rather than thrown, with the engine's own explanation:
 * "the cheapest combination still costs ₹44,600, which is ₹4,600 over" tells
 * the user what to change. "Planning failed" tells them nothing.
 */

export interface CreateTripState {
  error?: string;
  code?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

/** Advice matched to why the engine refused, so the message is actionable. */
const RECOVERY_HINT: Record<string, string> = {
  BUDGET_UNREACHABLE:
    'Try raising the budget, shortening the trip, or reducing the number of travellers.',
  INFEASIBLE_CONSTRAINTS:
    'Try widening your waking hours, adding a day, or relaxing the transport preference.',
  NO_CANDIDATES:
    'This destination is not covered yet. Manali, Goa and Jaipur are available while the ' +
    'live providers are being connected.',
};

export async function createTripAction(
  _previous: CreateTripState,
  formData: FormData,
): Promise<CreateTripState> {
  const user = await requireUser();

  const raw = {
    title: formData.get('title') || undefined,
    originCity: formData.get('originCity'),
    destinationCity: formData.get('destinationCity'),
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    travellerCount: formData.get('travellerCount'),
    budgetRupees: formData.get('budgetRupees'),
    pace: formData.get('pace') || 'BALANCED',
    lodgingTier: formData.get('lodgingTier') || 'MID',
    interests: formData.getAll('interests').map(String),
    transportModes: formData.getAll('transportModes').map(String),
    avoidOvernightTransport: formData.get('avoidOvernightTransport') === 'on',
    wakeTime: formData.get('wakeTime') || '08:00',
    notes: formData.get('notes') || undefined,
  };

  // Kept so a rejected submission does not wipe what the user typed.
  const values: Record<string, string> = {
    originCity: String(raw.originCity ?? ''),
    destinationCity: String(raw.destinationCity ?? ''),
    startDate: String(raw.startDate ?? ''),
    endDate: String(raw.endDate ?? ''),
    travellerCount: String(raw.travellerCount ?? ''),
    budgetRupees: String(raw.budgetRupees ?? ''),
  };

  const parsed = CreateTripFormSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors, values };
  }

  const outcome = await createAndPlanTrip(user.id, parsed.data);

  if (!outcome.ok) {
    const hint = RECOVERY_HINT[outcome.code];
    return {
      code: outcome.code,
      error: hint ? `${outcome.message} ${hint}` : outcome.message,
      values,
    };
  }

  revalidatePath('/trips');
  redirect(`/trips/${outcome.tripId}`);
}
