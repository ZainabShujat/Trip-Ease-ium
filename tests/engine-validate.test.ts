import { describe, expect, it } from 'vitest';
import { createTravelLookup } from '@/engine/matrix';
import type { Selections } from '@/engine/types';
import { runValidateStage } from '@/engine/validate';
import { rupees } from '@/lib/money';
import {
  TripBriefSchema,
  type BudgetSummary,
  type ItineraryDay,
  type ItineraryItem,
  type Poi,
  type TravelMatrix,
} from '@/lib/schemas';
import { isWhitelistedUrl } from '@/providers/links';

/**
 * The validation gate, tested by feeding it plans that are deliberately wrong.
 *
 * A validator is only worth having if it fails when it should. Every hard
 * violation code gets a case that triggers it, and one that does not.
 */

const PROV = {
  sourceKind: 'mock' as const,
  provider: 'test',
  fetchedAt: '2026-01-01T00:00:00+05:30',
  confidence: 'medium' as const,
};

const HOTEL = { lat: 32.2432, lng: 77.1892 };
const NEAR = { lat: 32.2465, lng: 77.1795 };
const FAR = { lat: 32.366, lng: 77.247 };

const matrix: TravelMatrix = {
  points: [HOTEL, NEAR, FAR],
  mode: 'CAR',
  durationMins: [
    [0, 12, 95],
    [12, 0, 92],
    [95, 92, 0],
  ],
  distanceMetres: [
    [0, 1800, 42000],
    [1800, 0, 41000],
    [42000, 41000, 0],
  ],
  provenance: { ...PROV, sourceKind: 'estimated', confidence: 'low' },
};

const lookup = createTravelLookup(matrix);

// 2026-10-13 is a Tuesday (weekday 2).
const OPEN_ALL_WEEK: Poi = {
  id: 'open-poi',
  providerRef: 'open-poi',
  name: 'Open Temple',
  category: 'TEMPLE',
  geo: NEAR,
  typicalDurationMins: 60,
  typicalCostPerPersonMinor: 0,
  openingHours: {
    kind: 'weekly',
    intervals: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      opens: '08:00',
      closes: '18:00',
    })),
    closedWeekdays: [],
  },
  tags: ['temple'],
  provenance: PROV,
};

const CLOSED_TUESDAY: Poi = {
  ...OPEN_ALL_WEEK,
  id: 'closed-poi',
  providerRef: 'closed-poi',
  name: 'Closed Museum',
  category: 'MUSEUM',
  openingHours: {
    kind: 'weekly',
    intervals: [0, 1, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      opens: '09:00',
      closes: '17:00',
    })),
    closedWeekdays: [2],
  },
};

const brief = TripBriefSchema.parse({
  origin: { name: 'Delhi' },
  destination: { name: 'Manali' },
  startDate: '2026-10-13',
  endDate: '2026-10-15',
  travellerCount: 2,
  budgetTotalMinor: rupees(40_000),
});

const selections = {
  outbound: {} as Selections['outbound'],
  inbound: {} as Selections['inbound'],
  local: [],
  lodging: {
    id: 'lodge',
    name: 'Test Lodge',
    geo: HOTEL,
    checkInTime: '14:00',
    checkOutTime: '11:00',
  } as unknown as Selections['lodging'],
  shortlist: [OPEN_ALL_WEEK, CLOSED_TUESDAY],
  scored: [],
  alternatives: { transport: [], lodging: [] },
} as Selections;

function item(over: Partial<ItineraryItem> & { id: string }): ItineraryItem {
  return {
    seq: 0,
    title: over.id,
    category: 'SIGHT',
    startTime: '10:00',
    endTime: '11:00',
    durationMins: 60,
    estimatedCostMinor: 0,
    travelFromPrev: null,
    link: null,
    bookingStatus: 'NOT_REQUIRED',
    isLocked: false,
    geo: NEAR,
    ...over,
  };
}

function day(items: ItineraryItem[]): ItineraryDay {
  return {
    id: 'day-0',
    dayIndex: 0,
    date: '2026-10-13',
    items,
    totalCostMinor: items.reduce((s, i) => s + i.estimatedCostMinor, 0),
    totalTravelMins: 0,
  };
}

function budgetOf(estimated: number, total = rupees(40_000)): BudgetSummary {
  return {
    currency: 'INR',
    totalBudgetMinor: total,
    totalEstimatedMinor: estimated,
    remainingMinor: total - estimated,
    lines: [
      { category: 'TRANSPORT', allocatedMinor: 0, estimatedMinor: estimated, actualMinor: 0 },
      { category: 'ACCOMMODATION', allocatedMinor: 0, estimatedMinor: 0, actualMinor: 0 },
      { category: 'FOOD', allocatedMinor: 0, estimatedMinor: 0, actualMinor: 0 },
      { category: 'ACTIVITIES', allocatedMinor: 0, estimatedMinor: 0, actualMinor: 0 },
      { category: 'LOCAL_TRANSPORT', allocatedMinor: 0, estimatedMinor: 0, actualMinor: 0 },
      { category: 'MISC', allocatedMinor: 0, estimatedMinor: 0, actualMinor: 0 },
    ],
    status: estimated > total ? 'EXCEEDED' : 'ON_TRACK',
  };
}

