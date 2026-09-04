import { describe, expect, it } from 'vitest';
import { PACE_PROFILES, RELAXATION_ORDER, SCHEDULING } from '@/engine/config';
import { buildDayFrames, localDateOf, localMinutesOf, weekdayOf } from '@/engine/schedule/frames';
import type { Selections } from '@/engine/types';
import { rupees } from '@/lib/money';
import { TripBriefSchema, type LodgingOption, type TransportOption } from '@/lib/schemas';

/**
 * Day frames and scheduling policy.
 *
 * Frames are the step that stops the engine booking a temple visit for a
 * morning the party is still on a bus from Delhi, so they get their own tests
 * rather than being covered only through the end-to-end suites.
 */

const PROV = {
  sourceKind: 'mock' as const,
  provider: 'test',
  fetchedAt: '2026-01-01T00:00:00+05:30',
  confidence: 'medium' as const,
};

function leg(departAt: string, arriveAt: string): TransportOption {
  return {
    id: 'leg',
    direction: 'OUTBOUND',
    mode: 'BUS',
    operator: 'Test Coach',
    fromName: 'Delhi',
    toName: 'Manali',
    departAt,
    arriveAt,
    durationMins: (Date.parse(arriveAt) - Date.parse(departAt)) / 60_000,
    pricePerPersonMinor: rupees(1000),
    comfortTier: 'STANDARD',
    isOvernight: true,
    link: null,
    provenance: PROV,
  };
}

const lodging: LodgingOption = {
  id: 'lodge',
  name: 'Test Lodge',
  geo: { lat: 32.2432, lng: 77.1892 },
  nightlyRateMinor: rupees(2000),
  totalRateMinor: rupees(10_000),
  roomsRequired: 1,
  tier: 'MID',
  amenities: [],
  checkInTime: '14:00',
  checkOutTime: '11:00',
  link: null,
  provenance: PROV,
};

function selectionsWith(outbound: TransportOption, inbound: TransportOption): Selections {
  return {
    outbound,
    inbound,
    local: [],
    lodging,
    shortlist: [],
    scored: [],
    alternatives: { transport: [], lodging: [] },
  };
}

const brief = TripBriefSchema.parse({
  origin: { name: 'Delhi' },
  destination: { name: 'Manali' },
  startDate: '2026-10-12',
  endDate: '2026-10-17',
  travellerCount: 2,
  budgetTotalMinor: rupees(40_000),
  wakeTime: '08:00',
  sleepTime: '22:30',
});

describe('local time helpers', () => {
  it('reads the local date and minutes from an offset instant', () => {
    expect(localDateOf('2026-10-13T08:30:00+05:30')).toBe('2026-10-13');
    expect(localMinutesOf('2026-10-13T08:30:00+05:30')).toBe(510);
  });

  it('computes the weekday of a date', () => {
    // 2026-10-13 is a Tuesday.
    expect(weekdayOf('2026-10-13')).toBe(2);
    expect(weekdayOf('2026-10-18')).toBe(0);
  });
});

