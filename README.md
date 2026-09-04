# AI Travel Planner

End-to-end trip planning and management: intercity transport, accommodation,
places, a validated day-by-day itinerary, a budget that adds up, and dynamic
re-planning when constraints change.

**Current status: Phase 1 — Skeleton & Contracts.** The foundation is in place;
the planning engine, authentication, dashboard and AI layer are later phases.

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

No API keys and no database are required. `PROVIDER_MODE` defaults to `mock`,
which serves deterministic fixtures and makes zero network calls. Open
[localhost:3000](http://localhost:3000), or `/api/health` for provider status.

To connect a database (needed from Phase 3 onward):

```bash
cp .env.example .env
# paste your Neon connection string into DATABASE_URL, then:
npm run db:migrate
```

## Verifying

```bash
npm run verify
```

Runs `typecheck`, `lint` and `test` in sequence. Individually:

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm run typecheck` | `tsc --noEmit`, strict plus `noUncheckedIndexedAccess` |
| `npm run lint`      | ESLint, including the engine-purity rule        |
| `npm test`          | Vitest, 109 tests                               |
| `npm run build`     | Production build                                |
| `npm run format`    | Prettier                                        |

## Layout

```
src/
  app/            routes — thin; parse, authorise, delegate, render
  components/     presentational; no business logic, no fetching
  engine/         ◆ pure TypeScript, no framework imports ◆
  ai/             LlmClient interface, versioned prompts, task schemas
  providers/      interfaces + mock/live implementations + link builder
  server/         db client, env validation
  lib/            domain schemas (Zod), money, shared types
prisma/           schema + migrations
tests/            Vitest suites and fixture entry point
```

`src/engine` is the project's spine and is kept deliberately pure: an ESLint
rule forbids it from importing React, Next, Prisma or any provider. It takes
plain data as arguments and returns plain data, so the optimiser can be tested
and benchmarked without a server, a database or an API key.

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
