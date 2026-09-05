import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyTripIllustration } from '@/components/brand/empty-illustration';
import { CalendarIcon, TravellersIcon } from '@/components/brand/icons';
import { SetupNotice } from '@/components/setup-notice';
import {
  BudgetBar,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { currentUser, isAuthConfigured } from '@/server/auth/guard';
import { listTrips } from '@/server/trips/service';

/** Reads the session, so it is rendered per request and never prerendered. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'My trips' };

type TripSummary = Awaited<ReturnType<typeof listTrips>>['upcoming'][number];

function formatDateRange(start: string, end: string): string {
  const fmt = (iso: string, withYear: boolean) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
      timeZone: 'UTC',
    });
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${fmt(start, !sameYear)} – ${fmt(end, true)}`;
}

function TripCard({ trip }: { trip: TripSummary }) {
  const planned = trip.estimatedMinor > 0;
  const over = trip.estimatedMinor > trip.budgetTotalMinor;

  return (
    <Link href={`/trips/${trip.id}`} className="group block rounded-lg">
      <Card interactive className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-forest group-hover:text-sage-deep font-serif text-lg font-bold transition-colors">
              {trip.title}
            </h3>
            <p className="text-ink-muted text-sm">{trip.destinationCity}</p>
          </div>
          <StatusBadge status={trip.status} />
        </div>

        <dl className="text-ink-soft flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Dates</dt>
            <CalendarIcon size={15} className="text-sage-deep" />
            <dd className="tabular">{formatDateRange(trip.startDate, trip.endDate)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Travellers</dt>
            <TravellersIcon size={15} className="text-sage-deep" />
            <dd className="tabular">
              {trip.travellerCount} {trip.travellerCount === 1 ? 'traveller' : 'travellers'}
            </dd>
          </div>
        </dl>

        <div className="border-line mt-auto flex flex-col gap-2 border-t pt-3">
          <p className="tabular flex items-baseline justify-between text-sm">
            {planned ? (
              <>
                <span className="text-forest font-semibold">
                  {formatMoney(trip.estimatedMinor, trip.currency)}
                </span>
                <span className="text-ink-muted">
                  of {formatMoney(trip.budgetTotalMinor, trip.currency)}
                </span>
              </>
            ) : (
              <>
                <span className="text-ink-soft">Not planned yet</span>
                <span className="text-ink-muted">
                  {formatMoney(trip.budgetTotalMinor, trip.currency)} budget
                </span>
              </>
            )}
          </p>
          {planned && (
            <BudgetBar estimatedMinor={trip.estimatedMinor} budgetMinor={trip.budgetTotalMinor} />
          )}
          {over && <p className="text-terracotta-deep text-xs font-medium">Over budget</p>}
        </div>
      </Card>
    </Link>
  );
}

export default async function TripsPage() {
  // Configuration is checked before the session, so an unconfigured install
  // explains itself instead of bouncing the visitor to a sign-in page that
  // cannot work either.
  if (!isAuthConfigured()) {
    return (
      <>
        <PageHeader title="My trips" />
        <SetupNotice />
      </>
    );
  }

  const user = await currentUser();
  if (!user) redirect('/login');

  const { upcoming, past } = await listTrips(user.id);
  const total = upcoming.length + past.length;

  return (
    <>
      <PageHeader
        eyebrow="Your journeys"
        title="My trips"
        description={
          total === 0
            ? undefined
            : `${upcoming.length} upcoming · ${past.length} ${past.length === 1 ? 'past trip' : 'past trips'}`
        }
        actions={<ButtonLink href="/trips/new">Plan a trip</ButtonLink>}
      />

      {total === 0 ? (
        <EmptyState
          illustration={<EmptyTripIllustration className="w-52 max-w-full" />}
          title="Your next adventure starts here"
          description="Tell the planner where you want to go, when, and what you have to spend. It builds a complete day-by-day itinerary you can check, adjust and book."
          action={
            <ButtonLink href="/trips/new" size="lg">
              Plan your first trip
            </ButtonLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-10">
          {upcoming.length > 0 && (
            <section className="flex flex-col gap-4">
              <SectionHeading>Upcoming</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section className="flex flex-col gap-4">
              <SectionHeading>Past</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