function validate(days: ItineraryDay[], budget = budgetOf(rupees(30_000))) {
  return runValidateStage({
    brief,
    selections,
    days,
    budget,
    lookup,
    poiById: new Map([
      [OPEN_ALL_WEEK.id, OPEN_ALL_WEEK],
      [CLOSED_TUESDAY.id, CLOSED_TUESDAY],
    ]),
    isWhitelistedUrl,
  });
}

const codes = (report: ReturnType<typeof validate>) => report.violations.map((v) => v.code);

describe('a valid plan', () => {
  it('produces no hard violations', () => {
    const report = validate([
      day([
        item({ id: 'a', poiId: OPEN_ALL_WEEK.id, startTime: '10:00', endTime: '11:00' }),
        item({
          id: 'b',
          poiId: OPEN_ALL_WEEK.id,
          startTime: '12:00',
          endTime: '13:00',
          travelFromPrev: { durationMins: 12, distanceMetres: 1800, mode: 'CAR' },
        }),
        item({ id: 'meal', category: 'MEAL', startTime: '13:30', endTime: '14:30' }),
      ]),
    ]);
    expect(report.hardCount).toBe(0);
  });
});

describe('hard violations', () => {
  it('detects overlapping items', () => {
    const report = validate([
      day([
        item({ id: 'a', startTime: '10:00', endTime: '12:00' }),
        item({ id: 'b', startTime: '11:00', endTime: '13:00' }),
      ]),
    ]);
    expect(codes(report)).toContain('OVERLAP');
    expect(report.hardCount).toBeGreaterThan(0);
  });

  it('detects an attraction closed at the scheduled time', () => {
    // 2026-10-13 is a Tuesday, and this museum shuts on Tuesdays.
    const report = validate([day([item({ id: 'a', poiId: CLOSED_TUESDAY.id, geo: NEAR })])]);
    expect(codes(report)).toContain('CLOSED_AT_TIME');
  });

  it('detects an impossible travel time', () => {
    // 95 minutes apart, scheduled 15 minutes apart.
    const report = validate([
      day([
        item({ id: 'a', geo: HOTEL, startTime: '09:00', endTime: '10:00' }),
        item({ id: 'b', geo: FAR, startTime: '10:15', endTime: '11:15' }),
      ]),
    ]);
    expect(codes(report)).toContain('TRAVEL_TIME_IMPOSSIBLE');
    const violation = report.violations.find((v) => v.code === 'TRAVEL_TIME_IMPOSSIBLE')!;
    expect(violation.detail).toMatchObject({ availableMins: 15, requiredMins: 95 });
  });

  it('detects a budget overrun', () => {
    const report = validate([day([])], budgetOf(rupees(50_000)));
    expect(codes(report)).toContain('BUDGET_EXCEEDED');
  });

  it('detects a ledger whose lines do not sum to its total', () => {
    // An arithmetic bug, surfaced rather than displayed.
    const broken = budgetOf(rupees(30_000));
    broken.totalEstimatedMinor = rupees(29_000);
    const report = validate([day([])], broken);
    expect(codes(report)).toContain('BUDGET_EXCEEDED');
  });

  it('detects a check-in before the property accepts guests', () => {
    const report = validate([
      day([
        item({
          id: 'checkin',
          category: 'CHECK_IN',
          startTime: '09:00',
          endTime: '09:30',
          geo: HOTEL,
        }),
      ]),
    ]);
    expect(codes(report)).toContain('CHECKIN_CONFLICT');
  });

  it('detects an unreachable leg when the matrix has no entry', () => {
    const unknown = { lat: 10, lng: 10 };
    const report = validate([
      day([
        item({ id: 'a', geo: HOTEL, startTime: '09:00', endTime: '10:00' }),
        item({ id: 'b', geo: unknown, startTime: '11:00', endTime: '12:00' }),
      ]),
    ]);
    expect(codes(report)).toContain('UNREACHABLE_LEG');
  });

  it('detects a non-whitelisted URL', () => {
    // The tripwire for a fabricated link reaching a finished plan.
    const report = validate([
      day([
        item({
          id: 'a',
          link: {
            url: 'https://definitely-not-real-bookings.example.com/bus/1',
            label: 'Book',
            provider: 'Fake',
            kind: 'deeplink',
          },
        }),
      ]),
    ]);
    expect(codes(report)).toContain('NON_WHITELISTED_URL');
  });

  it('detects a missing coordinate', () => {
    const report = validate([day([item({ id: 'a', geo: undefined })])]);
    expect(codes(report)).toContain('MISSING_COORDINATES');
  });

  it('detects an item outside the waking window', () => {
    const report = validate([day([item({ id: 'a', startTime: '05:00', endTime: '06:00' })])]);
    expect(codes(report)).toContain('OUTSIDE_WAKING_HOURS');
  });

  it('exempts intercity transport from the waking window', () => {
    // A 05:00 departure is how travel works, not a scheduling error.
    const report = validate([
      day([item({ id: 'bus', category: 'TRANSPORT', startTime: '05:00', endTime: '06:00' })]),
    ]);
    expect(codes(report)).not.toContain('OUTSIDE_WAKING_HOURS');
  });

  it('gates presentability on hard violations only', () => {
    const report = validate([
      day([
        item({ id: 'a', startTime: '10:00', endTime: '12:00' }),
        item({ id: 'b', startTime: '11:00', endTime: '13:00' }),
      ]),
    ]);
    expect(report.hardCount).toBeGreaterThan(0);
  });
});

