import {
  fromMinutes,
  isOpenDuring,
  type GeoPoint,
  type ItineraryDay,
  type ItineraryItem,
  type Poi,
  type TripBrief,
} from '@/lib/schemas';
import {
  MEAL_WINDOWS,
  PACE_PROFILES,
  RELAXATION_ORDER,
  SCHEDULING,
  type RelaxableConstraint,
} from '../config';
import type { TravelLookup } from '../matrix';
import { optimiseDayRoute } from '../route';
import type { DayCluster, DayFrame, ScheduleOutcome, Selections } from '../types';
import { weekdayOf } from './frames';

/**
 * The interval scheduler.
 *
 * Places each day's POIs on a clock, respecting hard constraints absolutely
 * and soft constraints until they have to give. It is a greedy forward pass:
 * start at the hotel at the window's opening, travel to the next stop, wait if
 * it is not open yet, visit, repeat — inserting meals when the clock enters a
 * meal window.
 *
 * HARD constraints, never relaxed:
 *   - opening hours (a closed attraction is skipped, never scheduled)
 *   - travel time between consecutive stops
 *   - the day's usable window (wake/sleep, arrival, departure)
 *   - hotel check-in and check-out times
 *   - maximum continuous travel
 *
 * SOFT constraints, surrendered in the order given by RELAXATION_ORDER:
 *   - interest coverage, pace limits, daily travel tolerance, meal windows
 *
 * The greedy pass is run repeatedly, relaxing one more soft constraint each
 * time, until every activity day holds something or the relaxation list is
 * exhausted. Whatever was surrendered is returned in `relaxedConstraints`, and
 * anything that could not be placed is returned in `unplaced` with a reason.
 * Nothing is dropped silently.
 */

interface Relaxations {
  active: Set<RelaxableConstraint>;
  has(c: RelaxableConstraint): boolean;
}

function relaxations(active: RelaxableConstraint[]): Relaxations {
  const set = new Set(active);
  return { active: set, has: (c) => set.has(c) };
}

interface DayContext {
  brief: TripBrief;
  selections: Selections;
  lookup: TravelLookup;
  relaxed: Relaxations;
  poiById: Map<string, Poi>;
  eateries: Poi[];
}

let itemCounter = 0;
/** Deterministic ids: reset per schedule run so output is reproducible. */
function nextItemId(dayIndex: number): string {
  itemCounter += 1;
  return `item-d${dayIndex}-${String(itemCounter).padStart(3, '0')}`;
}

function makeItem(args: {
  dayIndex: number;
  seq: number;
  title: string;
  category: ItineraryItem['category'];
  startMins: number;
  durationMins: number;
  geo?: GeoPoint;
  poiId?: string;
  costMinor?: number;
  travelFromPrev?: ItineraryItem['travelFromPrev'];
  link?: ItineraryItem['link'];
  notes?: string;
}): ItineraryItem {
  const item: ItineraryItem = {
    id: nextItemId(args.dayIndex),
    seq: args.seq,
    title: args.title,
    category: args.category,
    startTime: fromMinutes(args.startMins),
    endTime: fromMinutes(args.startMins + args.durationMins),
    durationMins: args.durationMins,
    estimatedCostMinor: args.costMinor ?? 0,
    travelFromPrev: args.travelFromPrev ?? null,
    link: args.link ?? null,
    bookingStatus: 'NOT_REQUIRED',
    isLocked: false,
  };
  if (args.geo) item.geo = args.geo;
  if (args.poiId) item.poiId = args.poiId;
  if (args.notes) item.notes = args.notes;
  return item;
}

/** Which meal window, if any, contains this instant. */
function mealWindowAt(mins: number): (typeof MEAL_WINDOWS)[number] | undefined {
  return MEAL_WINDOWS.find((w) => mins >= w.startMins && mins < w.endMins);
}

/**
 * Schedule one day.
 *
 * Returns the items placed and the POIs that could not be, each with a reason.
 */
