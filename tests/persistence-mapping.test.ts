import { describe, expect, it } from 'vitest';
import {
  CONFIDENCE_TO_DB,
  SOURCE_KIND_TO_DB,
  asJson,
  budgetLineRows,
  fromDbDate,
  itineraryDayRow,
  itineraryItemRows,
  lodgingOptionRow,
  preferenceFromBrief,
  snapshotFor,
  taskRowsFor,
  toDbDate,
  transportOptionRow,
  travellersFromBrief,
  tripHeaderFromBrief,
} from '@/server/trips/mapping';
import { ConfidenceSchema, SourceKindSchema } from '@/lib/schemas';
import { rupees } from '@/lib/money';
import { makeBrief, planOrThrow } from './helpers/plan';

/**
 * Persistence mapping.
 *
 * Pure functions, so the whole translation from a plan to database rows is
 * testable with no database — which keeps the offline guarantee intact and
 * covers the layer where a plan quietly loses information: a dropped enum, a
 * mangled money unit, a lost link.
 */

describe('enum bridges', () => {
  it('maps every domain source kind to a database value', () => {
    // A missing entry would persist `undefined` and let mock data render as
    // live, which is the worst failure this system could have.
    for (const kind of SourceKindSchema.options) {
      expect(SOURCE_KIND_TO_DB[kind], kind).toBeTruthy();
    }
  });

  it('maps every confidence level', () => {
    for (const level of ConfidenceSchema.options) {
      expect(CONFIDENCE_TO_DB[level], level).toBeTruthy();
    }
  });

  it('uppercases without inventing new values', () => {
    expect(SOURCE_KIND_TO_DB.mock).toBe('MOCK');
    expect(SOURCE_KIND_TO_DB.live).toBe('LIVE');
    expect(CONFIDENCE_TO_DB.medium).toBe('MEDIUM');
  });
});

describe('date conversion', () => {
  it('round-trips a calendar date without shifting it', () => {
    // Timezone drift here moves a whole itinerary by a day.
    for (const date of ['2026-10-12', '2026-01-01', '2026-12-31', '2026-03-29']) {
      expect(fromDbDate(toDbDate(date))).toBe(date);
    }
  });

  it('stores dates at UTC midnight', () => {
    expect(toDbDate('2026-10-12').toISOString()).toBe('2026-10-12T00:00:00.000Z');
  });
});

describe('asJson', () => {
  it('strips undefined, which Prisma rejects in JSON columns', () => {
    const result = asJson({ kept: 1, dropped: undefined }) as Record<string, unknown>;
    expect(result).toEqual({ kept: 1 });
    expect('dropped' in result).toBe(false);
  });

  it('preserves nested structure', () => {
    const value = { a: [1, 2, { b: 'c' }], d: null };
    expect(asJson(value)).toEqual(value);
  });
});

describe('trip header', () => {
  const brief = makeBrief();

  it('carries every field the dashboard needs', () => {
    const header = tripHeaderFromBrief(brief);
    expect(header.originCity).toBe('Delhi');
    expect(header.destinationCity).toBe('Manali');
    expect(header.travellerCount).toBe(4);
    expect(header.budgetTotalMinor).toBe(rupees(40_000));
    expect(header.currency).toBe('INR');
  });

  it('derives a title when none is given', () => {
    expect(tripHeaderFromBrief(brief).title).toBe('Manali trip');
  });

  it('prefers a supplied title, trimmed', () => {
    expect(tripHeaderFromBrief(brief, '  Autumn in Manali  ').title).toBe('Autumn in Manali');
  });

  it('falls back when a supplied title is only whitespace', () => {
    expect(tripHeaderFromBrief(brief, '   ').title).toBe('Manali trip');
  });

  it('keeps money as an integer', () => {
    expect(Number.isInteger(tripHeaderFromBrief(brief).budgetTotalMinor)).toBe(true);
  });

  it('stores null rather than 0 for absent coordinates', () => {
    // 0,0 is a real place in the Atlantic; conflating it with "unknown" would
    // put a trip origin in the ocean.
    const noGeo = makeBrief({ origin: { name: 'Nowhere' } });
    expect(tripHeaderFromBrief(noGeo).originLat).toBeNull();
  });
});

describe('preferences and travellers', () => {
  it('maps every preference the replan stage will need', () => {
    const brief = makeBrief({
      interests: ['NATURE'],
      avoidOvernightTransport: true,
      pace: 'RELAXED',
    });
    const row = preferenceFromBrief(brief);
    expect(row.pace).toBe('RELAXED');
    expect(row.interests).toEqual(['NATURE']);
    expect(row.avoidOvernightTransport).toBe(true);
    expect(row.wakeTime).toBe('08:00');
  });

  it('names unnamed travellers rather than storing empty strings', () => {
    const brief = makeBrief({
      travellerCount: 2,
      travellers: [{ ageBand: 'ADULT' }, { ageBand: 'CHILD' }],
    });
    const rows = travellersFromBrief(brief);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.name).toBe('Traveller 1');
    expect(rows[1]!.ageBand).toBe('CHILD');
  });

  it('handles a brief with no traveller detail', () => {
    expect(travellersFromBrief(makeBrief())).toEqual([]);
  });
});