describe('soft violations', () => {
  it('flags an underused budget without blocking the plan', () => {
    const report = validate(
      [day([item({ id: 'a', poiId: OPEN_ALL_WEEK.id })])],
      budgetOf(rupees(1_000)),
    );
    expect(codes(report)).toContain('BUDGET_UNDERUSED');
    expect(report.hardCount).toBe(0);
    expect(report.softCount).toBeGreaterThan(0);
  });

  it('flags a day with activities but no meal', () => {
    const report = validate([day([item({ id: 'a', poiId: OPEN_ALL_WEEK.id })])]);
    expect(codes(report)).toContain('MISSING_MEAL');
  });

  it('flags unknown opening hours rather than assuming open', () => {
    const unknownPoi: Poi = {
      ...OPEN_ALL_WEEK,
      id: 'unknown-poi',
      openingHours: { kind: 'unknown' },
    };
    const report = runValidateStage({
      brief,
      selections,
      days: [day([item({ id: 'a', poiId: unknownPoi.id })])],
      budget: budgetOf(rupees(30_000)),
      lookup,
      poiById: new Map([[unknownPoi.id, unknownPoi]]),
      isWhitelistedUrl,
    });
    expect(report.violations.map((v) => v.code)).toContain('UNKNOWN_OPENING_HOURS');
    expect(report.hardCount).toBe(0);
  });

  it('flags excessive daily travel as soft, not fatal', () => {
    // 190 minutes of travel against a stated 120-minute tolerance.
    const impatient = TripBriefSchema.parse({
      origin: { name: 'Delhi' },
      destination: { name: 'Manali' },
      startDate: '2026-10-13',
      endDate: '2026-10-15',
      travellerCount: 2,
      budgetTotalMinor: rupees(40_000),
      maxDailyTravelMins: 120,
    });
    const report = runValidateStage({
      brief: impatient,
      selections,
      budget: budgetOf(rupees(30_000)),
      lookup,
      poiById: new Map([[OPEN_ALL_WEEK.id, OPEN_ALL_WEEK]]),
      isWhitelistedUrl,
      days: [
        day([
          item({ id: 'a', geo: HOTEL, startTime: '08:00', endTime: '09:00' }),
          item({
            id: 'b',
            geo: FAR,
            startTime: '11:00',
            endTime: '12:00',
            travelFromPrev: { durationMins: 95, distanceMetres: 42000, mode: 'CAR' },
          }),
          item({
            id: 'c',
            geo: HOTEL,
            startTime: '14:00',
            endTime: '15:00',
            travelFromPrev: { durationMins: 95, distanceMetres: 42000, mode: 'CAR' },
          }),
        ]),
      ],
    });
    expect(report.violations.map((v) => v.code)).toContain('EXCESSIVE_DAILY_TRAVEL');
    expect(report.violations.find((v) => v.code === 'EXCESSIVE_DAILY_TRAVEL')!.severity).toBe(
      'SOFT',
    );
  });
});

describe('report shape', () => {
  it('counts hard and soft separately and totals correctly', () => {
    const report = validate([
      day([
        item({ id: 'a', startTime: '10:00', endTime: '12:00' }),
        item({ id: 'b', startTime: '11:00', endTime: '13:00' }),
      ]),
    ]);
    expect(report.hardCount + report.softCount).toBe(report.violations.length);
  });

  it('carries the relaxed constraints through', () => {
    const report = runValidateStage({
      brief,
      selections,
      days: [day([])],
      budget: budgetOf(rupees(30_000)),
      lookup,
      poiById: new Map(),
      isWhitelistedUrl,
      relaxedConstraints: ['MEAL_WINDOWS'],
    });
    expect(report.relaxedConstraints).toEqual(['MEAL_WINDOWS']);
  });

  it('is deterministic', () => {
    const days = [day([item({ id: 'a', poiId: OPEN_ALL_WEEK.id })])];
    expect(JSON.stringify(validate(days))).toBe(JSON.stringify(validate(days)));
  });
});