function scheduleDay(
  ctx: DayContext,
  frame: DayFrame,
  cluster: DayCluster | undefined,
): { items: ItineraryItem[]; unplaced: Array<{ poiId: string; reason: string }> } {
  const items: ItineraryItem[] = [];
  const unplaced: Array<{ poiId: string; reason: string }> = [];

  if (frame.windowStartMins === null || frame.windowEndMins === null) {
    return { items, unplaced };
  }

  const { brief, selections, lookup, relaxed } = ctx;
  const pace = PACE_PROFILES[brief.pace];
  const weekday = weekdayOf(frame.date);
  const travellers = brief.travellerCount;

  let clock = frame.windowStartMins;
  let seq = 0;
  let position: GeoPoint = selections.lodging.geo;
  let activityCount = 0;
  let travelMins = 0;
  const mealsTaken = new Set<string>();

  // --- hotel check-in on the arrival day ------------------------------------
  if (frame.isArrivalDay) {
    const checkInMins = Math.max(clock, timeToMins(selections.lodging.checkInTime));
    if (checkInMins + SCHEDULING.checkInDurationMins <= frame.windowEndMins) {
      items.push(
        makeItem({
          dayIndex: frame.dayIndex,
          seq: seq++,
          title: `Check in at ${selections.lodging.name}`,
          category: 'CHECK_IN',
          startMins: checkInMins,
          durationMins: SCHEDULING.checkInDurationMins,
          geo: selections.lodging.geo,
          link: selections.lodging.link,
        }),
      );
      clock = checkInMins + SCHEDULING.checkInDurationMins;
    }
  }

  // --- the day's sights, in optimised order ---------------------------------
  const dayPois = (cluster?.poiIds ?? [])
    .map((id) => ctx.poiById.get(id))
    .filter((p): p is Poi => p !== undefined);

  const route = optimiseDayRoute(position, dayPois, lookup);

  for (const poi of route.ordered) {
    // Soft: pace activity cap.
    if (!relaxed.has('PACE_ACTIVITY_LIMIT') && activityCount >= pace.maxActivitiesPerDay) {
      unplaced.push({ poiId: poi.id, reason: 'day is full for the requested pace' });
      continue;
    }

    const legMins = lookup.minutes(position, poi.geo);
    if (legMins === null) {
      unplaced.push({ poiId: poi.id, reason: 'no travel time available for this leg' });
      continue;
    }

    // Hard: no single hop longer than the continuous-travel limit.
    if (legMins > SCHEDULING.maxContinuousTravelMins) {
      unplaced.push({
        poiId: poi.id,
        reason: `journey of ${legMins} min exceeds the ${SCHEDULING.maxContinuousTravelMins} min continuous travel limit`,
      });
      continue;
    }

    // Soft: daily travel tolerance.
    if (
      !relaxed.has('DAILY_TRAVEL_LIMIT') &&
      travelMins + legMins > brief.maxDailyTravelMins
    ) {
      unplaced.push({ poiId: poi.id, reason: 'would exceed the daily travel tolerance' });
      continue;
    }

    let arrive = clock + legMins;

    // A meal window reached en route is taken before the next sight.
    const meal = mealWindowAt(arrive);
    if (meal && !mealsTaken.has(meal.name)) {
      const placed = placeMeal(ctx, frame, {
        seq,
        startMins: Math.max(arrive, meal.startMins),
        position,
        weekday,
        travellers,
      });
      if (placed) {
        items.push(placed.item);
        mealsTaken.add(meal.name);
        seq += 1;
        clock = timeToMins(placed.item.endTime);
        position = placed.item.geo ?? position;
        const relegMins = lookup.minutes(position, poi.geo);
        if (relegMins === null) {
          unplaced.push({ poiId: poi.id, reason: 'no travel time available after the meal stop' });
          continue;
        }
        arrive = clock + relegMins;
      }
    }

    // Hard: opening hours. Wait a little, but never schedule into a closed door.
    const openFrom = earliestOpening(poi, weekday, arrive);
    if (openFrom === null) {
      unplaced.push({ poiId: poi.id, reason: `closed on ${frame.date}` });
      continue;
    }
    if (openFrom - arrive > SCHEDULING.maxWaitForOpeningMins) {
      unplaced.push({
        poiId: poi.id,
        reason: `opens ${openFrom - arrive} min after arrival, beyond the acceptable wait`,
      });
      continue;
    }
    const start = Math.max(arrive, openFrom);
    const end = start + poi.typicalDurationMins;

    // Hard: the day's window.
    if (end > frame.windowEndMins) {
      unplaced.push({ poiId: poi.id, reason: 'does not fit before the end of the day' });
      continue;
    }

    // Hard: must still be open when we leave.
    if (!isOpenDuring(poi.openingHours, weekday, fromMinutes(start), fromMinutes(end))) {
      unplaced.push({ poiId: poi.id, reason: 'would still be inside on closing time' });
      continue;
    }

    // Soft: total scheduled minutes for the pace.
    const scheduledSoFar = items.reduce((s, i) => s + i.durationMins, 0);
    if (
      !relaxed.has('PACE_SCHEDULED_MINS') &&
      scheduledSoFar + poi.typicalDurationMins > pace.maxScheduledMins
    ) {
      unplaced.push({ poiId: poi.id, reason: 'exceeds the scheduled hours for this pace' });
      continue;
    }

    items.push(
      makeItem({
        dayIndex: frame.dayIndex,
        seq: seq++,
        title: poi.name,
        category: categoryForPoi(poi),
        startMins: start,
        durationMins: poi.typicalDurationMins,
        geo: poi.geo,
        poiId: poi.id,
        costMinor: poi.typicalCostPerPersonMinor * travellers,
        travelFromPrev: {
          durationMins: legMins,
          distanceMetres: lookup.metres(position, poi.geo) ?? 0,
          mode: 'CAR',
        },
      }),
    );

    clock = end + pace.bufferMins;
    position = poi.geo;
    activityCount += 1;
    travelMins += legMins;
  }

  // --- any meal windows still unserved --------------------------------------
  for (const window of MEAL_WINDOWS) {
    if (mealsTaken.has(window.name)) continue;
    const startMins = Math.max(clock, window.startMins);
    // Outside its window only once MEAL_WINDOWS has been relaxed.
    if (startMins >= window.endMins && !relaxed.has('MEAL_WINDOWS')) continue;
    if (startMins < frame.windowStartMins) continue;
    if (startMins + window.durationMins > frame.windowEndMins) continue;

    const placed = placeMeal(ctx, frame, {
      seq,
      startMins,
      position,
      weekday,
      travellers,
    });
    if (placed) {
      items.push(placed.item);
      mealsTaken.add(window.name);
      seq += 1;
      clock = timeToMins(placed.item.endTime) + pace.bufferMins;
      position = placed.item.geo ?? position;
    }
  }

  // --- checkout on the departure day ----------------------------------------
  if (frame.isDepartureDay) {
    const checkOutMins = timeToMins(selections.lodging.checkOutTime);
    if (
      checkOutMins >= frame.windowStartMins &&
      checkOutMins + SCHEDULING.checkOutDurationMins <= frame.windowEndMins
    ) {
      items.push(
        makeItem({
          dayIndex: frame.dayIndex,
          seq: seq++,
          title: `Check out of ${selections.lodging.name}`,
          category: 'CHECK_OUT',
          startMins: checkOutMins,
          durationMins: SCHEDULING.checkOutDurationMins,
          geo: selections.lodging.geo,
        }),
      );
    }
  }

  items.sort((a, b) => timeToMins(a.startTime) - timeToMins(b.startTime));
  items.forEach((item, i) => {
    item.seq = i;
  });

  return { items, unplaced };
}