describe('mapping a real plan', () => {
  it('preserves provenance through the option rows', async () => {
    const plan = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(60_000) }));

    const transport = transportOptionRow(plan.selections.outbound, true);
    expect(transport.sourceKind).toBe('MOCK');
    expect(transport.isSelected).toBe(true);
    expect(transport.provider).toBeTruthy();

    const lodging = lodgingOptionRow(plan.selections.lodging, true);
    expect(lodging.sourceKind).toBe('MOCK');
    expect(lodging.totalRateMinor).toBe(plan.selections.lodging.totalRateMinor);
  });

  it('takes the booking URL from the link, never inventing one', async () => {
    const plan = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(60_000) }));
    const row = lodgingOptionRow(plan.selections.lodging, true);
    if (plan.selections.lodging.link) {
      expect(row.bookingUrl).toBe(plan.selections.lodging.link.url);
    } else {
      expect(row.bookingUrl).toBeNull();
    }
  });

  it('maps every itinerary item without losing a field', async () => {
    const plan = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(60_000) }));
    const day = plan.days.find((d) => d.items.length > 0)!;
    const rows = itineraryItemRows(day, new Map());

    expect(rows).toHaveLength(day.items.length);
    rows.forEach((row, i) => {
      const item = day.items[i]!;
      expect(row.startTime).toBe(item.startTime);
      expect(row.endTime).toBe(item.endTime);
      expect(row.durationMins).toBe(item.durationMins);
      expect(row.estimatedCostMinor).toBe(item.estimatedCostMinor);
      expect(row.category).toBe(item.category);
    });
  });

  it('does not link an item to a Poi row that does not exist', async () => {
    // The fixture's domain ids are not database ids; a blind copy would create
    // a dangling foreign key.
    const plan = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(60_000) }));
    const day = plan.days.find((d) => d.items.some((i) => i.poiId))!;
    const rows = itineraryItemRows(day, new Map());
    expect(rows.every((row) => row.poiId === null)).toBe(true);
  });

  it('resolves a Poi id when the row exists', async () => {
    const plan = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(60_000) }));
    const day = plan.days.find((d) => d.items.some((i) => i.poiId))!;
    const item = day.items.find((i) => i.poiId)!;
    const rows = itineraryItemRows(day, new Map([[item.poiId!, 'db-poi-1']]));
    expect(rows.find((r) => r.title === item.title)!.poiId).toBe('db-poi-1');
  });

  it('preserves the day totals exactly', async () => {
    const plan = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(60_000) }));
    for (const day of plan.days) {
      const row = itineraryDayRow(day);
      expect(row.totalCostMinor).toBe(day.totalCostMinor);
      expect(row.dayIndex).toBe(day.dayIndex);
      expect(fromDbDate(row.date)).toBe(day.date);
    }
  });

  it('maps budget lines so they still sum to the plan total', async () => {
    const plan = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(60_000) }));
    const rows = budgetLineRows(plan.budget);
    const sum = rows.reduce((total, row) => total + row.estimatedMinor, 0);
    expect(sum).toBe(plan.budget.totalEstimatedMinor);
    expect(rows).toHaveLength(6);
  });
});

describe('readiness tasks', () => {
  it('seeds booking tasks from the actual selections', async () => {
    const plan = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(60_000) }));
    const tasks = taskRowsFor(plan);

    expect(tasks.some((t) => t.label.includes(plan.selections.lodging.name))).toBe(true);
    expect(tasks.some((t) => t.label.includes(plan.selections.outbound.operator))).toBe(true);
    expect(tasks.every((t) => t.autoGenerated)).toBe(true);
  });

  it('numbers tasks in a stable order', async () => {
    const plan = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(60_000) }));
    const tasks = taskRowsFor(plan);
    expect(tasks.map((t) => t.seq)).toEqual(tasks.map((_, i) => i));
  });

  it('adds a permit task only when a permit-controlled place is scheduled', async () => {
    const plan = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(200_000) }));
    const scheduledIds = new Set(
      plan.days.flatMap((d) => d.items.map((i) => i.poiId).filter(Boolean)),
    );
    const rohtangScheduled = scheduledIds.has('poi-rohtang');
    const hasPermitTask = taskRowsFor(plan).some((t) => t.kind === 'PERMIT');
    expect(hasPermitTask).toBe(rohtangScheduled);
  });

  it('is deterministic', async () => {
    const plan = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(60_000) }));
    expect(taskRowsFor(plan)).toEqual(taskRowsFor(plan));
  });
});

describe('version snapshot', () => {
  it('captures everything needed to restore or diff a plan', async () => {
    const plan = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(60_000) }));
    const snapshot = snapshotFor(plan);

    expect(snapshot.brief).toEqual(plan.brief);
    expect(snapshot.days).toHaveLength(plan.days.length);
    expect(snapshot.budget.totalEstimatedMinor).toBe(plan.budget.totalEstimatedMinor);
    expect(snapshot.clusterStrategy).toBe(plan.clusterStrategy);
    expect(snapshot.relaxedConstraints).toEqual(plan.relaxedConstraints);
  });

  it('survives JSON serialisation without losing the itinerary', async () => {
    const plan = await planOrThrow(makeBrief({ budgetTotalMinor: rupees(60_000) }));
    const round = JSON.parse(JSON.stringify(asJson(snapshotFor(plan))));
    expect(round.days).toHaveLength(plan.days.length);
    expect(round.budget.totalEstimatedMinor).toBe(plan.budget.totalEstimatedMinor);
  });
});
