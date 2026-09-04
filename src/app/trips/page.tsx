import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, BudgetBar, ButtonLink, Card, EmptyState, PageHeader } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { SetupNotice } from '@/components/setup-notice';
import { currentUser, isAuthConfigured } from '@/server/auth/guard';
import { listTrips } from '@/server/trips/service';

export const metadata: Metadata = { title: 'My trips' };

type TripSummary = Awaited<ReturnType<typeof listTrips>>['upcoming'][number];

const STATUS_TONE = {
  PLANNED: 'ok',
  BOOKING: 'accent',
  TRAVELLING: 'accent',
  COMPLETED: 'neutral',
  DRAFT: 'neutral',
  PLANNING: 'neutral',
  DRAFT_INVALID: 'crit',
  CANCELLED: 'neutral',
} as const;

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
  return (
    <Link href={`/trips/${trip.id}`} className="group block">
      <Card className="group-hover:border-accent flex flex-col gap-3 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="group-hover:text-accent font-semibold tracking-tight">{trip.title}</h3>
            <p className="text-muted text-sm">{formatDateRange(trip.startDate, trip.endDate)}</p>
          </div>
          <Badge tone={STATUS_TONE[trip.status] ?? 'neutral'}>
            {trip.status.replace('_', ' ').toLowerCase()}
          </Badge>
        </div>

        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-ink-soft">
            {trip.travellerCount} {trip.travellerCount === 1 ? 'traveller' : 'travellers'}
          </span>
          <span className="tabular text-ink-soft">
            {planned ? (
              <>
                <span className="text-ink font-medium">
                  {formatMoney(trip.estimatedMinor, trip.currency)}
                </span>
                {' / '}
                {formatMoney(trip.budgetTotalMinor, trip.currency)}
              </>
            ) : (
              <>Budget {formatMoney(trip.budgetTotalMinor, trip.currency)}</>
            )}
          </span>
        </div>

        {planned && (
          <BudgetBar estimatedMinor={trip.estimatedMinor} budgetMinor={trip.budgetTotalMinor} />
        )}
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

  return (
    <>
      <PageHeader
        title="My trips"
        description={
          upcoming.length + past.length === 0
            ? undefined
            : `${upcoming.length} upcoming, ${past.length} past.`
        }
        actions={<ButtonLink href="/trips/new">Plan a trip</ButtonLink>}
      />

      {upcoming.length === 0 && past.length === 0 ? (
        <EmptyState
          title="No trips yet"
          description="Tell the planner where you want to go, when, and what you have to spend. It will build a complete day-by-day itinerary you can check and adjust."
          action={<ButtonLink href="/trips/new">Plan your first trip</ButtonLink>}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {upcoming.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-muted font-mono text-xs tracking-[0.15em] uppercase">Upcoming</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {upcoming.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-muted font-mono text-xs tracking-[0.15em] uppercase">Past</h2>
              <div className="grid gap-3 sm:grid-cols-2">
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