/** Nearest open eatery to `position`, scheduled as a meal. */
function placeMeal(
  ctx: DayContext,
  frame: DayFrame,
  args: {
    seq: number;
    startMins: number;
    position: GeoPoint;
    weekday: number;
    travellers: number;
  },
): { item: ItineraryItem } | null {
  if (frame.windowEndMins === null) return null;

  const candidates = ctx.eateries
    .map((poi) => ({ poi, mins: ctx.lookup.minutes(args.position, poi.geo) }))
    .filter((c): c is { poi: Poi; mins: number } => c.mins !== null)
    .sort((a, b) => a.mins - b.mins || a.poi.id.localeCompare(b.poi.id));

  for (const { poi, mins } of candidates) {
    const arrive = args.startMins + mins;
    const duration = poi.typicalDurationMins;
    const end = arrive + duration;
    if (end > frame.windowEndMins) continue;
    if (!isOpenDuring(poi.openingHours, args.weekday, fromMinutes(arrive), fromMinutes(end))) {
      continue;
    }
    return {
      item: makeItem({
        dayIndex: frame.dayIndex,
        seq: args.seq,
        title: poi.name,
        category: poi.category === 'CAFE' ? 'CAFE' : 'MEAL',
        startMins: arrive,
        durationMins: duration,
        geo: poi.geo,
        poiId: poi.id,
        costMinor: poi.typicalCostPerPersonMinor * args.travellers,
        travelFromPrev: {
          durationMins: mins,
          distanceMetres: ctx.lookup.metres(args.position, poi.geo) ?? 0,
          mode: 'CAR',
        },
      }),
    };
  }
  return null;
}

/**
 * Earliest minute at or after `from` at which the POI is open on `weekday`.
 * Null when it does not open that day at all.
 */
