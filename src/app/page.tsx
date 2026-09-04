import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { ButtonLink, Card } from '@/components/ui';
import { SetupNotice } from '@/components/setup-notice';
import { currentUser } from '@/server/auth/guard';

/**
 * The landing page.
 *
 * Signed-in visitors go straight to their trips — a marketing page is not what
 * someone who already has an account came for.
 */
export default async function HomePage() {
  if (await currentUser()) redirect('/trips');

  const steps = [
    {
      title: 'Say where and when',
      body: 'Origin, dates, party size, budget, and what you actually enjoy.',
    },
    {
      title: 'The planner does the arithmetic',
      body: 'Transport, a place to stay, and a day-by-day itinerary that respects opening hours, travel times and your budget.',
    },
    {
      title: 'Check it and book',
      body: 'Every recommendation links out to the provider. Nothing is booked on your behalf.',
    },
  ];

  return (
    <>
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-14 px-6 py-16">
        <section className="flex flex-col gap-5">
          <p className="text-muted font-mono text-xs tracking-[0.18em] uppercase">
            Trip planning that adds up
          </p>
          <h1 className="max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
            Plans that respect opening hours, travel time and your actual budget.
          </h1>
          <p className="text-ink-soft max-w-2xl text-lg">
            Tell it you have five days, four people and ₹40,000, and get a complete itinerary — not
            a wall of suggestions. Every time and every total is computed, then checked. A plan that
            breaks its own constraints is never shown.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <ButtonLink href="/register">Plan a trip</ButtonLink>
            <ButtonLink href="/login" variant="secondary">
              Sign in
            </ButtonLink>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <Card key={step.title} className="flex flex-col gap-2">
              <span className="text-accent font-mono text-xs">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h2 className="font-semibold">{step.title}</h2>
              <p className="text-ink-soft text-sm">{step.body}</p>
            </Card>
          ))}
        </section>

        {/* Honesty, on the front page rather than buried in a footer. */}
        <section className="border-flag/40 bg-flag-soft/50 rounded-lg border p-5">
          <h2 className="text-flag font-mono text-xs tracking-[0.15em] uppercase">
            About the data
          </h2>
          <p className="text-ink-soft mt-2 max-w-3xl text-sm">
            Transport and accommodation are served from researched sample data, not live
            availability, because no public booking API exists for Indian bus and rail operators.
            Prices are realistic ranges, never quotations. Everything you see is labelled with where
            it came from, and every booking button sends you to the provider to check for yourself.
          </p>
        </section>

        <SetupNotice />
      </main>

      <footer className="border-line border-t px-6 py-6">
        <div className="text-muted mx-auto flex w-full max-w-5xl justify-between font-mono text-xs">
          <span>Final-year project</span>
          <a href="/api/health" className="hover:text-accent">
            status
          </a>
        </div>
      </footer>
    </>
  );
}
