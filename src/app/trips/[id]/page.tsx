import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Badge, BudgetBar, Card, PageHeader, SourceBadge } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { currentUser } from '@/server/auth/guard';
import { isDatabaseConfigured } from '@/server/db';
import { getTrip } from '@/server/trips/service';

/**
 * Trip overview.
 *
 * Phase 3 delivers the trip as saved data made legible: header, readiness,
 * the day-by-day itinerary, the budget breakdown and the selected options.
 * Phase 4 turns this into the full dashboard — map, timeline interactions,
 * alternatives switching, booking status.
 */

export const metadata: Metadata = { title: 'Trip' };

const CATEGORY_LABEL: Record<string, string> = {
  TRANSPORT: 'Travel',
  CHECK_IN: 'Check in',
  CHECK_OUT: 'Check out',
  SIGHT: 'Sight',
  ACTIVITY: 'Activity',
  MEAL: 'Meal',
  CAFE: 'Café',
  SHOPPING: 'Shopping',
  REST: 'Rest',
  FREE_TIME: 'Free',
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export default async function TripPage({ params }: PageProps<'/trips/[id]'>) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (!isDatabaseConfigured()) notFound();

  const { id } = await params;
  const trip = await getTrip(id, user.id);
  if (!trip) notFound();

  const estimatedMinor = trip.budgetLines.reduce((sum, line) => sum + line.estimatedMinor, 0);
  const remainingMinor = trip.budgetTotalMinor - estimatedMinor;
  const outbound = trip.transportOpts.find((o) => o.isSelected && o.direction === 'OUTBOUND');
  const inbound = trip.transportOpts.find((o) => o.isSelected && o.direction === 'RETURN');
  const lodging = trip.lodgingOpts.find((o) => o.isSelected);
  const validation = trip.currentVersion?.validation;
  const doneTasks = trip.tasks.filter((t) => t.isDone).length;

  // Weakest provenance across what was actually selected, so the badge tells
  // the truth about the plan rather than about its best-sourced component.
  const anyNonLive = [outbound, inbound, lodging].some(
    (option) => option && option.sourceKind !== 'LIVE' && option.sourceKind !== 'CACHED',
  );

  return (
    <>
      <PageHeader
        eyebrow={`${trip.originCity} → ${trip.destinationCity}`}
        title={trip.title}
        description={`${formatDate(trip.startDate)} – ${formatDate(trip.endDate)} · ${
          trip.travellerCount
        } ${trip.travellerCount === 1 ? 'traveller' : 'travellers'}`}
        actions={
          <Badge tone={trip.status === 'PLANNED' ? 'ok' : 'neutral'}>
            {trip.status.replace('_', ' ').toLowerCase()}
          </Badge>
        }
      />

      {anyNonLive && (
        <div className="border-flag/40 bg-flag-soft/50 text-ink-soft rounded-lg border px-4 py-3 text-sm">
          <strong className="text-flag">Sample data.</strong> Prices and times here are researched
          estimates, not live availability. Check with the provider before booking.
        </div>
      )}

      {/* --- budget ---------------------------------------------------------- */}
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-muted font-mono text-xs tracking-[0.15em] uppercase">Budget</h2>
          <p className="tabular text-sm">
            <span className="text-lg font-semibold">
              {formatMoney(estimatedMinor, trip.currency)}
            </span>
            <span className="text-muted">
              {' '}
              / {formatMoney(trip.budgetTotalMinor, trip.currency)}
            </span>
          </p>
        </div>

        <BudgetBar estimatedMinor={estimatedMinor} budgetMinor={trip.budgetTotalMinor} />

        <p className="tabular text-ink-soft text-sm">
          {remainingMinor >= 0 ? (
            <>
              <span className="text-ok font-medium">
                {formatMoney(remainingMinor, trip.currency)}
              </span>{' '}
              left
            </>
          ) : (
            <>
              <span className="text-crit font-medium">
                {formatMoney(Math.abs(remainingMinor), trip.currency)}
              </span>{' '}
              over budget
            </>
          )}
        </p>

        {trip.budgetLines.length > 0 && (
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {trip.budgetLines
              .filter((line) => line.estimatedMinor > 0)
              .sort((a, b) => b.estimatedMinor - a.estimatedMinor)
              .map((line) => (
                <div
                  key={line.category}
                  className="border-line flex justify-between border-b pb-1.5 text-sm"
                >
                  <dt className="text-ink-soft capitalize">
                    {line.category.replace('_', ' ').toLowerCase()}
                  </dt>
                  <dd className="tabular font-medium">
                    {formatMoney(line.estimatedMinor, trip.currency)}
                  </dd>
                </div>
              ))}
          </dl>
        )}
      </Card>

      {/* --- selections ------------------------------------------------------ */}
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Outbound', option: outbound },
          { label: 'Return', option: inbound },
        ].map(({ label, option }) => (
          <Card key={label} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-muted font-mono text-xs tracking-[0.15em] uppercase">{label}</h3>
              {option && <SourceBadge sourceKind={option.sourceKind.toLowerCase()} />}
            </div>
            {option ? (
              <>
                <p className="font-medium">{option.operator}</p>
                <p className="tabular text-ink-soft text-sm">
                  {formatMoney(option.pricePerPersonMinor, trip.currency)} per person ·{' '}
                  {Math.round(option.durationMins / 60)} h
                </p>
                {option.bookingUrl && (
                  <a
                    href={option.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent text-sm underline underline-offset-4"
                  >
                    Check availability
                  </a>
                )}
              </>
            ) : (
              <p className="text-muted text-sm">Not selected yet.</p>
            )}
          </Card>
        ))}

        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-muted font-mono text-xs tracking-[0.15em] uppercase">Stay</h3>
            {lodging && <SourceBadge sourceKind={lodging.sourceKind.toLowerCase()} />}
          </div>
          {lodging ? (
            <>
              <p className="font-medium">{lodging.name}</p>
              <p className="tabular text-ink-soft text-sm">
                {formatMoney(lodging.nightlyRateMinor, trip.currency)} a night ·{' '}
                {formatMoney(lodging.totalRateMinor, trip.currency)} total
              </p>
              {lodging.bookingUrl && (
                <a
                  href={lodging.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent text-sm underline underline-offset-4"
                >
                  Check availability
                </a>
              )}
            </>
          ) : (
            <p className="text-muted text-sm">Not selected yet.</p>
          )}
        </Card>
      </section>

      {/* --- readiness ------------------------------------------------------- */}
      {trip.tasks.length > 0 && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-muted font-mono text-xs tracking-[0.15em] uppercase">
              Trip readiness
            </h2>
            <span className="tabular text-muted text-sm">
              {doneTasks} / {trip.tasks.length}
            </span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {trip.tasks.map((task) => (
              <li key={task.id} className="flex items-start gap-2.5 text-sm">
                <span
                  aria-hidden
                  className={task.isDone ? 'text-ok font-mono' : 'text-line-strong font-mono'}
                >
                  {task.isDone ? '✓' : '○'}
                </span>
                <span className={task.isDone ? 'text-muted line-through' : 'text-ink-soft'}>
                  {task.label}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* --- itinerary ------------------------------------------------------- */}
      <section className="flex flex-col gap-4">
        <h2 className="text-muted font-mono text-xs tracking-[0.15em] uppercase">Itinerary</h2>

        {trip.days.length === 0 ? (
          <Card>
            <p className="text-ink-soft text-sm">
              This trip has no itinerary yet.
              {trip.status === 'DRAFT_INVALID' &&
                ' The planner could not build one within your constraints.'}
            </p>
          </Card>
        ) : (
          trip.days.map((day) => (
            <Card key={day.id} className="flex flex-col gap-3">
              <div className="border-line flex flex-wrap items-baseline justify-between gap-2 border-b pb-2">
                <h3 className="font-semibold">
                  Day {day.dayIndex + 1}
                  <span className="text-muted ml-2 font-normal">{formatDate(day.date)}</span>
                </h3>
                <p className="tabular text-muted text-xs">
                  {formatMoney(day.totalCostMinor, trip.currency)}
                  {day.totalTravelMins > 0 && ` · ${day.totalTravelMins} min travelling`}
                </p>
              </div>

              {day.items.length === 0 ? (
                <p className="text-muted text-sm">Nothing scheduled.</p>
              ) : (
                <ol className="flex flex-col">
                  {day.items.map((item) => (
                    <li
                      key={item.id}
                      className="border-line grid grid-cols-[auto_1fr] gap-x-4 border-b py-2 last:border-b-0"
                    >
                      <span className="tabular text-muted pt-0.5 font-mono text-xs">
                        {item.startTime}
                        <span className="text-line-strong block">{item.endTime}</span>
                      </span>

                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-medium">{item.title}</span>
                          <Badge>{CATEGORY_LABEL[item.category] ?? item.category}</Badge>
                          {item.estimatedCostMinor > 0 && (
                            <span className="tabular text-muted text-xs">
                              {formatMoney(item.estimatedCostMinor, trip.currency)}
                            </span>
                          )}
                        </div>

                        {item.travelMinsFromPrev !== null && item.travelMinsFromPrev > 0 && (
                          <p className="text-muted text-xs">
                            {item.travelMinsFromPrev} min from the previous stop
                          </p>
                        )}

                        {item.notes && <p className="text-ink-soft text-xs">{item.notes}</p>}

                        {item.externalUrl && (
                          <a
                            href={item.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent w-fit text-xs underline underline-offset-4"
                          >
                            Open
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          ))
        )}
      </section>

      {/* --- what the planner had to give up --------------------------------- */}
      {validation && validation.relaxedConstraints.length > 0 && (
        <Card className="flex flex-col gap-2">
          <h2 className="text-muted font-mono text-xs tracking-[0.15em] uppercase">
            Trade-offs made
          </h2>
          <p className="text-ink-soft text-sm">
            To fit your constraints, the planner relaxed:{' '}
            {validation.relaxedConstraints
              .map((constraint) => constraint.replace(/_/g, ' ').toLowerCase())
              .join(', ')}
            .
          </p>
        </Card>
      )}
    </>
  );
}