function earliestOpening(poi: Poi, weekday: number, from: number): number | null {
  const hours = poi.openingHours;
  if (hours.kind === 'always') return from;
  // Unknown hours are treated as unschedulable rather than assumed open. The
  // validator raises UNKNOWN_OPENING_HOURS as a soft warning separately.
  if (hours.kind === 'unknown') return null;
  if (hours.closedWeekdays.includes(weekday)) return null;

  const today = hours.intervals.filter((i) => i.weekday === weekday);
  if (today.length === 0) return null;

  let best: number | null = null;
  for (const interval of today) {
    const opens = timeToMins(interval.opens);
    const closes = timeToMins(interval.closes);
    if (closes <= from) continue;
    const candidate = Math.max(from, opens);
    if (candidate + poi.typicalDurationMins > closes) continue;
    if (best === null || candidate < best) best = candidate;
  }
  return best;
}

function categoryForPoi(poi: Poi): ItineraryItem['category'] {
  switch (poi.category) {
    case 'RESTAURANT':
      return 'MEAL';
    case 'CAFE':
      return 'CAFE';
    case 'SHOPPING':
    case 'MARKET':
      return 'SHOPPING';
    case 'ACTIVITY':
      return 'ACTIVITY';
    default:
      return 'SIGHT';
  }
}

function timeToMins(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

// ---------------------------------------------------------------------------
// Stage entry point
// ---------------------------------------------------------------------------

/** One pass over every day with a fixed set of relaxations. */
function schedulePass(
  brief: TripBrief,
  selections: Selections,
  clusters: readonly DayCluster[],
  frames: readonly DayFrame[],
  lookup: TravelLookup,
  active: RelaxableConstraint[],
): ScheduleOutcome {
  itemCounter = 0;

  const ctx: DayContext = {
    brief,
    selections,
    lookup,
    relaxed: relaxations(active),
    poiById: new Map(selections.shortlist.map((p) => [p.id, p])),
    eateries: selections.shortlist.filter(
      (p) => p.category === 'RESTAURANT' || p.category === 'CAFE',
    ),
  };

  const days: ItineraryDay[] = [];
  const unplaced: Array<{ poiId: string; reason: string }> = [];

  for (const frame of frames) {
    const cluster = clusters.find((c) => c.dayIndex === frame.dayIndex);
    const result = scheduleDay(ctx, frame, cluster);
    unplaced.push(...result.unplaced);

    const day: ItineraryDay = {
      id: `day-${frame.dayIndex}`,
      dayIndex: frame.dayIndex,
      date: frame.date,
      items: result.items,
      totalCostMinor: result.items.reduce((s, i) => s + i.estimatedCostMinor, 0),
      totalTravelMins: result.items.reduce(
        (s, i) => s + (i.travelFromPrev?.durationMins ?? 0),
        0,
      ),
    };
    if (cluster) day.clusterCentroid = cluster.centroid;
    days.push(day);
  }

  return { days, relaxedConstraints: active.map(String), unplaced };
}

/**
 * Run the scheduler, relaxing soft constraints only as far as necessary.
 *
 * Success is judged by whether every activity day holds at least one item.
 * A day the traveller is present for that contains nothing is a failure of
 * the plan, not a quiet gap in it.
 */
export function runScheduleStage(
  brief: TripBrief,
  selections: Selections,
  clusters: readonly DayCluster[],
  frames: readonly DayFrame[],
  lookup: TravelLookup,
): ScheduleOutcome {
  const activityDayIndexes = frames.filter((f) => f.isActivityDay).map((f) => f.dayIndex);

  let best: ScheduleOutcome | null = null;

  for (let depth = 0; depth <= RELAXATION_ORDER.length; depth += 1) {
    const active = RELAXATION_ORDER.slice(0, depth) as RelaxableConstraint[];
    const outcome = schedulePass(brief, selections, clusters, frames, lookup, [...active]);

    const emptyActivityDays = activityDayIndexes.filter((index) => {
      const day = outcome.days.find((d) => d.dayIndex === index);
      return !day || day.items.length === 0;
    });

    // Keep the least-relaxed outcome that fills every activity day.
    if (emptyActivityDays.length === 0) return outcome;
    if (best === null || outcome.unplaced.length < best.unplaced.length) best = outcome;
  }

  // Every relaxation exhausted. Return the best attempt; the validator decides
  // whether what remains is presentable, and the orchestrator turns an
  // unusable result into INFEASIBLE_CONSTRAINTS.
  return best ?? schedulePass(brief, selections, clusters, frames, lookup, []);
}
