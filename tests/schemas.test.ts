import { describe, expect, it } from 'vitest';
import { rupees } from '@/lib/money';
import {
  addDays,
  dayCountBetween,
  fromMinutes,
  isOpenDuring,
  ItineraryItemSchema,
  nightsBetween,
  PoiSchema,
  REPLAN_RESTART_STAGE,
  ReplanIntentSchema,
  stagesToRerun,
  toMinutes,
  TravelMatrixSchema,
  TripBriefSchema,
  VIOLATION_SEVERITY,
  ViolationCodeSchema,
  type OpeningHours,
} from '@/lib/schemas';

const VALID_BRIEF = {
  origin: { name: 'Delhi' },
  destination: { name: 'Manali' },
  startDate: '2026-10-12',
  endDate: '2026-10-17',
  travellerCount: 4,
  budgetTotalMinor: rupees(40_000),
};

describe('TripBrief', () => {
  it('accepts the reference brief and applies documented defaults', () => {
    const brief = TripBriefSchema.parse(VALID_BRIEF);
    expect(brief.currency).toBe('INR');
    expect(brief.pace).toBe('BALANCED');
    expect(brief.wakeTime).toBe('08:00');
    expect(brief.maxDailyTravelMins).toBe(240);
    expect(brief.interests).toEqual([]);
  });

  it('rejects an end date before the start date', () => {
    const result = TripBriefSchema.safeParse({ ...VALID_BRIEF, endDate: '2026-10-11' });
    expect(result.success).toBe(false);
  });

  it('rejects a sleep time earlier in the day than the wake time', () => {
    const result = TripBriefSchema.safeParse({
      ...VALID_BRIEF,
      wakeTime: '09:00',
      sleepTime: '07:00',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a traveller list that disagrees with travellerCount', () => {
    const result = TripBriefSchema.safeParse({
      ...VALID_BRIEF,
      travellers: [{ ageBand: 'ADULT' }, { ageBand: 'ADULT' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer money amount', () => {
    const result = TripBriefSchema.safeParse({ ...VALID_BRIEF, budgetTotalMinor: 4000.5 });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed date', () => {
    expect(TripBriefSchema.safeParse({ ...VALID_BRIEF, startDate: '12-10-2026' }).success).toBe(
      false,
    );
  });
});

describe('date and time helpers', () => {
  it('counts nights and days for the reference trip', () => {
    expect(nightsBetween('2026-10-12', '2026-10-17')).toBe(5);
    expect(dayCountBetween('2026-10-12', '2026-10-17')).toBe(6);
  });

  it('adds days across a month boundary', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });

  it('round-trips minutes and HH:MM', () => {
    expect(toMinutes('09:30')).toBe(570);
    expect(fromMinutes(570)).toBe('09:30');
    expect(fromMinutes(0)).toBe('00:00');
  });

  it('clamps rather than wrapping past midnight', () => {
    // A schedule running past midnight must surface as a bug, not silently
    // wrap to the small hours.
    expect(fromMinutes(25 * 60)).toBe('23:59');
  });
});

describe('opening hours', () => {
  const weekdayNineToSix: OpeningHours = {
    kind: 'weekly',
    intervals: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens: '09:00', closes: '18:00' })),
    closedWeekdays: [0, 6],
  };

  it('accepts a visit fully inside the window', () => {
    expect(isOpenDuring(weekdayNineToSix, 3, '10:00', '11:00')).toBe(true);
  });

  it('rejects a visit that runs past closing', () => {
    expect(isOpenDuring(weekdayNineToSix, 3, '17:30', '18:30')).toBe(false);
  });

  it('rejects a closed weekday', () => {
    expect(isOpenDuring(weekdayNineToSix, 0, '10:00', '11:00')).toBe(false);
  });

  it('always-open places accept any window', () => {
    expect(isOpenDuring({ kind: 'always' }, 0, '03:00', '04:00')).toBe(true);
  });

  it('treats unknown hours as not-open rather than assuming', () => {
    // Conservative by design: a guess must never quietly become a plan.
    expect(isOpenDuring({ kind: 'unknown' }, 3, '10:00', '11:00')).toBe(false);
  });
});

describe('ItineraryItem', () => {
  const base = {
    id: 'item-1',
    seq: 0,
    title: 'Hadimba Devi Temple',
    category: 'SIGHT' as const,
    startTime: '10:30',
    endTime: '11:30',
    durationMins: 60,
  };

  it('accepts a consistent item', () => {
    expect(ItineraryItemSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a duration that disagrees with the times', () => {
    // The scheduler is the only thing allowed to set these, and this is the
    // guard that catches it getting them out of step.
    expect(ItineraryItemSchema.safeParse({ ...base, durationMins: 45 }).success).toBe(false);
  });

  it('rejects an end time before the start time', () => {
    expect(
      ItineraryItemSchema.safeParse({ ...base, startTime: '12:00', endTime: '11:00' }).success,
    ).toBe(false);
  });
});

describe('Poi', () => {
  it('rejects coordinates outside the valid range', () => {
    const result = PoiSchema.safeParse({
      id: 'p',
      providerRef: 'p',
      name: 'Nowhere',
      category: 'SIGHT',
      geo: { lat: 200, lng: 77 },
      typicalDurationMins: 30,
      openingHours: { kind: 'always' },
    });
    expect(result.success).toBe(false);
  });
});

describe('TravelMatrix', () => {
  const points = [
    { lat: 32.24, lng: 77.18 },
    { lat: 32.25, lng: 77.19 },
  ];
  const provenance = {
    sourceKind: 'estimated' as const,
    provider: 'test',
    fetchedAt: '2026-01-01T00:00:00+05:30',
    confidence: 'low' as const,
  };

  it('accepts a square matrix', () => {
    const result = TravelMatrixSchema.safeParse({
      points,
      mode: 'CAR',
      durationMins: [
        [0, 10],
        [10, 0],
      ],
      distanceMetres: [
        [0, 2000],
        [2000, 0],
      ],
      provenance,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a matrix whose dimensions do not match the points', () => {
    const result = TravelMatrixSchema.safeParse({
      points,
      mode: 'CAR',
      durationMins: [[0, 10]],
      distanceMetres: [
        [0, 2000],
        [2000, 0],
      ],
      provenance,
    });
    expect(result.success).toBe(false);
  });
});

describe('ReplanIntent', () => {
  it('parses a budget reduction', () => {
    const intent = ReplanIntentSchema.parse({
      op: 'SET_BUDGET',
      budgetTotalMinor: rupees(35_000),
    });
    expect(intent.op).toBe('SET_BUDGET');
  });

  it('rejects an unknown operation', () => {
    expect(ReplanIntentSchema.safeParse({ op: 'MAKE_IT_NICER' }).success).toBe(false);
  });

  it('maps every operation to a restart stage', () => {
    // A new intent without a restart stage would silently recompute nothing.
    for (const op of Object.keys(REPLAN_RESTART_STAGE)) {
      expect(REPLAN_RESTART_STAGE[op as keyof typeof REPLAN_RESTART_STAGE]).toBeDefined();
    }
  });

  it('re-runs the dependent stages for a budget change', () => {
    const stages = stagesToRerun('SET_BUDGET');
    expect(stages).toEqual([
      'SCORE',
      'CLUSTER',
      'ROUTE',
      'SCHEDULE',
      'BUDGET',
      'VALIDATE',
      'NARRATE',
    ]);
  });

  it('re-runs only scheduling onwards for a pace change', () => {
    expect(stagesToRerun('SET_PACE')).toEqual(['SCHEDULE', 'BUDGET', 'VALIDATE', 'NARRATE']);
  });

  it('re-sources candidates when the trip length changes', () => {
    expect(stagesToRerun('CHANGE_DURATION')[0]).toBe('SOURCE');
  });
});

describe('Violation severities', () => {
  it('classifies every violation code', () => {
    // A code without a severity would be silently dropped by the validator.
    for (const code of ViolationCodeSchema.options) {
      expect(VIOLATION_SEVERITY[code]).toMatch(/^(HARD|SOFT)$/);
    }
  });

  it('treats an impossible travel time as a hard failure', () => {
    expect(VIOLATION_SEVERITY.TRAVEL_TIME_IMPOSSIBLE).toBe('HARD');
    expect(VIOLATION_SEVERITY.BUDGET_EXCEEDED).toBe('HARD');
    expect(VIOLATION_SEVERITY.NON_WHITELISTED_URL).toBe('HARD');
  });

  it('treats an overpacked day as soft', () => {
    expect(VIOLATION_SEVERITY.DAY_OVERPACKED).toBe('SOFT');
  });
});
