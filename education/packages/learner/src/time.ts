/**
 * Time zone aware scheduling helpers for the learner package.
 *
 * All persisted timestamps are RFC3339 UTC (05 §2). Display and "next local
 * day" scheduling need a real IANA zone because tests must cover a day
 * boundary that is not the UTC boundary and DST gaps/overlaps. The helpers
 * never read the system clock; callers inject instants.
 */

import type { Timestamp } from '@edu/domain';

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached !== undefined) return cached;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone).format(0);
    return true;
  } catch {
    return false;
  }
}

export interface LocalDateTimeParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

export function parseInstant(value: Timestamp | number): number {
  const ms = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) {
    throw new Error(`invalid instant: ${String(value)}`);
  }
  return ms;
}

/** Seconds-precision RFC3339 UTC with a mandatory `Z`. */
export function toRfc3339Utc(epochMs: number): Timestamp {
  return new Date(Math.floor(epochMs / 1000) * 1000).toISOString().replace('.000Z', 'Z');
}

/** The wall-clock fields of an instant in `timeZone`. */
export function localDateTimeParts(instant: Timestamp | number, timeZone: string): LocalDateTimeParts {
  const ms = parseInstant(instant);
  const parts = formatterFor(timeZone).formatToParts(new Date(ms));
  const values = new Map<string, number>();
  for (const part of parts) {
    if (part.type === 'literal') continue;
    const numeric = Number(part.value);
    if (Number.isFinite(numeric)) values.set(part.type, numeric);
  }
  const year = values.get('year');
  const month = values.get('month');
  const day = values.get('day');
  const hour = values.get('hour');
  const minute = values.get('minute');
  const second = values.get('second');
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    throw new Error(`time zone ${timeZone} did not produce complete local parts`);
  }
  return { year, month, day, hour, minute, second };
}

/** Human readable local ISO text used in rationales/tests, never persisted. */
export function formatLocalDateTime(instant: Timestamp | number, timeZone: string): string {
  const p = localDateTimeParts(instant, timeZone);
  const pad = (value: number, size = 2): string => String(value).padStart(size, '0');
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

/** Compare a local wall-clock value with the target, field by field. */
function compareLocal(a: LocalDateTimeParts, b: LocalDateTimeParts): number {
  const fields: (keyof LocalDateTimeParts)[] = ['year', 'month', 'day', 'hour', 'minute', 'second'];
  for (const field of fields) {
    if (a[field] !== b[field]) return a[field] < b[field] ? -1 : 1;
  }
  return 0;
}

function offsetSecondsAt(instantMs: number, timeZone: string): number {
  const second = Math.floor(instantMs / 1000) * 1000;
  const local = localDateTimeParts(second, timeZone);
  const asUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  return Math.round((asUtc - second) / 1000);
}

/**
 * Resolve a local wall-clock value in `timeZone` to a UTC instant.
 *
 * Finite DST rules:
 * - a wall time that does not exist (spring-forward gap) resolves forward to
 *   the first valid instant after the gap (02:30 -> 03:30 local);
 * - a repeated wall time (fall-back overlap) resolves to the earlier instant.
 */
export function zonedDateTimeToUtc(target: LocalDateTimeParts, timeZone: string): Timestamp {
  const naive = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second,
  );
  const offsets = new Set<number>();
  for (const hours of [-48, -24, -12, 0, 12, 24, 48]) {
    offsets.add(offsetSecondsAt(naive + hours * 3_600_000, timeZone));
  }
  const exact: number[] = [];
  const forward: number[] = [];
  for (const offset of offsets) {
    const candidate = naive - offset * 1000;
    const local = localDateTimeParts(candidate, timeZone);
    const comparison = compareLocal(local, target);
    if (comparison === 0) exact.push(candidate);
    else if (comparison > 0) forward.push(candidate);
  }
  if (exact.length > 0) return toRfc3339Utc(Math.min(...exact));
  if (forward.length > 0) {
    const sameDay = forward.filter((candidate) => {
      const local = localDateTimeParts(candidate, timeZone);
      return (
        local.year === target.year && local.month === target.month && local.day === target.day
      );
    });
    return toRfc3339Utc(Math.min(...(sameDay.length > 0 ? sameDay : forward)));
  }
  throw new Error(
    `cannot resolve local time ${JSON.stringify(target)} in ${timeZone}`,
  );
}

export interface LocalCalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** Calendar-day arithmetic that never depends on the machine time zone. */
export function addLocalDays(date: LocalCalendarDate, days: number): LocalCalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export interface LocalTimeOfDay {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

/** Next local calendar day at `at` (default review slot), DST safe. */
export function nextLocalDayAt(base: Timestamp | number, timeZone: string, at: LocalTimeOfDay): Timestamp {
  const local = localDateTimeParts(base, timeZone);
  const next = addLocalDays(local, 1);
  return zonedDateTimeToUtc(
    { ...next, hour: at.hour, minute: at.minute, second: at.second },
    timeZone,
  );
}

/** Local calendar day `days` after `base`, at the given local wall-clock slot. */
export function localDayAtOffset(
  base: Timestamp | number,
  timeZone: string,
  days: number,
  at: LocalTimeOfDay,
): Timestamp {
  const local = localDateTimeParts(base, timeZone);
  const target = addLocalDays(local, days);
  return zonedDateTimeToUtc({ ...target, hour: at.hour, minute: at.minute, second: at.second }, timeZone);
}

/** Next local calendar day, keeping the base wall-clock time (review deferral). */
export function sameWallClockNextDay(base: Timestamp | number, timeZone: string): Timestamp {
  const local = localDateTimeParts(base, timeZone);
  const next = addLocalDays(local, 1);
  return zonedDateTimeToUtc(localToTarget(next, local), timeZone);
}

function localToTarget(date: LocalCalendarDate, time: LocalTimeOfDay): LocalDateTimeParts {
  return {
    year: date.year,
    month: date.month,
    day: date.day,
    hour: time.hour,
    minute: time.minute,
    second: time.second,
  };
}

/** Whole milliseconds between two instants (b - a). */
export function elapsedMs(a: Timestamp | number, b: Timestamp | number): number {
  return parseInstant(b) - parseInstant(a);
}
