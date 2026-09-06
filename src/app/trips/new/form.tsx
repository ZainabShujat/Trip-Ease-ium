'use client';

import { useActionState, useState, useMemo } from 'react';
import {
  CalendarIcon,
  CheckIcon,
  CompassIcon,
  PlacesIcon,
  TransportIcon,
  TravellersIcon,
} from '@/components/brand/icons';
import {
  Button,
  Card,
  ErrorNote,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { formatRupees } from '@/lib/money';
import { createTripAction, type CreateTripState } from './actions';

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

const PIPELINE_STAGES = [
  'Finding transport options',
  'Searching places to stay',
  'Curating sights & activities',
  'Sequencing each day',
  'Optimising route travel times',
  'Verifying budget & totals',
] as const;

const STEPS = [
  { id: 1, name: 'Destination', icon: CompassIcon },
  { id: 2, name: 'Dates', icon: CalendarIcon },
  { id: 3, name: 'Party & Budget', icon: TravellersIcon },
  { id: 4, name: 'Travel Style', icon: PlacesIcon },
  { id: 5, name: 'Route Details', icon: TransportIcon },
  { id: 6, name: 'Review', icon: CheckIcon },
] as const;

export function CreateTripForm({ destinations }: { destinations: readonly string[] }) {
  const [state, formAction, pending] = useActionState<CreateTripState, FormData>(
    createTripAction,
    {},
  );

  const value = (key: string) => state.values?.[key];

  // Multi-step wizard state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Controlled form values for real-time calculation and review
  const [originCity, setOriginCity] = useState(value('originCity') ?? 'Delhi');
  const [destinationCity, setDestinationCity] = useState(
    value('destinationCity') ?? destinations[0] ?? 'Manali',
  );
  const [startDate, setStartDate] = useState(value('startDate') ?? '');
  const [endDate, setEndDate] = useState(value('endDate') ?? '');
  const [travellerCount, setTravellerCount] = useState<number>(
    Number(value('travellerCount')) || 2,
  );
  const [budgetRupees, setBudgetRupees] = useState<number>(
    Number(value('budgetRupees')) || 40000,
  );
  const [pace, setPace] = useState<'RELAXED' | 'BALANCED' | 'PACKED'>('BALANCED');
  const [lodgingTier, setLodgingTier] = useState<'BUDGET' | 'MID' | 'PREMIUM'>('MID');
  const [wakeTime, setWakeTime] = useState('08:00');
  const [avoidOvernight, setAvoidOvernight] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    'NATURE',
    'FOOD',
    'CAFES',
  ]);
  const [selectedTransport, setSelectedTransport] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Calculate duration
  const tripDuration = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays <= 0) return null;
    return {
      days: diffDays,
      nights: Math.max(diffDays - 1, 1),
    };
  }, [startDate, endDate]);

  // Per person budget
  const perPersonBudget = useMemo(() => {
    if (!travellerCount || travellerCount <= 0) return budgetRupees;
    return Math.round(budgetRupees / travellerCount);
  }, [budgetRupees, travellerCount]);

  // Step validation before advancing
  const canAdvance = (step: number) => {
    setValidationError(null);
    if (step === 1) {
      if (!originCity.trim()) {
        setValidationError('Please enter a departure city.');
        return false;
      }
      if (!destinationCity.trim()) {
        setValidationError('Please select a destination.');
        return false;
      }
    } else if (step === 2) {
      if (!startDate) {
        setValidationError('Please select a departure date.');
        return false;
      }
      if (!endDate) {
        setValidationError('Please select an end date.');
        return false;
      }
      if (new Date(endDate) < new Date(startDate)) {
        setValidationError('End date cannot be earlier than start date.');
        return false;
      }
    } else if (step === 3) {
      if (travellerCount < 1 || travellerCount > 20) {
        setValidationError('Travellers must be between 1 and 20.');
        return false;
      }
      if (budgetRupees < 1000) {
        setValidationError('Budget must be at least ₹1,000.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (canAdvance(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 6));
    }
  };

  const handleBack = () => {
    setValidationError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const jumpToStep = (step: number) => {
    if (step < currentStep || canAdvance(currentStep)) {
      setValidationError(null);
      setCurrentStep(step);
    }
  };

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleTransport = (id: string) => {
    setSelectedTransport((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  return (
    <form action={formAction} className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {/* Hidden inputs to guarantee all values are passed to FormData regardless of active card */}
      <input type="hidden" name="originCity" value={originCity} />
      <input type="hidden" name="destinationCity" value={destinationCity} />
      <input type="hidden" name="startDate" value={startDate} />
      <input type="hidden" name="endDate" value={endDate} />
      <input type="hidden" name="travellerCount" value={travellerCount} />
      <input type="hidden" name="budgetRupees" value={budgetRupees} />
      <input type="hidden" name="pace" value={pace} />
      <input type="hidden" name="lodgingTier" value={lodgingTier} />
      <input type="hidden" name="wakeTime" value={wakeTime} />
      {avoidOvernight && <input type="hidden" name="avoidOvernightTransport" value="on" />}
      {selectedInterests.map((interest) => (
        <input key={interest} type="hidden" name="interests" value={interest} />
      ))}
      {selectedTransport.map((mode) => (
        <input key={mode} type="hidden" name="transportModes" value={mode} />
      ))}
      <input type="hidden" name="notes" value={notes} />

      {/* Global Server Error if any */}
      {state.error && <ErrorNote title="That trip could not be planned">{state.error}</ErrorNote>}

      {/* -------------------------------------------------------------------
          Top Progress Tracker & Step Bar
      ------------------------------------------------------------------- */}
      <div className="rounded-xl border border-line bg-surface/90 p-4 shadow-sm backdrop-blur-xs">
        {/* Step Progress Line */}
        <div className="relative mb-3 h-2 w-full overflow-hidden rounded-full bg-surface-sunk">
          <div
            className="h-full rounded-full bg-gradient-to-r from-forest via-sage to-terracotta transition-all duration-300 ease-out"
            style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Step Icons & Titles */}
        <div className="grid grid-cols-6 items-center gap-1 sm:gap-2">
          {STEPS.map((s) => {
            const isCompleted = s.id < currentStep;
            const isCurrent = s.id === currentStep;
            const Icon = s.icon;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => jumpToStep(s.id)}
                disabled={pending}
                className={`group flex flex-col items-center gap-1 transition-all ${
                  isCurrent
                    ? 'text-forest font-semibold'
                    : isCompleted
                      ? 'cursor-pointer text-sage-deep hover:text-forest'
                      : 'cursor-not-allowed opacity-45'
                }`}
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-full border transition-all sm:size-9 ${
                    isCurrent
                      ? 'scale-105 border-terracotta bg-terracotta text-white shadow-sm'
                      : isCompleted
                        ? 'border-sage/40 bg-sage-soft text-forest'
                        : 'border-line bg-surface text-ink-muted'
                  }`}
                >
                  {isCompleted ? <CheckIcon size={14} /> : <Icon size={14} />}
                </span>
                <span className="hidden text-center font-mono text-[11px] sm:inline-block">
                  {s.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Validation banner if current step is blocked */}
      {validationError && (
        <div className="rounded-lg border border-crit/30 bg-crit-soft/60 px-4 py-2.5 text-sm font-medium text-crit animate-rise">
          {validationError}
        </div>
      )}

      {/* -------------------------------------------------------------------
          Step 1: Destination & Origin
      ------------------------------------------------------------------- */}
      {currentStep === 1 && (
        <Card className="flex flex-col gap-6 animate-rise">
          <div className="flex items-start gap-4 border-b border-line pb-4">
            <span className="clip-trapezium grid size-11 shrink-0 place-items-center bg-sage-soft text-sage-deep">
              <CompassIcon size={22} />
            </span>
            <div>
              <span className="font-mono text-xs tracking-wider text-ink-muted uppercase">
                Step 1 of 6 · Route
              </span>
              <h2 className="font-serif text-2xl font-bold text-forest">Where are you going?</h2>
              <p className="text-sm text-ink-soft">
                Tell us where you start and where you want to end up.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <Field label="Starting from (Origin)" error={state.fieldErrors?.originCity}>
              <Input
                value={originCity}
                onChange={(e) => setOriginCity(e.target.value)}
                placeholder="e.g. Delhi, Chandigarh, Mumbai"
                required
                maxLength={80}
              />
            </Field>

            <span aria-hidden className="hidden pb-3 text-xl text-sage-deep sm:block">
              &rarr;
            </span>

            <Field
              label="Destination"
              hint="Currently supported curated destinations"
              error={state.fieldErrors?.destinationCity}
            >
              <Select
                value={destinationCity}
                onChange={(e) => setDestinationCity(e.target.value)}
              >
                {destinations.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Quick Destination Selectors */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="font-mono text-xs text-ink-muted">Quick pick:</span>
            {destinations.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setDestinationCity(city)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  destinationCity === city
                    ? 'border-forest bg-forest text-cream'
                    : 'border-line bg-surface text-ink-soft hover:bg-surface-sunk'
                }`}
              >
                {city}
              </button>
            ))}
          </div>

          <div className="flex justify-end border-t border-line pt-4">
            <Button type="button" onClick={handleNext} size="lg">
              Continue to Dates &rarr;
            </Button>
          </div>
        </Card>
      )}

      {/* -------------------------------------------------------------------
          Step 2: Dates & Duration
      ------------------------------------------------------------------- */}
      {currentStep === 2 && (
        <Card className="flex flex-col gap-6 animate-rise">
          <div className="flex items-start gap-4 border-b border-line pb-4">
            <span className="clip-trapezium grid size-11 shrink-0 place-items-center bg-sage-soft text-sage-deep">
              <CalendarIcon size={22} />
            </span>
            <div>
              <span className="font-mono text-xs tracking-wider text-ink-muted uppercase">
                Step 2 of 6 · Dates
              </span>
              <h2 className="font-serif text-2xl font-bold text-forest">When are you travelling?</h2>
              <p className="text-sm text-ink-soft">
                The planner crafts hour-by-hour schedules matching your real days.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Departure date (Start)" error={state.fieldErrors?.startDate}>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </Field>

            <Field label="Return date (End)" error={state.fieldErrors?.endDate}>
              <Input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </Field>
          </div>

          {/* Dynamic duration preview */}
          {tripDuration && (
            <div className="flex items-center gap-3 rounded-lg border border-sage/30 bg-sage-soft/50 p-4">
              <span className="clip-trapezium flex size-8 items-center justify-center bg-forest text-cream font-mono text-xs font-bold">
                {tripDuration.days}D
              </span>
              <div>
                <p className="text-sm font-semibold text-forest">
                  {tripDuration.days} Days · {tripDuration.nights} Nights on the ground
                </p>
                <p className="text-xs text-ink-soft">
                  Itinerary spans {startDate} through {endDate}.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-line pt-4">
            <Button type="button" variant="secondary" onClick={handleBack}>
              &larr; Back
            </Button>
            <Button type="button" onClick={handleNext} size="lg">
              Continue to Party & Budget &rarr;
            </Button>
          </div>
        </Card>
      )}

      {/* -------------------------------------------------------------------
          Step 3: Travellers & Budget
      ------------------------------------------------------------------- */}
      {currentStep === 3 && (
        <Card className="flex flex-col gap-6 animate-rise">
          <div className="flex items-start gap-4 border-b border-line pb-4">
            <span className="clip-trapezium grid size-11 shrink-0 place-items-center bg-sage-soft text-sage-deep">
              <TravellersIcon size={22} />
            </span>
            <div>
              <span className="font-mono text-xs tracking-wider text-ink-muted uppercase">
                Step 3 of 6 · Group & Budget
              </span>
              <h2 className="font-serif text-2xl font-bold text-forest">Who is coming & total budget?</h2>
              <p className="text-sm text-ink-soft">
                Party size dictates room combinations, fares, and shared vs solo expenses.
              </p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="Number of Travellers"
              hint="Between 1 and 20 people"
              error={state.fieldErrors?.travellerCount}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTravellerCount((c) => Math.max(c - 1, 1))}
                  className="flex size-10 items-center justify-center rounded-lg border border-line bg-surface text-lg font-bold text-forest hover:bg-surface-sunk"
                >
                  -
                </button>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={travellerCount}
                  onChange={(e) => setTravellerCount(Number(e.target.value) || 1)}
                  className="text-center font-serif text-lg font-bold"
                  required
                />
                <button
                  type="button"
                  onClick={() => setTravellerCount((c) => Math.min(c + 1, 20))}
                  className="flex size-10 items-center justify-center rounded-lg border border-line bg-surface text-lg font-bold text-forest hover:bg-surface-sunk"
                >
                  +
                </button>
              </div>
            </Field>

            <Field
              label="Total Budget (₹)"
              hint="For everyone, for the entire trip (travel, hotel, food, sights)"
              error={state.fieldErrors?.budgetRupees}
            >
              <Input
                type="number"
                min={1000}
                step={500}
                value={budgetRupees}
                onChange={(e) => setBudgetRupees(Number(e.target.value) || 0)}
                required
                className="font-mono text-base font-semibold"
              />
              {budgetRupees > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <span>Equivalent:</span>
                  <span className="font-mono font-medium text-ink-soft">
                    ≈ ${Math.round(budgetRupees / 86.5).toLocaleString('en-US')} USD
                  </span>
                  <span>·</span>
                  <span className="font-mono font-medium text-ink-soft">
                    €{Math.round(budgetRupees / 93.0).toLocaleString('en-US')} EUR
                  </span>
                  <span>·</span>
                  <span className="font-mono font-medium text-ink-soft">
                    £{Math.round(budgetRupees / 111.0).toLocaleString('en-US')} GBP
                  </span>
                </div>
              )}
            </Field>
          </div>

          {/* Real-time per-traveller breakdown card */}
          <div className="flex items-center justify-between rounded-lg border border-line bg-surface-sunk/60 px-4 py-3 text-sm">
            <span className="text-ink-soft">Estimated per-person budget:</span>
            <span className="font-mono text-base font-bold text-forest">
              {formatRupees(perPersonBudget)}{' '}
              <span className="text-xs font-normal text-ink-muted">/ traveller</span>
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-line pt-4">
            <Button type="button" variant="secondary" onClick={handleBack}>
              &larr; Back
            </Button>
            <Button type="button" onClick={handleNext} size="lg">
              Continue to Travel Style &rarr;
            </Button>
          </div>
        </Card>
      )}

      {/* -------------------------------------------------------------------
          Step 4: Travel Style & Interests
      ------------------------------------------------------------------- */}
      {currentStep === 4 && (
        <Card className="flex flex-col gap-6 animate-rise">
          <div className="flex items-start gap-4 border-b border-line pb-4">
            <span className="clip-trapezium grid size-11 shrink-0 place-items-center bg-sage-soft text-sage-deep">
              <PlacesIcon size={22} />
            </span>
            <div>
              <span className="font-mono text-xs tracking-wider text-ink-muted uppercase">
                Step 4 of 6 · Vibe
              </span>
              <h2 className="font-serif text-2xl font-bold text-forest">What is your travel style?</h2>
              <p className="text-sm text-ink-soft">
                Shapes activities, daily density, and which neighbourhoods get picked.
              </p>
            </div>
          </div>

          {/* Interests */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-forest">
              What do you enjoy? <span className="font-normal text-ink-muted">(Pick as many as you like)</span>
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              {INTERESTS.map(([id, label]) => {
                const isSelected = selectedInterests.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleInterest(id)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-forest bg-forest text-cream shadow-xs'
                        : 'border-line bg-surface text-ink-soft hover:bg-surface-sunk'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pace & Lodging Tier */}
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Trip Pace">
              <Select
                value={pace}
                onChange={(e) => setPace(e.target.value as 'RELAXED' | 'BALANCED' | 'PACKED')}
              >
                <option value="RELAXED">Relaxed: unhurried, fewer stops</option>
                <option value="BALANCED">Balanced: sights & leisure</option>
                <option value="PACKED">Packed: see everything</option>
              </Select>
            </Field>

            <Field label="Accommodation Style">
              <Select
                value={lodgingTier}
                onChange={(e) => setLodgingTier(e.target.value as 'BUDGET' | 'MID' | 'PREMIUM')}
              >
                <option value="BUDGET">Budget: clean & smart</option>
                <option value="MID">Comfortable: scenic & central</option>
                <option value="PREMIUM">Premium: resort & luxury</option>
              </Select>
            </Field>

            <Field label="Wake Up Time">
              <Input
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between border-t border-line pt-4">
            <Button type="button" variant="secondary" onClick={handleBack}>
              &larr; Back
            </Button>
            <Button type="button" onClick={handleNext} size="lg">
              Continue to Preferences &rarr;
            </Button>
          </div>
        </Card>
      )}

      {/* -------------------------------------------------------------------
          Step 5: Route & Constraints
      ------------------------------------------------------------------- */}
      {currentStep === 5 && (
        <Card className="flex flex-col gap-6 animate-rise">
          <div className="flex items-start gap-4 border-b border-line pb-4">
            <span className="clip-trapezium grid size-11 shrink-0 place-items-center bg-sage-soft text-sage-deep">
              <TransportIcon size={22} />
            </span>
            <div>
              <span className="font-mono text-xs tracking-wider text-ink-muted uppercase">
                Step 5 of 6 · Preferences
              </span>
              <h2 className="font-serif text-2xl font-bold text-forest">How do you prefer to get there?</h2>
              <p className="text-sm text-ink-soft">
                Hard constraints the planner must respect while balancing cost and travel hours.
              </p>
            </div>
          </div>

          {/* Transport Mode Chips */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-forest">
              Preferred Transport Modes{' '}
              <span className="font-normal text-ink-muted">(Leave empty for no preference)</span>
            </label>
            <div className="flex flex-wrap gap-2.5 pt-1">
              {TRANSPORT_MODES.map(([id, label]) => {
                const isSelected = selectedTransport.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleTransport(id)}
                    className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-forest bg-forest text-cream shadow-xs'
                        : 'border-line bg-surface text-ink-soft hover:bg-surface-sunk'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Overnight toggle */}
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface-sunk/50 p-3.5 text-sm text-ink-soft transition-colors hover:bg-surface-sunk">
            <input
              type="checkbox"
              checked={avoidOvernight}
              onChange={(e) => setAvoidOvernight(e.target.checked)}
              className="size-4.5 accent-[var(--sage-deep)]"
            />
            <span>Avoid overnight buses or late-night trains</span>
          </label>

          {/* Notes */}
          <Field
            label="Any specific requests or requirements?"
            hint="Kept with the trip; e.g. 'One traveller cannot walk steep inclines' or 'Need kid-friendly food'"
          >
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              placeholder="e.g. Prefer quiet boutique hotels, travelling with a toddler…"
              rows={3}
            />
          </Field>

          <div className="flex items-center justify-between border-t border-line pt-4">
            <Button type="button" variant="secondary" onClick={handleBack}>
              &larr; Back
            </Button>
            <Button type="button" onClick={handleNext} size="lg">
              Review Trip Blueprint &rarr;
            </Button>
          </div>
        </Card>
      )}

      {/* -------------------------------------------------------------------
          Step 6: Review & Confirmation
      ------------------------------------------------------------------- */}
      {currentStep === 6 && (
        <Card className="flex flex-col gap-6 animate-rise">
          <div className="flex items-start gap-4 border-b border-line pb-4">
            <span className="clip-trapezium grid size-11 shrink-0 place-items-center bg-sage-soft text-sage-deep">
              <CheckIcon size={22} />
            </span>
            <div>
              <span className="font-mono text-xs tracking-wider text-ink-muted uppercase">
                Step 6 of 6 · Ready
              </span>
              <h2 className="font-serif text-2xl font-bold text-forest">Review your trip plan</h2>
              <p className="text-sm text-ink-soft">
                Check your parameters before the planning engine builds and verifies your itinerary.
              </p>
            </div>
          </div>

          {/* Summary Breakdown Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Route Summary */}
            <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-ink-muted uppercase">Route</span>
                <button
                  type="button"
                  onClick={() => jumpToStep(1)}
                  className="text-xs font-medium text-terracotta underline"
                >
                  Edit
                </button>
              </div>
              <p className="font-serif text-lg font-bold text-forest">
                {originCity} &rarr; {destinationCity}
              </p>
            </div>

            {/* Dates Summary */}
            <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-ink-muted uppercase">Dates</span>
                <button
                  type="button"
                  onClick={() => jumpToStep(2)}
                  className="text-xs font-medium text-terracotta underline"
                >
                  Edit
                </button>
              </div>
              <p className="font-serif text-lg font-bold text-forest">
                {startDate} to {endDate}
              </p>
              {tripDuration && (
                <p className="text-xs text-sage-deep font-medium">
                  {tripDuration.days} days ({tripDuration.nights} nights)
                </p>
              )}
            </div>

            {/* Group & Budget Summary */}
            <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-ink-muted uppercase">
                  Party & Budget
                </span>
                <button
                  type="button"
                  onClick={() => jumpToStep(3)}
                  className="text-xs font-medium text-terracotta underline"
                >
                  Edit
                </button>
              </div>
              <p className="font-serif text-lg font-bold text-forest">
                {formatRupees(budgetRupees)}{' '}
                <span className="text-xs font-normal text-ink-soft">
                  for {travellerCount} {travellerCount === 1 ? 'person' : 'travellers'}
                </span>
              </p>
              <p className="text-xs text-ink-muted flex flex-wrap items-center gap-1.5">
                <span>~{formatRupees(perPersonBudget)} per traveller</span>
                <span className="font-mono text-ink-soft">
                  (≈ ${Math.round(budgetRupees / 86.5).toLocaleString('en-US')} USD)
                </span>
              </p>
            </div>

            {/* Style Summary */}
            <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-ink-muted uppercase">Style</span>
                <button
                  type="button"
                  onClick={() => jumpToStep(4)}
                  className="text-xs font-medium text-terracotta underline"
                >
                  Edit
                </button>
              </div>
              <p className="font-serif text-base font-bold text-forest capitalize">
                {pace.toLowerCase()} pace · {lodgingTier.toLowerCase()} lodging
              </p>
              <p className="text-xs text-ink-muted truncate">
                {selectedInterests.length > 0
                  ? selectedInterests.join(', ')
                  : 'All interests open'}
              </p>
            </div>
          </div>

          {/* Submit Action Card */}
          <div className="rounded-xl border border-forest/20 bg-forest/5 p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <Button type="submit" size="lg" disabled={pending} className="shadow-md">
                  {pending ? 'Planning your journey…' : 'Plan this trip now'}
                </Button>
                {!pending && (
                  <p className="text-xs text-ink-muted sm:text-sm">
                    Checks timetables, opening hours and optimizes your budget instantly.
                  </p>
                )}
              </div>

              {pending && (
                <div aria-live="polite" className="border-t border-forest/20 pt-4">
                  <p className="mb-2 text-sm font-semibold text-forest">
                    Working through your itinerary…
                  </p>
                  <ul className="flex flex-wrap gap-x-6 gap-y-2">
                    {PIPELINE_STAGES.map((stage, i) => (
                      <li
                        key={stage}
                        className="animate-pulse-soft flex items-center gap-2 text-xs font-medium text-ink-soft"
                        style={{ animationDelay: `${i * 120}ms` }}
                      >
                        <span aria-hidden className="clip-trapezium size-2 bg-sage" />
                        {stage}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-line pt-4">
            <Button type="button" variant="secondary" onClick={handleBack} disabled={pending}>
              &larr; Back to Preferences
            </Button>
          </div>
        </Card>
      )}
    </form>
  );
}
