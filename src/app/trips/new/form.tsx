'use client';

import { useActionState } from 'react';
import {
  BudgetIcon,
  CalendarIcon,
  CompassIcon,
  PlacesIcon,
  TravellersIcon,
} from '@/components/brand/icons';
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
 * Structured as a conversation rather than a stack of labelled inputs: five
 * named sections, each asking one question a traveller would recognise
 * ("Who's coming?"), with a rail down the side showing where you are.
 *
 * Deliberately still ONE page rather than a multi-step wizard. Splitting this
 * across five screens would hide the shape of what is being asked and add four
 * navigation decisions; the rail gives the sense of progression a wizard is
 * usually reached for, without the cost.
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

/**
 * The stages the engine genuinely runs, in order.
 *
 * Shown while planning as a list of what the work consists of — NOT as a fake
 * progress animation ticking stages off. The server action is a single call
 * with no stage-level feedback yet, so claiming to know which stage is running
 * would be an invention. Phase 4's streaming endpoint is what makes real
 * per-stage progress possible.
 */
const PIPELINE_STAGES = [
  'Finding transport',
  'Finding places to stay',
  'Choosing places worth your time',
  'Planning your days',
  'Optimising your route',
  'Checking your budget',
] as const;

function FormSection({
  index,
  icon,
  title,
  question,
  children,
}: {
  index: number;
  icon: React.ReactNode;
  title: string;
  question: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="clip-trapezium bg-sage-soft text-sage-deep grid h-9 w-11 shrink-0 place-items-center"
        >
          {icon}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-ink-muted font-mono text-[11px] tracking-[0.16em] uppercase">
            Step {index}
          </span>
          <h2 className="text-forest font-serif text-xl font-bold">{title}</h2>
          <p className="text-ink-soft text-sm">{question}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

export function CreateTripForm({ destinations }: { destinations: readonly string[] }) {
  const [state, formAction, pending] = useActionState<CreateTripState, FormData>(
    createTripAction,
    {},
  );

  const value = (key: string) => state.values?.[key];

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error && <ErrorNote title="That trip could not be planned">{state.error}</ErrorNote>}

      <FormSection
        index={1}
        icon={<CompassIcon size={18} />}
        title="Where are you going?"
        question="Your starting point and where you would like to end up."
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <Field label="Starting from" error={state.fieldErrors?.originCity}>
            <Input
              name="originCity"
              defaultValue={value('originCity') ?? 'Delhi'}
              required
              maxLength={80}
            />
          </Field>

          <span aria-hidden className="text-sage-deep hidden pb-3 text-lg sm:block" title="to">
            →
          </span>

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
        </div>
      </FormSection>

      <FormSection
        index={2}
        icon={<CalendarIcon size={18} />}
        title="When?"
        question="The planner works out how many days that leaves you on the ground."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" error={state.fieldErrors?.startDate}>
            <Input type="date" name="startDate" defaultValue={value('startDate')} required />
          </Field>
          <Field label="End date" error={state.fieldErrors?.endDate}>
            <Input type="date" name="endDate" defaultValue={value('endDate')} required />
          </Field>
        </div>
      </FormSection>

      <FormSection
        index={3}
        icon={<TravellersIcon size={18} />}
        title="Who's coming?"
        question="Party size decides how many rooms you need and how costs are counted."
      >
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
            hint="For everyone, for the whole trip — travel, stay, food and activities."
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
      </FormSection>

      <FormSection
        index={4}
        icon={<PlacesIcon size={18} />}
        title="What's your style?"
        question="This shapes what gets shortlisted and how full each day feels."
      >
        <Field label="What do you enjoy?" hint="Pick as many as you like.">
          <div className="flex flex-wrap gap-2 pt-1">
            {INTERESTS.map(([id, label]) => (
              <CheckboxChip key={id} name="interests" value={id} label={label} />
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
      </FormSection>

      <FormSection
        index={5}
        icon={<BudgetIcon size={18} />}
        title="What matters to you?"
        question="Constraints the planner must respect, not just prefer."
      >
        <Field label="How do you want to travel there?" hint="Leave empty for no preference.">
          <div className="flex flex-wrap gap-2 pt-1">
            {TRANSPORT_MODES.map(([id, label]) => (
              <CheckboxChip key={id} name="transportModes" value={id} label={label} />
            ))}
          </div>
        </Field>

        <label className="text-ink-soft flex w-fit cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="avoidOvernightTransport"
            className="size-4 accent-[var(--sage-deep)]"
          />
          No overnight buses or trains
        </label>

        <Field
          label="Anything else?"
          hint="Free text. Kept with the trip; not yet acted on by the planner."
        >
          <Textarea name="notes" maxLength={2000} placeholder="One of us cannot walk far…" />
        </Field>
      </FormSection>

      {/* --- submit ---------------------------------------------------------
          While planning, the real pipeline stages are listed as the work being
          done. No stage is marked "current": the action is one call and
          pretending to track it would be theatre. */}
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? 'Planning your journey…' : 'Plan this trip'}
          </Button>
          {!pending && (
            <p className="text-ink-muted text-sm">
              Takes a moment — every time and total is computed, then checked.
            </p>
          )}
        </div>

        {pending && (
          <div aria-live="polite" className="border-line flex flex-col gap-2 border-t pt-4">
            <p className="text-forest text-sm font-medium">Working through your trip</p>
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
              {PIPELINE_STAGES.map((stage, i) => (
                <li
                  key={stage}
                  className="animate-pulse-soft text-ink-soft flex items-center gap-1.5 text-sm"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <span aria-hidden className="clip-trapezium bg-sage h-2 w-2.5" />
                  {stage}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </form>
  );
}
