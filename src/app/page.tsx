import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { SetupNotice } from '@/components/setup-notice';
import { TrapeziumMark, Wordmark } from '@/components/brand/logo';
import {
  BudgetIcon,
  PlacesIcon,
  RouteLine,
  StayIcon,
  TransportIcon,
} from '@/components/brand/icons';
import { ButtonLink, Card, SectionHeading } from '@/components/ui';
import { currentUser } from '@/server/auth/guard';

/**
 * Rendered per request, always.
 *
 * This page reads the session, so it must never be prerendered. Without this
 * it is only dynamic by accident — when auth happens to be configured at BUILD
 * time, `currentUser()` touches headers and Next infers dynamic. Build once
 * without the env vars present and the same page is frozen as static HTML,
 * which then serves a signed-out shell to everyone forever. Stating it
 * removes the dependency on build-time configuration entirely.
 */
export const dynamic = 'force-dynamic';

/**
 * The landing page.
 *
 * Signed-in visitors go straight to their trips — a marketing page is not what
 * someone who already has an account came for.
 *
 * The structure follows the brand's own argument: the trapezium holds the
 * whole trip (the four dimensions), and getting there is a journey with stages
 * (the route section). Both are drawn with the mark's geometry rather than
 * described in prose.
 */

const DIMENSIONS = [
  {
    Icon: TransportIcon,
    title: 'Transport',
    lede: 'Get there',
    body: 'Intercity options with real timings and fares, plus how you will get around once you arrive.',
  },
  {
    Icon: StayIcon,
    title: 'Stay',
    lede: 'Feel at home',
    body: 'Somewhere to sleep that is near the things you actually planned to do, at a price that fits.',
  },
  {
    Icon: PlacesIcon,
    title: 'Places & activities',
    lede: 'Make memories',
    body: 'Sights, food and things to do, grouped by area so a day does not zig-zag across the map.',
  },
  {
    Icon: BudgetIcon,
    title: 'Budget & planning',
    lede: 'Stay on track',
    body: 'Every cost counted, every total checked, and honest answers when a trip will not fit.',
  },
] as const;

const JOURNEY = [
  { step: 'Tell us about your trip', detail: 'Where, when, who, and what you have to spend.' },
  { step: 'We find your options', detail: 'Transport, places to stay, and things worth doing.' },
  { step: 'We build your itinerary', detail: 'Opening hours, travel times and meals, on a clock.' },
  { step: 'We optimise your budget', detail: 'Substitutions that keep the trip inside its total.' },
  {
    step: 'You review and choose',
    detail: 'Cheapest, balanced or premium — with the reasons why.',
  },
  {
    step: 'You book and prepare',
    detail: 'Links to the provider, and a checklist of what is left.',
  },
  { step: 'You travel', detail: 'The whole plan in your pocket, day by day.' },
] as const;

