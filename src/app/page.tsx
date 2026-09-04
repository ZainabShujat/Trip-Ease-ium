import { describeProviders } from '@/providers/registry';

/**
 * Phase 1 status page.
 *
 * Deliberately plain. The Trip Dashboard is the visual centrepiece and it
 * arrives in Phase 4 — shipping a decorative landing page now would be
 * pretending to have a product that does not exist yet. What this page does do
 * is prove the stack boots and state honestly what is and is not built.
 */
export default function Home() {
  const { mode, providers } = describeProviders();

  const foundations = [
    { label: 'Next.js 16 · React 19 · TypeScript strict', done: true },
    { label: 'Domain contracts (Zod schemas, inferred types)', done: true },
    { label: 'Prisma schema — 21 tables, migration generated', done: true },
    { label: 'Provider interfaces + deterministic mocks', done: true },
    { label: 'Delhi → Manali fixture (21 POIs, 6 stays, 7 services)', done: true },
    { label: 'Whitelisted link builder', done: true },
    { label: 'Vitest suite', done: true },
    { label: 'Planning engine — scheduling, budget, validation', done: false },
    { label: 'Authentication and trip persistence', done: false },
    { label: 'Trip Dashboard', done: false },
    { label: 'AI intake and rationale', done: false },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-xs tracking-[0.2em] text-zinc-500 uppercase">
          Phase 1 — Skeleton &amp; contracts
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">AI Travel Planner</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Foundation for an end-to-end trip planning and management platform. The planning engine is
          deterministic; the language model interprets and explains but never computes times, prices
          or links.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs tracking-[0.15em] text-zinc-500 uppercase">
          Build status
        </h2>
        <ul className="flex flex-col gap-1.5">
          {foundations.map((item) => (
            <li key={item.label} className="flex items-start gap-3 text-sm">
              <span
                aria-hidden
                className={
                  item.done
                    ? 'mt-[3px] font-mono text-emerald-600 dark:text-emerald-400'
                    : 'mt-[3px] font-mono text-zinc-400 dark:text-zinc-600'
                }
              >
                {item.done ? '✓' : '○'}
              </span>
              <span className={item.done ? '' : 'text-zinc-500 dark:text-zinc-500'}>
                {item.label}
                {!item.done && <span className="text-zinc-400"> — later phase</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded border border-amber-300/60 bg-amber-50/60 p-4 dark:border-amber-500/25 dark:bg-amber-950/20">
        <h2 className="font-mono text-xs tracking-[0.15em] text-amber-700 uppercase dark:text-amber-500">
          Data source: {mode}
        </h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Every provider below serves deterministic fixture data. Nothing in this application is
          live availability, and no price shown is a quotation.
        </p>
        <ul className="flex flex-wrap gap-2">
          {providers.map((provider) => (
            <li
              key={provider.name}
              className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
            >
              {provider.name} · {provider.sourceKind}
            </li>
          ))}
        </ul>
      </section>

      <footer className="font-mono text-xs text-zinc-500">
        <a
          className="underline underline-offset-4 hover:text-zinc-800 dark:hover:text-zinc-200"
          href="/api/health"
        >
          /api/health
        </a>
      </footer>
    </main>
  );
}
