'use client';

import { useActionState } from 'react';
import {
  Button,
  Card,
  CheckboxChip,
  ErrorNote,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { createTripAction, type CreateTripState } from './actions';

/**
 * The create-trip form.
 *
 * One page rather than a multi-step wizard. Everything here fits on a screen,
 * and splitting eight fields across five steps adds ceremony without reducing
 * the amount a person has to decide.
 *
 * The submit button reports what is actually happening — planning takes a
 * second or two of real computation, and a button that silently does nothing
 * reads as broken.
 */

const INTERESTS = [
  ['NATURE', 'Nature'],
  ['ADVENTURE', 'Adventure'],
  ['HERITAGE', 'Heritage'],
  ['CULTURE', 'Culture'],
  ['FOOD', 'Food'],
  ['CAFES', 'Cafés'],
  ['SHOPPING', 'Shopping'],
  ['RELAXATION', 'Relaxation'],
  ['PHOTOGRAPHY', 'Photography'],
  ['SPIRITUAL', 'Spiritual'],
  ['TREKKING', 'Trekking'],
  ['NIGHTLIFE', 'Nightlife'],
] as const;

const TRANSPORT_MODES = [
  ['BUS', 'Bus'],
  ['TRAIN', 'Train'],
  ['CAR', 'Car'],
  ['FLIGHT', 'Flight'],
] as const;

export function CreateTripForm({ destinations }: { destinations: readonly string[] }) {
  const [state, formAction, pending] = useActionState<CreateTripState, FormData>(
    createTripAction,
    {},
  );

  const value = (key: string) => state.values?.[key];

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error && <ErrorNote title="That trip could not be planned">{state.error}</ErrorNote>}

      <Card className="flex flex-col gap-5">
        <h2 className="text-muted font-mono text-xs tracking-[0.15em] uppercase">Where and when</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starting from" error={state.fieldErrors?.originCity}>
            <Input
              name="originCity"
              defaultValue={value('originCity') ?? 'Delhi'}
              required
              maxLength={80}
            />
          </Field>

          <Field
            label="Going to"
            hint={`Available now: ${destinations.join(', ')}`}
            error={state.fieldErrors?.destinationCity}
          >
            <Select name="destinationCity" defaultValue={value('destinationCity') ?? 'Manali'}>
              {destinations.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Start date" error={state.fieldErrors?.startDate}>
            <Input type="date" name="startDate" defaultValue={value('startDate')} required />
          </Field>

          <Field label="End date" error={state.fieldErrors?.endDate}>
            <Input type="date" name="endDate" defaultValue={value('endDate')} required />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-5">
        <h2 className="text-muted font-mono text-xs tracking-[0.15em] uppercase">
          Party and budget
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Travellers" error={state.fieldErrors?.travellerCount}>
            <Input
              type="number"
              name="travellerCount"
              min={1}
              max={20}
              defaultValue={value('travellerCount') ?? '2'}
              required
            />
          </Field>

          <Field
            label="Total budget (₹)"
            hint="For everyone, for the whole trip."
            error={state.fieldErrors?.budgetRupees}
          >
            <Input
              type="number"
              name="budgetRupees"
              min={1000}
              step={500}
              defaultValue={value('budgetRupees') ?? '40000'}
              required
            />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-5">
        <h2 className="text-muted font-mono text-xs tracking-[0.15em] uppercase">Preferences</h2>

        <Field label="What do you enjoy?" hint="Pick as many as you like.">
          <div className="flex flex-wrap gap-2 pt-1">
            {INTERESTS.map(([id, label]) => (
              <CheckboxChip key={id} name="interests" value={id} label={label} />
            ))}
          </div>
        </Field>

        <Field label="How do you want to travel there?" hint="Leave empty for no preference.">
          <div className="flex flex-wrap gap-2 pt-1">
            {TRANSPORT_MODES.map(([id, label]) => (
              <CheckboxChip key={id} name="transportModes" value={id} label={label} />
            ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Pace">
            <Select name="pace" defaultValue="BALANCED">
              <option value="RELAXED">Relaxed — fewer stops</option>
              <option value="BALANCED">Balanced</option>
              <option value="PACKED">Packed — see everything</option>
            </Select>
          </Field>

          <Field label="Accommodation">
            <Select name="lodgingTier" defaultValue="MID">
              <option value="BUDGET">Budget</option>
              <option value="MID">Comfortable</option>
              <option value="PREMIUM">Premium</option>
            </Select>
          </Field>

          <Field label="Start the day at">
            <Input type="time" name="wakeTime" defaultValue="08:00" />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="avoidOvernightTransport"
            className="size-4 accent-[var(--accent)]"
          />
          No overnight buses or trains
        </label>

        <Field label="Anything else?" hint="Free text. Shown on the trip, not acted on yet.">
          <Textarea name="notes" maxLength={2000} placeholder="One of us cannot walk far…" />
        </Field>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Planning your trip…' : 'Plan this trip'}
        </Button>
        <span className="text-muted text-xs">
          {pending
            ? 'Scoring options, clustering by area and checking the schedule.'
            : 'Takes a moment — the itinerary is computed, then validated.'}
        </span>
      </div>
    </form>
  );
}
