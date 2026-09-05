import { SiteHeader } from '@/components/site-header';
import { SetupNotice } from '@/components/setup-notice';
import { TrapeziumMark, Wordmark } from '@/components/brand/logo';
import { HeroJourney } from '@/components/brand/hero-journey';
import { HeroTitle } from '@/components/brand/hero-interactive-title';
import { ScrollGlowHeading } from '@/components/brand/scroll-aligned-glow';
import {
  BudgetIcon,
  PlacesIcon,
  StayIcon,
  TransportIcon,
} from '@/components/brand/icons';
import { ButtonLink, Card, SectionHeading, cx } from '@/components/ui';
import { currentUser } from '@/server/auth/guard';

/**
 * Rendered per request, always.
 *
 * This page reads the session, so it must never be prerendered. Without this
 * it is only dynamic by accident, when auth happens to be configured at BUILD
 * time, `currentUser()` touches headers and Next infers dynamic. Build once
 * without the env vars present and the same page is frozen as static HTML,
 * which then serves a signed-out shell to everyone forever. Stating it
 * removes the dependency on build-time configuration entirely.
 */
export const dynamic = 'force-dynamic';

/**
 * The landing page.
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
  {
    step: 'Tell us about your trip',
    detail: 'Where, when, who, and what you have to spend.',
    colSpan: 'col-span-12 sm:col-span-12 lg:col-span-5',
    clipPath: 'polygon(0% 0%, calc(100% - 16px) 0%, 100% 100%, 0% 100%)',
    tag: 'departure',
  },
  {
    step: 'We find your options',
    detail: 'Transport, places to stay, and things worth doing.',
    colSpan: 'col-span-12 sm:col-span-6 lg:col-span-3',
    clipPath: 'polygon(14px 0%, calc(100% - 14px) 0%, 100% 100%, 0% 100%)',
  },
  {
    step: 'We build your itinerary',
    detail: 'Opening hours, travel times and meals, on a clock.',
    colSpan: 'col-span-12 sm:col-span-6 lg:col-span-4',
    clipPath: 'polygon(16px 0%, 100% 0%, 100% 100%, 0% 100%)',
  },
  {
    step: 'We optimise your budget',
    detail: 'Substitutions that keep the trip inside its total.',
    colSpan: 'col-span-12 sm:col-span-6 lg:col-span-3',
    clipPath: 'polygon(0% 0%, calc(100% - 14px) 0%, 100% 100%, 0% 100%)',
  },
  {
    step: 'You review and choose',
    detail: 'Cheapest, balanced or premium: with the reasons why.',
    colSpan: 'col-span-12 sm:col-span-6 lg:col-span-3',
    clipPath: 'polygon(14px 0%, calc(100% - 14px) 0%, 100% 100%, 0% 100%)',
  },
  {
    step: 'You book and prepare',
    detail: 'Links to the provider, and a checklist of what is left.',
    colSpan: 'col-span-12 sm:col-span-6 lg:col-span-3',
    clipPath: 'polygon(14px 0%, calc(100% - 14px) 0%, 100% 100%, 0% 100%)',
  },
  {
    step: 'You travel',
    detail: 'The whole plan in your pocket, day by day.',
    colSpan: 'col-span-12 sm:col-span-6 lg:col-span-3',
    clipPath: 'polygon(14px 0%, 100% 0%, 100% 100%, 0% 100%)',
    tag: 'arrival',
  },
] as const;

export default async function HomePage() {
  const user = await currentUser();

  return (
    <>
      <SiteHeader />

      <main className="relative flex-1 overflow-hidden">
        {/* Full-Page Vertical Journey Path with Scroll-Tracking Location Pin */}
        <HeroJourney />

        {/* ---------------------------------------------------------------
            Hero: Full-across layout guaranteed to fit viewport on all window sizes
        ---------------------------------------------------------------- */}
        <section className="relative z-10 flex min-h-[calc(100svh-3.5rem)] lg:h-[calc(100svh-3.5rem)] lg:max-h-[820px] w-full flex-col items-center justify-center px-4 py-8 sm:py-5">

          {/* Full-width Centered Hero Content */}
          <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center text-center gap-3 sm:gap-3.5 animate-rise">
            <ScrollGlowHeading as="div">
              <span className="border-sage/40 bg-surface/85 text-sage-deep inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium shadow-xs backdrop-blur-xs">
                <span aria-hidden className="clip-trapezium bg-[#FF3D00] h-2 w-2 animate-pulse" />
                Unified travel planning across all four dimensions
              </span>
            </ScrollGlowHeading>

            <HeroTitle />

            <p className="text-ink-soft max-w-xl text-xs sm:text-sm md:text-base leading-relaxed text-balance">
              From getting there to getting ready, <Wordmark className="text-sm sm:text-base" /> brings your
              entire trip together in one intelligent plan: transport, stay, places, itinerary
              and budget, all agreeing with each other.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1 w-full max-w-xs sm:max-w-none">
              <ButtonLink href={user ? '/trips/new' : '/register'} size="md" className="w-full sm:w-auto shadow-md">
                Plan a trip
              </ButtonLink>
              {user ? (
                <ButtonLink href="/trips" variant="secondary" size="md" className="w-full sm:w-auto">
                  View my trips
                </ButtonLink>
              ) : (
                <ButtonLink href="#how-it-works" variant="secondary" size="md" className="w-full sm:w-auto">
                  Explore how it works
                </ButtonLink>
              )}
            </div>

            {/* Quick feature dimension indicators */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-1.5 sm:gap-2 pt-1 text-[10px] sm:text-[10.5px] w-full max-w-xs sm:max-w-none">
              <span className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-surface/80 px-2 py-1 font-medium text-forest backdrop-blur-xs shadow-xs">
                <span className="size-1.5 rounded-full bg-sage-deep" />
                Transport synced
              </span>
              <span className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-surface/80 px-2 py-1 font-medium text-forest backdrop-blur-xs shadow-xs">
                <span className="size-1.5 rounded-full bg-sage-deep" />
                Stays matched
              </span>
              <span className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-surface/80 px-2 py-1 font-medium text-forest backdrop-blur-xs shadow-xs">
                <span className="size-1.5 rounded-full bg-sage-deep" />
                Places grouped
              </span>
              <span className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-surface/80 px-2 py-1 font-medium text-forest backdrop-blur-xs shadow-xs">
                <span className="size-1.5 rounded-full bg-[#FF3D00]" />
                Budget reconciled
              </span>
            </div>

            <p className="text-ink-muted text-[11px] sm:text-xs max-w-md">
              Tell it five days, four people and ₹40,000: it returns a plan that actually adds
              up, or explains why it cannot.
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            The four dimensions, framed as what the shape holds.
        ---------------------------------------------------------------- */}
        <section id="how-it-works" className="border-line bg-surface/70 border-y">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-8 sm:py-20">
            <div className="flex flex-col gap-3">
              <ScrollGlowHeading as="div">
                <SectionHeading>Everything inside one shape</SectionHeading>
              </ScrollGlowHeading>
              <ScrollGlowHeading as="h2" className="text-forest max-w-2xl font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-balance">
                A trip is four things that have to agree with each other.
              </ScrollGlowHeading>
              <p className="text-ink-soft max-w-2xl text-sm sm:text-base leading-relaxed">
                Most planners solve one of these and leave you to reconcile the rest. Change your
                hotel here and the travel times, the day&rsquo;s order and the budget all follow.
              </p>
            </div>

            <div className="mt-8 sm:mt-10 grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DIMENSIONS.map(({ Icon, title, lede, body }) => (
                <Card key={title} className="flex flex-col gap-3 p-4 sm:p-5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sage-deep">
                      <Icon size={20} />
                    </span>
                    <span className="text-ink-muted text-[11px] sm:text-xs font-medium tracking-wide uppercase">
                      {lede}
                    </span>
                  </div>
                  <h3 className="text-forest font-serif text-base sm:text-lg font-bold">{title}</h3>
                  <p className="text-ink-soft text-xs sm:text-sm leading-relaxed">{body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            The journey: the route line from the mark, at page scale.
        ---------------------------------------------------------------- */}
        <section className="relative overflow-hidden">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-8 sm:py-20">
            <div className="flex flex-col gap-3">
              <ScrollGlowHeading as="div">
                <SectionHeading>How a trip comes together</SectionHeading>
              </ScrollGlowHeading>
              <ScrollGlowHeading as="h2" className="text-forest max-w-2xl font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-balance">
                One route, from an idea to a departure.
              </ScrollGlowHeading>
            </div>

            <ol className="mt-8 grid grid-cols-12 gap-3 sm:gap-4">
              {JOURNEY.map((item, index) => {
                const isArrival = index === JOURNEY.length - 1;
                return (
                  <li
                    key={item.step}
                    className={cx(
                      'group relative h-full transition-all duration-300 hover:-translate-y-1',
                      item.colSpan,
                    )}
                  >
                    {/* Trapezium outer border wrapper with drop shadow and mobile responsive class */}
                    <div
                      className={cx(
                        'journey-trapezium-card h-full p-[1.5px] transition-colors duration-300 drop-shadow-[0_2px_8px_rgba(23,42,35,0.06)] group-hover:drop-shadow-[0_6px_16px_rgba(23,42,35,0.12)]',
                        isArrival
                          ? 'bg-gradient-to-br from-[#FF3D00]/70 via-forest/40 to-[#FF3D00]/80'
                          : 'bg-line-strong/60 group-hover:bg-forest/50',
                      )}
                      style={{ clipPath: item.clipPath }}
                    >
                      {/* Trapezium inner card content */}
                      <div
                        className={cx(
                          'journey-trapezium-card flex h-full flex-col justify-between gap-3 p-4 sm:p-6 transition-colors duration-300',
                          isArrival
                            ? 'bg-gradient-to-br from-surface via-surface to-[#FF3D00]/[0.06]'
                            : 'bg-surface/95 group-hover:bg-surface',
                        )}
                        style={{ clipPath: item.clipPath }}
                      >
                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              aria-hidden
                              className={cx(
                                'clip-trapezium grid h-6 w-8 place-items-center text-[11px] font-semibold transition-transform duration-200 group-hover:scale-105',
                                isArrival ? 'bg-[#FF3D00] text-cream' : 'bg-forest text-cream',
                              )}
                            >
                              {index + 1}
                            </span>
                            {'tag' in item && item.tag && (
                              <span
                                className={cx(
                                  'text-xs font-semibold uppercase tracking-wider',
                                  isArrival ? 'text-[#FF3D00]' : 'text-forest/70',
                                )}
                              >
                                {item.tag}
                              </span>
                            )}
                          </div>
                          <h3 className="text-forest font-medium text-base sm:text-lg">{item.step}</h3>
                        </div>
                        <p className="text-ink-soft text-xs sm:text-sm leading-relaxed">{item.detail}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            Closing CTA on a forest band with an angled top edge: the
            geometry doing a structural job rather than a decorative one.
        ---------------------------------------------------------------- */}
        <section className="clip-slope-top bg-forest relative">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-8 sm:py-24">
            <TrapeziumMark size={64} />
            <ScrollGlowHeading as="h2" className="text-cream max-w-2xl font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-balance">
              Your next trip, planned properly.
            </ScrollGlowHeading>
            <p className="text-cream/75 max-w-xl text-xs sm:text-sm leading-relaxed">
              Free to plan. Nothing is booked on your behalf: every recommendation links out to the
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
          </p>
        </div>
      </footer>
    </>
  );
}
