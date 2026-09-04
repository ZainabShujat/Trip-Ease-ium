import { addDays, dayCountBetween, toMinutes, type TripBrief } from '@/lib/schemas';
import { SCHEDULING } from '../config';
import type { DayFrame, Selections } from '../types';

/**
 * Day frames: when the traveller is actually at the destination and free.
 *
 * This is the step that stops the engine scheduling a temple visit for a
 * morning the party is still on a bus from Delhi. Every later stage reads
 * these windows rather than assuming "day 1 to day N are all available".
 *
 * The rules:
 *
 *   - Days before the outbound service arrives are not activity days. The
 *     departure day holds the outbound transport item and nothing else.
 *   - On the arrival day the window opens at the later of the wake time and
 *     arrival plus a transfer buffer.
 *   - On the departure day the window closes at the earlier of the sleep time
 *     and the return departure minus a boarding buffer.
 *   - A window shorter than `minUsableDayMins` is not an activity day. Half
 *     an hour between checkout and a bus is not a day out.
 */

/** Local date portion of an ISO instant with a +HH:MM offset. */
export function localDateOf(iso: string): string {
  return iso.slice(0, 10);
}

/** Local minutes from midnight of an ISO instant with a +HH:MM offset. */
export function localMinutesOf(iso: string): number {
  const hh = Number(iso.slice(11, 13));
  const mm = Number(iso.slice(14, 16));
  return hh * 60 + mm;
}

export function buildDayFrames(brief: TripBrief, selections: Selections): DayFrame[] {
  const totalDays = dayCountBetween(brief.startDate, brief.endDate);
  const wake = toMinutes(brief.wakeTime);
  const sleep = toMinutes(brief.sleepTime);

  const arriveIso = selections.outbound.arriveAt;
  const returnIso = selections.inbound.departAt;

  // Without timed transport, treat every day as fully available. This is the
  // LOCAL-only case (a trip within one city), not an error.
  const arrivalDate = arriveIso ? localDateOf(arriveIso) : brief.startDate;
  const arrivalMins = arriveIso ? localMinutesOf(arriveIso) : wake;
  const departureDate = returnIso ? localDateOf(returnIso) : brief.endDate;
  const departureMins = returnIso ? localMinutesOf(returnIso) : sleep;

  const frames: DayFrame[] = [];

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
    const date = addDays(brief.startDate, dayIndex);
    const isArrivalDay = date === arrivalDate;
    const isDepartureDay = date === departureDate;

    // Not yet arrived, or already gone home.
    if (date < arrivalDate || date > departureDate) {
      frames.push({
        dayIndex,
        date,
        windowStartMins: null,
        windowEndMins: null,
        isArrivalDay,
        isDepartureDay,
        isActivityDay: false,
      });
      continue;
    }

    let start = wake;
    let end = sleep;

    if (isArrivalDay) {
      start = Math.max(wake, arrivalMins + SCHEDULING.arrivalTransferMins);
    }
    if (isDepartureDay) {
      end = Math.min(sleep, departureMins - SCHEDULING.departureBufferMins);
    }

    const usable = end - start;
    frames.push({
      dayIndex,
      date,
      windowStartMins: start,
      windowEndMins: end,
      isArrivalDay,
      isDepartureDay,
      isActivityDay: usable >= SCHEDULING.minUsableDayMins,
    });
  }

  return frames;
}

/** JavaScript weekday (0 = Sunday) for a YYYY-MM-DD date, in UTC. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}
