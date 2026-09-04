import {
  isOpenDuring,
  toMinutes,
  VIOLATION_SEVERITY,
  type BudgetSummary,
  type ItineraryDay,
  type ItineraryItem,
  type Poi,
  type TripBrief,
  type ValidationReport,
  type Violation,
  type ViolationCode,
} from '@/lib/schemas';
import { BUDGET, PACE_PROFILES } from '../config';
import type { TravelLookup } from '../matrix';
import { weekdayOf } from '../schedule/frames';
import type { Selections } from '../types';

/**
 * The validation gate.
 *
 * Runs over a finished plan and reports what is wrong with it. A plan with any
 * HARD violation is not presentable, full stop — the orchestrator refuses to
 * return it as a success.
 *
 * This is deliberately an INDEPENDENT check, not a re-run of the scheduler's
 * own reasoning. The scheduler believes it respected opening hours; the
 * validator proves it, from the persisted times. If the two ever disagree, the
 * validator wins and the plan is rejected. A checker that shares its subject's
 * assumptions checks nothing.
 */

function violation(
  code: ViolationCode,
  message: string,
  extra: Partial<Omit<Violation, 'code' | 'severity' | 'message'>> = {},
): Violation {
  return {
    code,
    severity: VIOLATION_SEVERITY[code],
    message,
    itemIds: extra.itemIds ?? [],
    detail: extra.detail ?? {},
    ...(extra.dayIndex !== undefined ? { dayIndex: extra.dayIndex } : {}),
    ...(extra.subject !== undefined ? { subject: extra.subject } : {}),
  };
}

export interface ValidateInput {
  brief: TripBrief;
  selections: Selections;
  days: readonly ItineraryDay[];
  budget: BudgetSummary;
  lookup: TravelLookup;
  /** POIs referenced by the itinerary, for opening-hours checks. */
  poiById: Map<string, Poi>;
  /** Predicate for the URL whitelist. Injected so the engine stays free of
   *  provider imports — the composition root supplies the real one. */
  isWhitelistedUrl: (url: string) => boolean;
  relaxedConstraints?: string[];
}

