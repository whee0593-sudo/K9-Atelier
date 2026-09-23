import { business } from "@/lib/business";

/** Calendar date (YYYY-MM-DD) in the business timezone. */
export function todayInBusinessTimezone(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: business.booking.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Add calendar days to a YYYY-MM-DD date without timezone shift. */
export function addDaysToIsoDate(dateYmd: string, days: number) {
  const [year, month, day] = dateYmd.split("-").map(Number);
  if (!year || !month || !day) return dateYmd;
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

/** Yesterday's calendar date (YYYY-MM-DD) in the business timezone. */
export function yesterdayInBusinessTimezone(now = new Date()) {
  return addDaysToIsoDate(todayInBusinessTimezone(now), -1);
}

/** Hour 0–23 in the business timezone. */
export function hourInBusinessTimezone(now = new Date()) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: business.booking.timezone,
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  return Number(hour);
}

/** Calendar date (YYYY-MM-DD) of an instant in the business timezone. */
export function calendarDateInBusinessTimezone(
  instant: Date,
  timeZone = business.booking.timezone,
) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function timezoneOffsetMs(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const value: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") value[part.type] = part.value;
  }
  let hour = Number(value.hour);
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
    hour,
    Number(value.minute),
    Number(value.second),
  );
  return asUtc - instant.getTime();
}

/** UTC instant for a wall-clock time in a timezone. */
export function zonedDateTimeToUtc(
  dateYmd: string,
  timeHms: string,
  timeZone = business.booking.timezone,
) {
  const [year, month, day] = dateYmd.split("-").map(Number);
  const [hour, minute, second] = timeHms.split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second || 0);
  let utc = utcGuess - timezoneOffsetMs(new Date(utcGuess), timeZone);
  const adjusted = utcGuess - timezoneOffsetMs(new Date(utc), timeZone);
  if (adjusted !== utc) utc = adjusted;
  return new Date(utc);
}

/** Half-open UTC range covering one business-timezone calendar day. */
export function businessDayUtcRange(
  dateYmd: string,
  timeZone = business.booking.timezone,
) {
  const start = zonedDateTimeToUtc(dateYmd, "00:00:00", timeZone);
  const end = zonedDateTimeToUtc(
    addDaysToIsoDate(dateYmd, 1),
    "00:00:00",
    timeZone,
  );
  return { start: start.toISOString(), end: end.toISOString() };
}
