import { DateTime, IANAZone } from "luxon";
import { DstTransitionError, ValidationError } from "../errors/domain-error";

export interface ResolvedSlot {
  utcStart: Date;
  utcEnd: Date;
  parentLocalStart: string; // ISO or formatted
  parentLocalEnd: string;
  isDst: boolean;
  offsetMinutes: number;
}

/**
 * Validates whether the provided timezone is a valid canonical IANA identifier.
 */
export function isValidIanaTimezone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== "string" || timeZone.trim() === "") return false;
  // Disallow non-canonical legacy abbreviations like EST, CST, PST, IST
  if (!timeZone.includes("/") && timeZone !== "UTC" && timeZone !== "Etc/UTC") {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}



/**
 * Asserts that a timezone string is a valid IANA identifier.
 */
export function assertValidIanaTimezone(timeZone: string): void {
  if (!isValidIanaTimezone(timeZone)) {
    throw new ValidationError(`Invalid IANA timezone identifier: "${timeZone}". Example valid zones: "Asia/Kolkata", "America/New_York", "Europe/London".`);
  }
}

/**
 * Detects if a local wall-clock time is nonexistent due to a daylight saving spring-forward gap.
 */
export function isNonexistentSpringForwardTime(
  dateStr: string,
  timeStr: string,
  timeZone: string
): boolean {
  assertValidIanaTimezone(timeZone);
  const dt = DateTime.fromISO(`${dateStr}T${timeStr}`, { zone: timeZone });
  if (!dt.isValid) return false;

  const [expectedHour, expectedMinute] = timeStr.split(":").map(Number);
  return dt.hour !== expectedHour || dt.minute !== expectedMinute;
}

/**
 * Detects if a local wall-clock time is ambiguous due to a daylight saving fall-back repeated hour.
 * A time is ambiguous if multiple distinct UTC instants format to the same local wall-clock time.
 */
export function isAmbiguousFallBackTime(
  dateStr: string,
  timeStr: string,
  timeZone: string
): boolean {
  assertValidIanaTimezone(timeZone);
  const dt = DateTime.fromISO(`${dateStr}T${timeStr}`, { zone: timeZone });
  if (!dt.isValid) return false;

  const requestedFormat = `${dateStr} ${timeStr}`;
  const dtUtc = dt.toUTC();

  // Test 1 hour ahead and 1 hour behind UTC to see if either maps to the same local wall time
  const testAhead = dtUtc.plus({ hours: 1 }).setZone(timeZone);
  const testBehind = dtUtc.minus({ hours: 1 }).setZone(timeZone);

  const aheadMatches = testAhead.toFormat("yyyy-MM-dd HH:mm") === requestedFormat;
  const behindMatches = testBehind.toFormat("yyyy-MM-dd HH:mm") === requestedFormat;

  return aheadMatches || behindMatches;
}

/**
 * Converts a parent's local date and time into a verified UTC interval.
 * Rejects nonexistent spring-forward times and ambiguous fall-back times.
 */
export function resolveLocalSlotToUtc(params: {
  dateStr: string; // "YYYY-MM-DD"
  timeStr: string; // "HH:mm" (24h)
  timeZone: string; // IANA timezone
  durationMinutes?: number; // default 45
}): ResolvedSlot {
  const { dateStr, timeStr, timeZone, durationMinutes = 45 } = params;
  assertValidIanaTimezone(timeZone);

  // Validate date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new ValidationError(`Invalid date format "${dateStr}". Expected YYYY-MM-DD.`);
  }

  // Validate time format HH:mm
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeStr)) {
    throw new ValidationError(`Invalid time format "${timeStr}". Expected HH:mm in 24-hour format.`);
  }

  // 1. Check for Spring-Forward Nonexistent Time
  if (isNonexistentSpringForwardTime(dateStr, timeStr, timeZone)) {
    throw new DstTransitionError(
      `The requested time ${timeStr} on ${dateStr} does not exist in timezone "${timeZone}" due to a Daylight Saving Time spring-forward transition.`
    );
  }

  // 2. Check for Fall-Back Ambiguous Time
  if (isAmbiguousFallBackTime(dateStr, timeStr, timeZone)) {
    throw new DstTransitionError(
      `The requested time ${timeStr} on ${dateStr} is ambiguous in timezone "${timeZone}" due to a Daylight Saving Time fall-back transition (occurs twice). Please select a standard slot outside the transition window.`
    );
  }

  const startDt = DateTime.fromISO(`${dateStr}T${timeStr}:00`, { zone: timeZone });
  if (!startDt.isValid) {
    throw new ValidationError(`Could not parse local date/time: ${startDt.invalidReason}`);
  }

  const endDt = startDt.plus({ minutes: durationMinutes });

  return {
    utcStart: startDt.toUTC().toJSDate(),
    utcEnd: endDt.toUTC().toJSDate(),
    parentLocalStart: startDt.toISO() || startDt.toString(),
    parentLocalEnd: endDt.toISO() || endDt.toString(),
    isDst: startDt.isInDST,
    offsetMinutes: startDt.offset,
  };
}

/**
 * Formats a UTC Date into the mentor's local calendar day "YYYY-MM-DD".
 */
export function getMentorLocalDateString(utcDate: Date, mentorTimezone: string): string {
  assertValidIanaTimezone(mentorTimezone);
  return DateTime.fromJSDate(utcDate, { zone: "utc" })
    .setZone(mentorTimezone)
    .toFormat("yyyy-MM-dd");
}

/**
 * Returns the day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday) in the target timezone for a given UTC Date.
 */
export function getDayOfWeekInTimezone(utcDate: Date, timeZone: string): number {
  assertValidIanaTimezone(timeZone);
  const dt = DateTime.fromJSDate(utcDate, { zone: "utc" }).setZone(timeZone);
  // Luxon weekday: 1 = Monday, 7 = Sunday
  return dt.weekday % 7; // Convert to 0 = Sunday, 1 = Monday, ..., 6 = Saturday
}

/**
 * Formats a UTC date to "HH:mm" in the specified timezone.
 */
export function getTimeInTimezone(utcDate: Date, timeZone: string): string {
  assertValidIanaTimezone(timeZone);
  return DateTime.fromJSDate(utcDate, { zone: "utc" }).setZone(timeZone).toFormat("HH:mm");
}

/**
 * Gets the UTC start and end bounds for an entire local calendar day in a given timezone.
 */
export function getLocalDayUtcRange(dateStr: string, timeZone: string): { startUtc: Date; endUtc: Date } {
  assertValidIanaTimezone(timeZone);
  const startLocal = DateTime.fromISO(`${dateStr}T00:00:00`, { zone: timeZone }).startOf("day");
  const endLocal = DateTime.fromISO(`${dateStr}T23:59:59.999`, { zone: timeZone }).endOf("day");

  return {
    startUtc: startLocal.toUTC().toJSDate(),
    endUtc: endLocal.toUTC().toJSDate(),
  };
}