describe('day frames', () => {
  const overnight = selectionsWith(leg('2026-10-12T20:00:00+05:30', '2026-10-13T08:30:00+05:30'), {
    ...leg('2026-10-17T18:00:00+05:30', '2026-10-18T06:00:00+05:30'),
    direction: 'RETURN',
  });

  it('marks the departure day as not an activity day', () => {
    // The party is still in Delhi. Scheduling a Manali temple here would be
    // the classic impossible itinerary.
    const frames = buildDayFrames(brief, overnight);
    expect(frames[0]!.isActivityDay).toBe(false);
    expect(frames[0]!.windowStartMins).toBeNull();
  });

  it('opens the arrival day after arrival plus a transfer buffer', () => {
    const frames = buildDayFrames(brief, overnight);
    const arrival = frames.find((f) => f.isArrivalDay)!;
    expect(arrival.date).toBe('2026-10-13');
    // 08:30 arrival + 45 min transfer = 09:15.
    expect(arrival.windowStartMins).toBe(8 * 60 + 30 + SCHEDULING.arrivalTransferMins);
    expect(arrival.isActivityDay).toBe(true);
  });

  it('closes the departure day before the return service leaves', () => {
    const frames = buildDayFrames(brief, overnight);
    const departure = frames.find((f) => f.isDepartureDay)!;
    expect(departure.date).toBe('2026-10-17');
    // 18:00 departure - 60 min boarding buffer = 17:00.
    expect(departure.windowEndMins).toBe(18 * 60 - SCHEDULING.departureBufferMins);
  });

  it('produces one frame per calendar day', () => {
    const frames = buildDayFrames(brief, overnight);
    expect(frames).toHaveLength(6);
    expect(frames.map((f) => f.dayIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('respects the waking window on ordinary days', () => {
    const frames = buildDayFrames(brief, overnight);
    const middle = frames[3]!;
    expect(middle.windowStartMins).toBe(8 * 60);
    expect(middle.windowEndMins).toBe(22 * 60 + 30);
  });

  it('rejects a day too short to be useful', () => {
    // A late arrival leaves under the minimum usable window.
    const lateArrival = selectionsWith(
      leg('2026-10-12T20:00:00+05:30', '2026-10-13T21:00:00+05:30'),
      { ...leg('2026-10-17T18:00:00+05:30', '2026-10-18T06:00:00+05:30'), direction: 'RETURN' },
    );
    const frames = buildDayFrames(brief, lateArrival);
    const arrival = frames.find((f) => f.date === '2026-10-13')!;
    expect(arrival.isActivityDay).toBe(false);
  });

  it('treats every day as available when transport carries no times', () => {
    // The LOCAL-only case: a trip within one city, not an error.
    const untimed: TransportOption = {
      ...leg('2026-10-12T20:00:00+05:30', '2026-10-13T08:30:00+05:30'),
    };
    delete (untimed as { departAt?: string }).departAt;
    delete (untimed as { arriveAt?: string }).arriveAt;

    const frames = buildDayFrames(brief, selectionsWith(untimed, untimed));
    expect(frames.every((f) => f.isActivityDay)).toBe(true);
  });

  it('honours a late wake time', () => {
    const lateRiser = TripBriefSchema.parse({
      origin: { name: 'Delhi' },
      destination: { name: 'Manali' },
      startDate: '2026-10-12',
      endDate: '2026-10-17',
      travellerCount: 2,
      budgetTotalMinor: rupees(40_000),
      wakeTime: '10:00',
      sleepTime: '22:30',
    });
    const frames = buildDayFrames(lateRiser, overnight);
    for (const frame of frames) {
      if (frame.windowStartMins === null) continue;
      expect(frame.windowStartMins).toBeGreaterThanOrEqual(10 * 60);
    }
  });

  it('is deterministic', () => {
    expect(JSON.stringify(buildDayFrames(brief, overnight))).toBe(
      JSON.stringify(buildDayFrames(brief, overnight)),
    );
  });
});

describe('scheduling policy', () => {
  it('orders pace profiles from relaxed to packed', () => {
    expect(PACE_PROFILES.RELAXED.maxActivitiesPerDay).toBeLessThan(
      PACE_PROFILES.BALANCED.maxActivitiesPerDay,
    );
    expect(PACE_PROFILES.BALANCED.maxActivitiesPerDay).toBeLessThan(
      PACE_PROFILES.PACKED.maxActivitiesPerDay,
    );
    // A relaxed pace leaves more slack between items, not less.
    expect(PACE_PROFILES.RELAXED.bufferMins).toBeGreaterThan(PACE_PROFILES.PACKED.bufferMins);
  });

  it('contains only soft constraints in the relaxation order', () => {
    // Hard constraints must never appear here. If one did, the engine could
    // relax its way into an impossible plan.
    const forbidden = ['OPENING_HOURS', 'TRAVEL_TIME', 'WAKING_WINDOW', 'CHECK_IN', 'BUDGET'];
    for (const constraint of RELAXATION_ORDER) {
      expect(forbidden).not.toContain(constraint);
    }
  });

  it('gives up interest coverage before dropping places entirely', () => {
    // Ordering encodes what a traveller notices least.
    expect(RELAXATION_ORDER.indexOf('INTEREST_COVERAGE')).toBeLessThan(
      RELAXATION_ORDER.indexOf('DROP_LOW_SCORING_POIS'),
    );
  });

  it('has no duplicate relaxations', () => {
    expect(new Set(RELAXATION_ORDER).size).toBe(RELAXATION_ORDER.length);
  });
});
