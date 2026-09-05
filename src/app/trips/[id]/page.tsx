import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import {
  BudgetIcon,
  ClockIcon,
  ExternalIcon,
  PlacesIcon,
  StayIcon,
  TransportIcon,
} from '@/components/brand/icons';
import {
  Badge,
  BudgetBar,
  Card,
  ReadinessMeter,
  ReadinessRow,
  SampleDataNote,
  SectionHeading,
  SourceBadge,
  Stat,
  StatusBadge,
  cx,
} from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { currentUser } from '@/server/auth/guard';
import { isDatabaseConfigured } from '@/server/db';
import { getTrip } from '@/server/trips/service';

/** Reads the session, so it is rendered per request and never prerendered. */
export const dynamic = 'force-dynamic';

/**
 * The trip dashboard — a travel command centre rather than an admin table.
 *
 * Three things carry it: a header that answers "what is this trip", a
 * readiness meter that answers "what is left to do", and a vertical timeline
 * that answers "what actually happens". Everything else is supporting detail.
 *
 * Readiness is DERIVED from real trip state — selections made, plan validated,
 * budget within total, tasks ticked. Nothing here is invented to fill a
 * progress bar; a checklist that lies is worse than no checklist.
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

/** Categories that read as a stop on the route rather than logistics. */
const STOP_CATEGORIES = new Set(['SIGHT', 'ACTIVITY', 'SHOPPING', 'MEAL', 'CAFE']);

