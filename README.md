# AI Travel Planner

End-to-end trip planning and management: intercity transport, accommodation,
places, a validated day-by-day itinerary, a budget that adds up, and dynamic
re-planning when constraints change.

**Current status: Phase 3 — Foundation.** Sign in, plan a trip, and it saves.
The root URL is the planner. Phase 4 turns the trip page into the full
dashboard (map, timeline interactions, switching alternatives); the AI layer
is Phase 6.

## The governing decision

**The LLM interprets and explains. It never computes.**

Times, distances, prices, totals and links are produced by deterministic
TypeScript that can be unit-tested. Of the nine pipeline stages, only two use a
language model — intake (free text → `TripBrief`) and narration (a finished,
validated plan → rationale strings). The other seven are ordinary code.

Three rules enforce this, in code rather than in prompt text:

1. Structured output only — every model call is schema-constrained and Zod-parsed.
2. **No numbers from the model** — price, time and distance fields are stripped at the merge boundary.
3. **No URLs from the model** — every link comes from `src/providers/links.ts`, which builds from a host whitelist and returns `null` rather than guessing.

## Quick start

```bash
npm install
npm test
npm run dev
```

The app runs and the full test suite passes with **no keys and no database**.
Planning works offline against fixtures.

To sign in and save trips you need a Postgres database and a signing secret:

```bash
cp .env.example .env.local
```

1. Create a free project at [neon.com](https://neon.com) and copy the pooled
   connection string into `DATABASE_URL`.
2. Run `npx auth secret` and put the value in `AUTH_SECRET`.
3. Copy both into `.env` as well, so the Prisma CLI can see them.
4. `npm run db:migrate`

Google sign-in is optional — leave `AUTH_GOOGLE_*` blank and the button is
hidden. Until the database is configured, every page says so and names the
missing variable rather than erroring.

## Verifying

```bash
npm run verify
```

Runs `typecheck`, `lint` and `test` in sequence. Individually:

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm run typecheck` | `tsc --noEmit`, strict plus `noUncheckedIndexedAccess` |
| `npm run lint`      | ESLint, including the engine-purity rule        |
| `npm test`          | Vitest, 327 tests                               |
| `npm run build`     | Production build                                |
| `npm run format`    | Prettier                                        |

## Layout

```
src/
  app/            routes — thin; parse, authorise, delegate, render
  components/     presentational; no business logic, no fetching
  engine/         ◆ pure TypeScript, no framework imports ◆
  planning/       composition root: calls providers, hands the engine data
  ai/             LlmClient interface, versioned prompts, task schemas
  providers/      interfaces + mock/live implementations + link builder
  server/         auth, db client, env validation, trip persistence
  lib/            domain schemas (Zod), money, shared types
prisma/           schema + migrations
tests/            Vitest suites and fixture entry point
```

`src/engine` is the project's spine and is kept deliberately pure: an ESLint
rule forbids it from importing React, Next, Prisma or any provider. It takes
plain data as arguments and returns plain data, so the optimiser can be tested
and benchmarked without a server, a database or an API key. `src/planning` is
the composition root that calls providers and hands the engine plain data.

### The pipeline

```
TripBrief → source → score → cluster → route → schedule → budget → validate
```

Scoring is a weighted multi-objective sum; clustering picks between k-means and
three documented fallbacks; routing is nearest-neighbour plus 2-opt (provably
never worse than its seed); scheduling is a greedy interval pass with hard
constraints absolute and soft constraints relaxed in an explicit order;
the budget ledger is exact integer arithmetic; and the validation gate is an
independent check that refuses to return a plan carrying any hard violation.

A plan that cannot be built returns a typed failure — `INFEASIBLE_CONSTRAINTS`,
`BUDGET_UNREACHABLE`, `NO_CANDIDATES` — never an empty itinerary.

## Data honesty

Every value carries provenance — `live`, `cached`, `estimated` or `mock` — from
the provider through the database to the screen. Anything not live renders with
a visible marker, and its button reads **"Search on redBus"** rather than
**"Book"**.

This is a correctness requirement, not a disclaimer. There is no public API for
redBus or IRCTC, and hotel rate APIs need approved affiliate accounts, so
transport and lodging are researched mock providers behind real interfaces.
Presenting an estimate as live availability would be the single worst failure
this system could have.

The Delhi → Manali fixture documents exactly what is approximately real
(landmark coordinates, journey durations, fare bands) and what is invented
(all hotel and eatery names, which are fictional so that no real business is
misrepresented with an invented price). See
[`src/providers/mock/fixtures/delhi-manali/README.md`](src/providers/mock/fixtures/delhi-manali/README.md).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 ·
PostgreSQL · Prisma 7 · Zod 4 · Vitest

## Licence

MIT