export default async function HomePage() {
  if (await currentUser()) redirect('/trips');

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* ---------------------------------------------------------------
            Hero — a thesis, not a billboard. Generous whitespace, the mark
            given room to be read, and exactly two things to do.
        ---------------------------------------------------------------- */}
        {/* Sized to the viewport minus the sticky header, so the hero fills
            the first screen without pushing its own call to action below the
            fold. `svh` rather than `vh`: on mobile browsers `vh` includes the
            retracting address bar and overflows. */}
        <section className="relative flex min-h-[calc(100svh-3.75rem)] items-center overflow-hidden">
          {/* Quiet geometry behind the type: decorative, low contrast, and
              well clear of the text it sits behind. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="clip-trapezium bg-sage-soft/60 absolute -top-24 -right-24 h-[420px] w-[520px] rotate-6" />
            <div className="clip-trapezium-down bg-peach-soft/70 absolute -bottom-32 -left-40 h-[300px] w-[460px] -rotate-3" />
          </div>

          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-10 sm:px-8 sm:py-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            <div className="animate-rise flex flex-col items-start gap-5">
              <span className="border-sage/40 bg-surface text-sage-deep inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
                <span aria-hidden className="clip-trapezium bg-sage h-2.5 w-3" />
                End-to-end trip planning
              </span>

              <h1 className="text-forest font-serif text-[2.6rem] leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl">
                Plan the whole journey.
                <span className="text-sage-deep block">Not just the destination.</span>
              </h1>

              <p className="text-ink-soft max-w-xl text-lg leading-relaxed">
                From getting there to getting ready, <Wordmark className="text-lg" /> brings your
                entire trip together in one intelligent plan — transport, stay, places, itinerary
                and budget, all agreeing with each other.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <ButtonLink href="/register" size="lg">
                  Plan a trip
                </ButtonLink>
                <ButtonLink href="#how-it-works" variant="secondary" size="lg">
                  Explore how it works
                </ButtonLink>
              </div>

              <p className="text-ink-muted text-sm">
                Tell it five days, four people and ₹40,000 — it returns a plan that actually adds
                up, or explains why it cannot.
              </p>
            </div>

            {/* The mark at full size: the brand's clearest statement, and the
                moment the trapezium wordplay becomes available to notice. */}
            {/* Hidden on phones. Shrunk down it stopped being a brand statement
                and became a small box of nothing, and it pushed the CTAs off the
                first screen. The mark still sits in the header on every page. */}
            <div className="relative hidden justify-center md:flex lg:justify-end">
              <div className="border-line bg-surface relative w-full max-w-md rounded-xl border p-8 shadow-[var(--shadow-lg)] sm:p-10">
                <TrapeziumMark size={280} animated className="mx-auto w-full max-w-[280px]" />
                <div className="border-line mt-6 flex flex-col items-center gap-1 border-t pt-5 text-center">
                  <Wordmark className="text-2xl sm:text-3xl" />
                  <p className="text-ink-muted text-sm">
                    Plan the whole journey. Not just the destination.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            The four dimensions, framed as what the shape holds.
        ---------------------------------------------------------------- */}
        <section id="how-it-works" className="border-line bg-surface/70 border-y">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <div className="flex flex-col gap-3">
              <SectionHeading>Everything inside one shape</SectionHeading>
              <h2 className="text-forest max-w-2xl font-serif text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                A trip is four things that have to agree with each other.
              </h2>
              <p className="text-ink-soft max-w-2xl">
                Most planners solve one of these and leave you to reconcile the rest. Change your
                hotel here and the travel times, the day&rsquo;s order and the budget all follow.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DIMENSIONS.map(({ Icon, title, lede, body }) => (
                <Card key={title} interactive className="flex flex-col gap-3">
                  <span className="bg-sage-soft text-forest grid size-11 place-items-center rounded-md">
                    <Icon size={22} />
                  </span>
                  <div>
                    <h3 className="text-forest font-serif text-lg font-bold">{title}</h3>
                    <p className="text-sage-deep text-sm font-medium">{lede}</p>
                  </div>
                  <p className="text-ink-soft text-sm leading-relaxed">{body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            The journey — the route line from the mark, at page scale.
        ---------------------------------------------------------------- */}
        <section className="relative overflow-hidden">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <div className="flex flex-col gap-3">
              <SectionHeading>How a trip comes together</SectionHeading>
              <h2 className="text-forest max-w-2xl font-serif text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                One route, from an idea to a departure.
              </h2>
            </div>

            <RouteLine
              variant="climb"
              animated
              className="text-sage mt-8 hidden h-16 w-full lg:block"
            />

            <ol className="border-line bg-line mt-8 grid gap-px overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-4">
              {JOURNEY.map((item, index) => (
                <li key={item.step} className="bg-surface flex flex-col gap-2 p-5">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="clip-trapezium bg-forest text-cream grid h-6 w-8 place-items-center text-[11px] font-semibold"
                    >
                      {index + 1}
                    </span>
                    {index === JOURNEY.length - 1 && (
                      <span className="text-terracotta text-xs font-medium">arrival</span>
                    )}
                  </span>
                  <h3 className="text-forest font-medium">{item.step}</h3>
                  <p className="text-ink-soft text-sm leading-relaxed">{item.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            Closing CTA on a forest band with an angled top edge — the
            geometry doing a structural job rather than a decorative one.
        ---------------------------------------------------------------- */}
        <section className="clip-slope-top bg-forest relative">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-5 py-20 text-center sm:px-8 sm:py-24">
            <TrapeziumMark size={64} />
            <h2 className="text-cream max-w-2xl font-serif text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Your next trip, planned properly.
            </h2>
            <p className="text-cream/75 max-w-xl">
              Free to plan. Nothing is booked on your behalf — every recommendation links out to the
              provider so you stay in control.
            </p>
            <ButtonLink href="/register" size="lg">
              Plan a trip
            </ButtonLink>
          </div>
        </section>

        <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
          <SetupNotice />
        </div>
      </main>

      <footer className="border-line bg-surface/60 border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 sm:px-8">
          <div className="flex flex-col gap-1">
            <Wordmark className="text-base" />
            <p className="text-ink-muted text-xs">
              Plan the whole journey. Not just the destination.
            </p>
          </div>
          <p className="text-ink-muted max-w-sm text-xs leading-relaxed">
            Transport and accommodation figures are researched estimates, not live availability.
            Confirm with the provider before booking.
          </p>
        </div>
      </footer>
    </>
  );
}