const BUDGET_LABEL: Record<string, string> = {
  TRANSPORT: 'Transport',
  ACCOMMODATION: 'Accommodation',
  FOOD: 'Food',
  ACTIVITIES: 'Activities',
  LOCAL_TRANSPORT: 'Local transport',
  MISC: 'Other',
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * A compact range for the header stat: "12 – 17 Oct" within one month,
 * "28 Oct – 3 Nov" across two. The long form wrapped onto two lines and
 * knocked the four stats out of alignment.
 */
function formatRange(start: Date, end: Date): string {
  const day = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' });
  const dayMonth = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  return sameMonth ? `${day(start)} – ${dayMonth(end)}` : `${dayMonth(start)} – ${dayMonth(end)}`;
}

function hours(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
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

  const allItems = trip.days.flatMap((d) => d.items);
  const activityCount = allItems.filter((i) => STOP_CATEGORIES.has(i.category)).length;
  const bookingTasks = trip.tasks.filter((t) => t.kind === 'BOOKING');
  const documentTasks = trip.tasks.filter((t) => t.kind !== 'BOOKING');

  // Derived from what is actually stored, never assumed.
  const readiness = [
    {
      label: 'Destination decided',
      done: true,
      detail: `${trip.originCity} to ${trip.destinationCity}`,
    },
    {
      label: 'Transport chosen',
      done: Boolean(outbound && inbound),
      detail: outbound && inbound ? 'Both directions selected' : 'Not selected yet',
    },
    {
      label: 'Somewhere to stay',
      done: Boolean(lodging),
      detail: lodging ? lodging.name : 'Not selected yet',
    },
    {
      label: 'Days planned',
      done: activityCount > 0,
      detail: activityCount > 0 ? `${activityCount} stops across your days` : 'No itinerary yet',
    },
    {
      label: 'Budget fits',
      done: estimatedMinor > 0 && estimatedMinor <= trip.budgetTotalMinor,
      detail:
        estimatedMinor === 0
          ? 'Not costed yet'
          : remainingMinor >= 0
            ? `${formatMoney(remainingMinor, trip.currency)} to spare`
            : `${formatMoney(Math.abs(remainingMinor), trip.currency)} over`,
    },
    {
      label: 'Plan checked',
      done: Boolean(validation) && validation!.hardCount === 0,
      detail: validation
        ? validation.hardCount === 0
          ? 'No scheduling conflicts found'
          : `${validation.hardCount} problem(s) to resolve`
        : 'Not checked yet',
    },
    {
      label: 'Bookings made',
      done: bookingTasks.length > 0 && bookingTasks.every((t) => t.isDone),
      detail: `${bookingTasks.filter((t) => t.isDone).length} of ${bookingTasks.length} booked`,
    },
    {
      label: 'Documents ready',
      done: documentTasks.length > 0 && documentTasks.every((t) => t.isDone),
      detail: documentTasks.length > 0 ? documentTasks[0]!.label : 'Nothing outstanding',
    },
  ];
  const readyCount = readiness.filter((r) => r.done).length;

  const anyNonLive = [outbound, inbound, lodging].some(
    (option) => option && option.sourceKind !== 'LIVE' && option.sourceKind !== 'CACHED',
  );

  const maxLine = Math.max(1, ...trip.budgetLines.map((l) => l.estimatedMinor));

  const selections = [
    {
      key: 'outbound',
      label: 'Outbound',
      Icon: TransportIcon,
      title: outbound?.operator,
      detail: outbound
        ? `${formatMoney(outbound.pricePerPersonMinor, trip.currency)} per person · ${hours(outbound.durationMins)}`
        : null,
      url: outbound?.bookingUrl,
      sourceKind: outbound?.sourceKind,
    },
    {
      key: 'return',
      label: 'Return',
      Icon: TransportIcon,
      title: inbound?.operator,
      detail: inbound
        ? `${formatMoney(inbound.pricePerPersonMinor, trip.currency)} per person · ${hours(inbound.durationMins)}`
        : null,
      url: inbound?.bookingUrl,
      sourceKind: inbound?.sourceKind,
    },
    {
      key: 'stay',
      label: 'Stay',
      Icon: StayIcon,
      title: lodging?.name,
      detail: lodging
        ? `${formatMoney(lodging.nightlyRateMinor, trip.currency)} a night · ${formatMoney(lodging.totalRateMinor, trip.currency)} total`
        : null,
      url: lodging?.bookingUrl,
      sourceKind: lodging?.sourceKind,
    },
  ];

  return (
    <>
      {/* --- header: what is this trip ------------------------------------ */}
      <header className="border-line bg-surface relative overflow-hidden rounded-xl border p-6 shadow-[var(--shadow-sm)] sm:p-8">
        <div
          aria-hidden
          className="clip-trapezium bg-sage-soft/50 pointer-events-none absolute -top-16 -right-10 h-56 w-72 rotate-6"
        />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <p className="text-sage-deep font-mono text-xs tracking-[0.16em] uppercase">
                {trip.originCity} → {trip.destinationCity}
              </p>
              <h1 className="text-forest font-serif text-3xl font-bold tracking-tight sm:text-4xl">
                {trip.title}
              </h1>
            </div>
            <StatusBadge status={trip.status} />
          </div>

          <dl className="border-line grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-4">
            <Stat
              label="Dates"
              value={
                <span className="whitespace-nowrap">
                  {formatRange(trip.startDate, trip.endDate)}
                </span>
              }
              sub={`${trip.days.length} ${trip.days.length === 1 ? 'day' : 'days'}`}
            />
            <Stat
              label="Travellers"
              value={trip.travellerCount}
              sub={trip.travellerCount === 1 ? 'person' : 'people'}
            />
            <Stat
              label="Estimated"
              value={formatMoney(estimatedMinor, trip.currency)}
              sub={`of ${formatMoney(trip.budgetTotalMinor, trip.currency)}`}
            />
            <Stat
              label="Remaining"
              value={
                <span className={remainingMinor < 0 ? 'text-terracotta-deep' : 'text-sage-deep'}>
                  {formatMoney(Math.abs(remainingMinor), trip.currency)}
                </span>
              }
              sub={remainingMinor < 0 ? 'over budget' : 'to spare'}
            />
          </dl>
        </div>
      </header>

      {anyNonLive && <SampleDataNote />}

      {/* --- readiness ---------------------------------------------------- */}
      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <SectionHeading>Trip readiness</SectionHeading>
          <p className="tabular text-ink-soft text-sm">
            <span className="text-forest font-serif text-2xl font-bold">{readyCount}</span>
            <span className="text-ink-muted"> / {readiness.length} things ready</span>
          </p>
        </div>

        <ReadinessMeter done={readyCount} total={readiness.length} />

        <ul className="grid gap-x-8 sm:grid-cols-2">
          {readiness.map((row) => (
            <ReadinessRow key={row.label} label={row.label} done={row.done} detail={row.detail} />
          ))}
        </ul>
      </Card>

      {/* --- selections --------------------------------------------------- */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Your choices</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-3">
          {selections.map(({ key, label, Icon, title, detail, url, sourceKind }) => (
            <Card key={key} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sage-deep flex items-center gap-2">
                  <Icon size={17} />
                  <span className="text-ink-muted font-mono text-[11px] tracking-[0.14em] uppercase">
                    {label}
                  </span>
                </span>
                {sourceKind && <SourceBadge sourceKind={sourceKind.toLowerCase()} />}
              </div>

              {title ? (
                <>
                  <p className="text-forest font-medium">{title}</p>
                  <p className="tabular text-ink-soft text-sm">{detail}</p>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-terracotta-deep mt-auto inline-flex w-fit items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
                    >
                      Check availability
                      <ExternalIcon size={14} />
                    </a>
                  )}
                </>
              ) : (
                <p className="text-ink-muted text-sm">Not selected yet.</p>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* --- budget ------------------------------------------------------- */}
      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <SectionHeading>Budget</SectionHeading>
          <p className="tabular text-sm">
            <span className="text-forest font-serif text-2xl font-bold">
              {formatMoney(estimatedMinor, trip.currency)}
            </span>
            <span className="text-ink-muted">
              {' '}
              / {formatMoney(trip.budgetTotalMinor, trip.currency)}
            </span>
          </p>
        </div>

        <BudgetBar estimatedMinor={estimatedMinor} budgetMinor={trip.budgetTotalMinor} />

        {trip.budgetLines.some((l) => l.estimatedMinor > 0) && (
          <dl className="flex flex-col gap-3">
            {trip.budgetLines
              .filter((line) => line.estimatedMinor > 0)
              .sort((a, b) => b.estimatedMinor - a.estimatedMinor)
              .map((line) => (
                <div
                  key={line.category}
                  className="grid grid-cols-[9rem_1fr_auto] items-center gap-3"
                >
                  <dt className="text-ink-soft text-sm">
                    {BUDGET_LABEL[line.category] ?? line.category}
                  </dt>
                  <div className="bg-surface-sunk h-2.5 overflow-hidden rounded-full">
                    <div
                      className="bg-sage h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${Math.max(3, (line.estimatedMinor / maxLine) * 100)}%` }}
                    />
                  </div>
                  <dd className="tabular text-forest text-sm font-medium">
                    {formatMoney(line.estimatedMinor, trip.currency)}
                  </dd>
                </div>
              ))}
          </dl>
        )}
      </Card>

      {/* --- itinerary: the centrepiece ------------------------------------ */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Itinerary</SectionHeading>

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
            <Card key={day.id} className="flex flex-col gap-4">
              <div className="border-line flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
                <h3 className="flex items-baseline gap-2.5">
                  <span className="text-forest font-serif text-lg font-bold">
                    Day {day.dayIndex + 1}
                  </span>
                  <span className="text-ink-muted text-sm">{formatDate(day.date)}</span>
                </h3>
                <p className="tabular text-ink-muted flex items-center gap-3 text-xs">
                  <span>{formatMoney(day.totalCostMinor, trip.currency)}</span>
                  {day.totalTravelMins > 0 && (
                    <span className="flex items-center gap-1">
                      <ClockIcon size={13} />
                      {hours(day.totalTravelMins)} travelling
                    </span>
                  )}
                </p>
              </div>

              {day.items.length === 0 ? (
                <p className="text-ink-muted text-sm">Nothing scheduled.</p>
              ) : (
                /* The route line: a continuous rail down the left, with each
                   stop pinned to it, so a day reads as a journey rather than
                   a table of rows. */
                <ol className="relative flex flex-col">
                  <span
                    aria-hidden
                    className="border-sage/50 absolute top-2 bottom-2 left-[4.6rem] w-px border-l border-dashed sm:left-[5.1rem]"
                  />

                  {day.items.map((item) => {
                    const isStop = STOP_CATEGORIES.has(item.category);
                    return (
                      <li
                        key={item.id}
                        className="group relative grid grid-cols-[3.6rem_1.6rem_1fr] gap-x-2 py-2.5 sm:grid-cols-[4rem_1.9rem_1fr]"
                      >
                        <time className="tabular text-ink-soft pt-0.5 text-right font-mono text-xs leading-tight">
                          {item.startTime}
                          <span className="text-ink-muted/70 block">{item.endTime}</span>
                        </time>

                        <span className="relative flex justify-center pt-1">
                          <span
                            aria-hidden
                            className={cx(
                              'ring-surface relative z-10 mt-1 size-2.5 rounded-full ring-4 transition-transform group-hover:scale-125',
                              isStop ? 'bg-terracotta' : 'bg-sage',
                            )}
                          />
                        </span>

                        <div className="flex flex-col gap-1 pb-1">
                          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                            <span className="text-forest font-medium">{item.title}</span>
                            <Badge tone={isStop ? 'peach' : 'neutral'}>
                              {CATEGORY_LABEL[item.category] ?? item.category}
                            </Badge>
                            {item.estimatedCostMinor > 0 && (
                              <span className="tabular text-ink-soft text-xs font-medium">
                                {formatMoney(item.estimatedCostMinor, trip.currency)}
                              </span>
                            )}
                          </div>

                          <p className="text-ink-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span>{hours(item.durationMins)}</span>
                            {item.travelMinsFromPrev !== null && item.travelMinsFromPrev > 0 && (
                              <span className="flex items-center gap-1">
                                <PlacesIcon size={12} />
                                {item.travelMinsFromPrev} min from the last stop
                              </span>
                            )}
                          </p>

                          {item.notes && <p className="text-ink-soft text-xs">{item.notes}</p>}

                          {item.externalUrl && (
                            <a
                              href={item.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-terracotta-deep inline-flex w-fit items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
                            >
                              View details
                              <ExternalIcon size={12} />
                            </a>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>
          ))
        )}
      </section>

      {/* --- what the planner had to give up ------------------------------- */}
      {validation && validation.relaxedConstraints.length > 0 && (
        <Card className="flex flex-col gap-2">
          <SectionHeading>Trade-offs made</SectionHeading>
          <p className="text-ink-soft flex items-start gap-2 text-sm">
            <BudgetIcon size={16} className="text-sage-deep mt-0.5 shrink-0" />
            <span>
              To fit everything inside your constraints, the planner relaxed{' '}
              {validation.relaxedConstraints
                .map((constraint) => constraint.replace(/_/g, ' ').toLowerCase())
                .join(', ')}
              .
            </span>
          </p>
        </Card>
      )}
    </>
  );
}