export function runValidateStage(input: ValidateInput): ValidationReport {
  const { brief, selections, days, budget, lookup, poiById, isWhitelistedUrl } = input;
  const violations: Violation[] = [];

  const wake = toMinutes(brief.wakeTime);
  const sleep = toMinutes(brief.sleepTime);
  const pace = PACE_PROFILES[brief.pace];

  // --- budget ---------------------------------------------------------------
  if (budget.totalEstimatedMinor > budget.totalBudgetMinor) {
    violations.push(
      violation(
        'BUDGET_EXCEEDED',
        `Estimated cost exceeds the budget by ${
          budget.totalEstimatedMinor - budget.totalBudgetMinor
        } paise.`,
        {
          detail: {
            estimatedMinor: budget.totalEstimatedMinor,
            budgetMinor: budget.totalBudgetMinor,
          },
        },
      ),
    );
  } else if (
    budget.totalBudgetMinor > 0 &&
    budget.totalEstimatedMinor / budget.totalBudgetMinor < BUDGET.underUtilisedRatio
  ) {
    violations.push(
      violation('BUDGET_UNDERUSED', 'A large share of the budget is unallocated.', {
        detail: {
          unusedMinor: budget.totalBudgetMinor - budget.totalEstimatedMinor,
        },
      }),
    );
  }

  // --- ledger integrity -----------------------------------------------------
  const lineSum = budget.lines.reduce((s, l) => s + l.estimatedMinor, 0);
  if (lineSum !== budget.totalEstimatedMinor) {
    violations.push(
      violation(
        'BUDGET_EXCEEDED',
        `Budget total (${budget.totalEstimatedMinor}) does not equal the sum of its ` +
          `category lines (${lineSum}). This is an arithmetic bug, not a costing decision.`,
        { detail: { lineSum, reportedTotal: budget.totalEstimatedMinor } },
      ),
    );
  }

  // --- per-day checks -------------------------------------------------------
  for (const day of days) {
    const weekday = weekdayOf(day.date);
    const items = [...day.items].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

    let previous: ItineraryItem | null = null;

    for (const item of items) {
      const start = toMinutes(item.startTime);
      const end = toMinutes(item.endTime);

      // Internal consistency.
      if (end <= start) {
        violations.push(
          violation('DAY_OVERFLOW', `"${item.title}" ends at or before it starts.`, {
            dayIndex: day.dayIndex,
            itemIds: [item.id],
          }),
        );
      }

      // Waking window. Intercity transport is exempt: a 05:00 departure or a
      // late-night arrival is how travel works, not a scheduling mistake.
      if (item.category !== 'TRANSPORT' && (start < wake || end > sleep)) {
        violations.push(
          violation(
            'OUTSIDE_WAKING_HOURS',
            `"${item.title}" (${item.startTime}–${item.endTime}) falls outside the ` +
              `${brief.wakeTime}–${brief.sleepTime} waking window.`,
            { dayIndex: day.dayIndex, itemIds: [item.id] },
          ),
        );
      }

      // Coordinates, needed for any travel reasoning.
      if (!item.geo && item.category !== 'FREE_TIME' && item.category !== 'REST') {
        violations.push(
          violation('MISSING_COORDINATES', `"${item.title}" has no coordinates.`, {
            dayIndex: day.dayIndex,
            itemIds: [item.id],
          }),
        );
      }

      // Opening hours, checked independently from the POI record.
      if (item.poiId) {
        const poi = poiById.get(item.poiId);
        if (poi) {
          if (poi.openingHours.kind === 'unknown') {
            violations.push(
              violation('UNKNOWN_OPENING_HOURS', `Opening hours for "${poi.name}" are unknown.`, {
                dayIndex: day.dayIndex,
                itemIds: [item.id],
              }),
            );
          } else if (!isOpenDuring(poi.openingHours, weekday, item.startTime, item.endTime)) {
            violations.push(
              violation(
                'CLOSED_AT_TIME',
                `"${poi.name}" is not open for the whole of ${item.startTime}–${item.endTime} on ${day.date}.`,
                { dayIndex: day.dayIndex, itemIds: [item.id], subject: poi.id },
              ),
            );
          }
        }
      }

      if (previous) {
        const previousEnd = toMinutes(previous.endTime);

        // Overlap.
        if (start < previousEnd) {
          violations.push(
            violation(
              'OVERLAP',
              `"${item.title}" starts at ${item.startTime}, before "${previous.title}" ends at ${previous.endTime}.`,
              { dayIndex: day.dayIndex, itemIds: [previous.id, item.id] },
            ),
          );
        }

        // Travel feasibility — the headline check.
        //
        // Intercity legs are exempt, and deliberately so: a TRANSPORT item's
        // coordinates are its DEPARTURE point in another city, which is
        // outside the destination travel matrix by construction. Asking how
        // long it takes to drive from Mumbai to a Goa hotel is the wrong
        // question — the journey is the item, and the transfer from the
        // arrival point is already reserved by `arrivalTransferMins` in the
        // day frame. Checking it here would report a phantom violation on
        // every trip whose outbound service arrives the same day.
        const spansCities = previous.category === 'TRANSPORT' || item.category === 'TRANSPORT';

        if (previous.geo && item.geo && !spansCities) {
          const requiredMins = lookup.minutes(previous.geo, item.geo);
          if (requiredMins === null) {
            violations.push(
              violation(
                'UNREACHABLE_LEG',
                `No travel time is known between "${previous.title}" and "${item.title}".`,
                { dayIndex: day.dayIndex, itemIds: [previous.id, item.id] },
              ),
            );
          } else {
            const availableMins = start - previousEnd;
            if (availableMins < requiredMins) {
              violations.push(
                violation(
                  'TRAVEL_TIME_IMPOSSIBLE',
                  `Only ${availableMins} min between "${previous.title}" and "${item.title}", ` +
                    `but the journey takes ${requiredMins} min.`,
                  {
                    dayIndex: day.dayIndex,
                    itemIds: [previous.id, item.id],
                    detail: { availableMins, requiredMins },
                  },
                ),
              );
            }
          }
        }
      }

      // Links must come from the whitelist.
      if (item.link && !isWhitelistedUrl(item.link.url)) {
        violations.push(
          violation(
            'NON_WHITELISTED_URL',
            `"${item.title}" carries a link to a host that is not on the whitelist: ${item.link.url}`,
            { dayIndex: day.dayIndex, itemIds: [item.id] },
          ),
        );
      }

      previous = item;
    }

    // Check-in conflict: nothing at the hotel before check-in is allowed.
    const checkIn = items.find((i) => i.category === 'CHECK_IN');
    if (checkIn) {
      const checkInStart = toMinutes(checkIn.startTime);
      const lodgingCheckIn = toMinutes(selections.lodging.checkInTime);
      if (checkInStart < lodgingCheckIn) {
        violations.push(
          violation(
            'CHECKIN_CONFLICT',
            `Check-in scheduled at ${checkIn.startTime}, before the property accepts guests at ${selections.lodging.checkInTime}.`,
            { dayIndex: day.dayIndex, itemIds: [checkIn.id] },
          ),
        );
      }
    }

    // Soft: pace and travel tolerance.
    const activityCount = items.filter(
      (i) => i.category === 'SIGHT' || i.category === 'ACTIVITY' || i.category === 'SHOPPING',
    ).length;
    if (activityCount > pace.maxActivitiesPerDay) {
      violations.push(
        violation(
          'DAY_OVERPACKED',
          `Day ${day.dayIndex + 1} holds ${activityCount} activities; a ${brief.pace.toLowerCase()} pace allows ${pace.maxActivitiesPerDay}.`,
          { dayIndex: day.dayIndex },
        ),
      );
    }

    const travelMins = items.reduce((s, i) => s + (i.travelFromPrev?.durationMins ?? 0), 0);
    if (travelMins > brief.maxDailyTravelMins) {
      violations.push(
        violation(
          'EXCESSIVE_DAILY_TRAVEL',
          `Day ${day.dayIndex + 1} involves ${travelMins} min of travel against a ${brief.maxDailyTravelMins} min tolerance.`,
          { dayIndex: day.dayIndex, detail: { travelMins } },
        ),
      );
    }

    // Soft: a day with activities but no meal.
    if (activityCount > 0 && !items.some((i) => i.category === 'MEAL' || i.category === 'CAFE')) {
      violations.push(
        violation('MISSING_MEAL', `Day ${day.dayIndex + 1} has no meal scheduled.`, {
          dayIndex: day.dayIndex,
        }),
      );
    }
  }

  // --- soft: stated interests with no representation ------------------------
  const scheduledPoiIds = new Set(
    days.flatMap((d) => d.items.map((i) => i.poiId).filter((id): id is string => !!id)),
  );
  const scheduledTags = new Set(
    [...scheduledPoiIds]
      .map((id) => poiById.get(id))
      .filter((p): p is Poi => !!p)
      .flatMap((p) => p.tags.map((t) => t.toLowerCase())),
  );
  for (const interest of brief.interests) {
    const served = [...scheduledTags].some((tag) => tag.includes(interest.toLowerCase()));
    const categoryServed = [...scheduledPoiIds].some((id) => {
      const poi = poiById.get(id);
      return poi ? poi.tags.some((t) => t.toLowerCase().includes(interest.toLowerCase())) : false;
    });
    if (!served && !categoryServed) {
      violations.push(
        violation('INTEREST_UNSERVED', `Nothing in the plan serves the "${interest}" interest.`, {
          subject: interest,
        }),
      );
    }
  }

  const hardCount = violations.filter((v) => v.severity === 'HARD').length;
  const softCount = violations.filter((v) => v.severity === 'SOFT').length;

  return {
    violations,
    hardCount,
    softCount,
    relaxedConstraints: input.relaxedConstraints ?? [],
  };
}
